import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  EventStatus,
  NotificationType,
  PostKind,
  PostStatus,
  type Prisma,
  UserRole,
} from '@prisma/client';
import { normalizeArabic } from 'src/common/utils/arabic';
import type {
  DocumentEventDto,
  ImpactMetricDto,
  UpdateDocumentationDto,
} from 'src/events/dto/document-event.dto';
import { ACTIVE_EVENT_STATUSES, lockEvent } from 'src/events/event-state';
import { EventsService } from 'src/events/events.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PostsService } from 'src/posts/posts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';

const MAX_LABEL_SUGGESTIONS = 20;

/**
 * After the event: documentation (text + photos) moves it to COMPLETED, optionally with impact
 * metrics. Also the overdue check run by the scheduled job. Rules: docs/CONVENTIONS.md → "Events and
 * badges" and "Event documentation and impact".
 */
@Injectable()
export class EventDocumentationService {
  private readonly logger = new Logger(EventDocumentationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly events: EventsService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  /** OPEN / CLOSED → COMPLETED, once the event has started. Accepted volunteers are told. */
  async document(userId: number, id: number, dto: DocumentEventDto) {
    const event = await this.findOwn(userId, id);
    if (event.startsAt > new Date()) {
      throw new BadRequestException(
        'An event can be documented once it has started.',
      );
    }
    const metrics = this.checkMetrics(dto.metrics ?? []);
    const images = await this.posts.resolveImages(dto.imageKeys);

    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, id);
      const current = await tx.event.findUniqueOrThrow({
        where: { postId: id },
        select: { status: true },
      });
      if (current.status === EventStatus.COMPLETED) {
        throw new BadRequestException(
          'The event is already documented: edit the documentation instead.',
        );
      }
      if (!ACTIVE_EVENT_STATUSES.includes(current.status)) {
        throw new BadRequestException(
          `A ${current.status.toLowerCase()} event cannot be documented.`,
        );
      }
      await this.replaceImages(tx, id, images);
      await tx.eventImpactMetric.createMany({
        data: metrics.map((m) => ({ ...m, eventId: id })),
      });
      await tx.event.update({
        where: { postId: id },
        data: {
          status: EventStatus.COMPLETED,
          documentation: dto.documentation,
          documentedAt: new Date(),
          autoClosedAt: null,
        },
      });
      const volunteers = await tx.eventApplication.findMany({
        where: { eventId: id, status: ApplicationStatus.ACCEPTED },
        select: { userId: true },
      });
      await this.notifications.createMany(
        volunteers.map((v) => ({
          recipientId: v.userId,
          actorId: userId,
          type: NotificationType.EVENT_DOCUMENTED,
          postId: id,
        })),
        tx,
      );
    });
    this.logger.log(`Event ${id} documented by user ${userId}.`);
    return this.events.findOne(userId, id);
  }

  /** Edits the documentation of a COMPLETED event (documentedAt stays the same). */
  async update(userId: number, id: number, dto: UpdateDocumentationDto) {
    const event = await this.findOwn(userId, id);
    if (event.status !== EventStatus.COMPLETED) {
      throw new BadRequestException(
        'Only a documented (completed) event has documentation to edit.',
      );
    }
    const metrics =
      dto.metrics !== undefined ? this.checkMetrics(dto.metrics) : undefined;
    const images =
      dto.imageKeys !== undefined
        ? await this.posts.resolveImages(dto.imageKeys)
        : undefined;

    const removedKeys = await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, id);
      if (dto.documentation !== undefined) {
        await tx.event.update({
          where: { postId: id },
          data: { documentation: dto.documentation },
        });
      }
      if (metrics !== undefined) {
        await tx.eventImpactMetric.deleteMany({ where: { eventId: id } });
        await tx.eventImpactMetric.createMany({
          data: metrics.map((m) => ({ ...m, eventId: id })),
        });
      }
      return images !== undefined ? this.replaceImages(tx, id, images) : [];
    });

    await Promise.all(removedKeys.map((key) => this.storage.delete(key)));
    this.logger.log(`Documentation of event ${id} updated by user ${userId}.`);
    return this.events.findOne(userId, id);
  }

  /**
   * The caller's own past metric labels, most used first, to keep labels consistent while
   * typing. `q` filters after Arabic normalization.
   */
  async labelSuggestions(userId: number, q?: string) {
    const rows = await this.prisma.eventImpactMetric.findMany({
      where: {
        event: {
          post: { authorId: userId, status: { not: PostStatus.DELETED } },
        },
        ...(q ? { normalized: { contains: normalizeArabic(q) } } : {}),
      },
      orderBy: { id: 'desc' },
      select: { label: true, normalized: true },
    });
    const byLabel = new Map<string, { label: string; uses: number }>();
    for (const row of rows) {
      const seen = byLabel.get(row.normalized);
      // Rows are newest first: the first one seen is the latest spelling.
      if (seen) seen.uses += 1;
      else byLabel.set(row.normalized, { label: row.label, uses: 1 });
    }
    return {
      data: [...byLabel.values()]
        .sort((a, b) => b.uses - a.uses || a.label.localeCompare(b.label))
        .slice(0, MAX_LABEL_SUGGESTIONS),
    };
  }

  /**
   * Notifies every admin, once per event, about events still undocumented after
   * `documentationDueAt`. Called by the scheduled job; returns how many events were reported.
   */
  async notifyOverdue(now: Date = new Date()): Promise<number> {
    const overdue = await this.prisma.event.findMany({
      where: {
        status: { in: ACTIVE_EVENT_STATUSES },
        documentationDueAt: { lt: now },
        overdueNotifiedAt: null,
        post: { status: { not: PostStatus.DELETED } },
      },
      select: { postId: true, post: { select: { authorId: true } } },
    });
    if (overdue.length === 0) return 0;
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, deletedAt: null },
      select: { id: true },
    });

    let reported = 0;
    for (const event of overdue) {
      await this.prisma.$transaction(async (tx) => {
        // The stamp guards against a second run reporting the same event.
        const { count } = await tx.event.updateMany({
          where: { postId: event.postId, overdueNotifiedAt: null },
          data: { overdueNotifiedAt: now },
        });
        if (count === 0) return;
        await this.notifications.createMany(
          admins.map((admin) => ({
            recipientId: admin.id,
            actorId: event.post.authorId,
            type: NotificationType.EVENT_DOCUMENTATION_OVERDUE,
            postId: event.postId,
          })),
          tx,
        );
        reported += 1;
      });
    }
    this.logger.log(`Reported ${reported} events with overdue documentation.`);
    return reported;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findOwn(userId: number, id: number) {
    const post = await this.prisma.post.findFirst({
      where: { id, kind: PostKind.EVENT, status: { not: PostStatus.DELETED } },
      select: {
        authorId: true,
        author: { select: { isSuspended: true } },
        event: { select: { status: true, startsAt: true } },
      },
    });
    if (!post?.event) {
      throw new NotFoundException(`No event found with id ${id}.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('Only the event organizer can document it.');
    }
    if (post.author.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
    return post.event;
  }

  private checkMetrics(metrics: ImpactMetricDto[]) {
    const rows = metrics.map((m, index) => ({
      label: m.label,
      normalized: normalizeArabic(m.label),
      value: m.value,
      sortOrder: index,
    }));
    const keys = rows.map((r) => r.normalized);
    if (keys.some((k) => !k) || new Set(keys).size !== keys.length) {
      throw new BadRequestException(
        'Each impact metric needs its own label (the same label appears twice).',
      );
    }
    return rows;
  }

  /** Replaces the DOCUMENTATION photos; returns the storage keys no longer used. */
  private async replaceImages(
    tx: Prisma.TransactionClient,
    postId: number,
    images: Awaited<ReturnType<PostsService['resolveImages']>>,
  ): Promise<string[]> {
    const old = await tx.postMedia.findMany({
      where: { postId, phase: 'DOCUMENTATION' },
      select: { storageKey: true },
    });
    const kept = new Set(images.map((i) => i.key));
    await tx.postMedia.deleteMany({
      where: { postId, phase: 'DOCUMENTATION' },
    });
    await tx.postMedia.createMany({
      data: this.posts
        .mediaRows(images)
        .map((m) => ({ ...m, postId, phase: 'DOCUMENTATION' as const })),
    });
    return old.map((m) => m.storageKey).filter((k) => !kept.has(k));
  }
}
