import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventStatus,
  NotificationType,
  PostKind,
  PostStatus,
  Prisma,
} from '@prisma/client';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import type {
  CreateEventDto,
  EventDatesDto,
} from 'src/events/dto/create-event.dto';
import type { CloneEventDto } from 'src/events/dto/clone-event.dto';
import type {
  EventQuestionDto,
  EventRoleDto,
} from 'src/events/dto/event-parts.dto';
import type { FindEventsQueryDto } from 'src/events/dto/find-events-query.dto';
import type { UpdateEventDto } from 'src/events/dto/update-event.dto';
import {
  ACTIVE_APPLICATION_STATUSES,
  applyUntil,
  lockEvent,
  syncCapacity,
} from 'src/events/event-state';
import {
  APPLICATION_SELECT,
  EVENT_DETAILS_SELECT,
  readQuestions,
  toApplicationView,
  toEventDetails,
  type EventQuestion,
} from 'src/events/event-view';
import { NotificationsService } from 'src/notifications/notifications.service';
import { postSelect, toPostView } from 'src/posts/post-view';
import { PostsService } from 'src/posts/posts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DOCUMENTATION_GRACE_DAYS = 7;

interface EventDates {
  startsAt: Date;
  endsAt: Date | null;
  applicationDeadline: Date | null;
}

/**
 * Events are posts (kind = EVENT) with an Event row and optional volunteer roles. This service
 * creates, shows, edits, closes, cancels and clones them. Applications live in
 * EventApplicationsService. Rules: docs/CONVENTIONS.md → "Events and badges" and "Event roles".
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly graceDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    const days = Number(config.get('EVENT_DOCUMENTATION_GRACE_DAYS'));
    this.graceDays =
      Number.isInteger(days) && days > 0
        ? days
        : DEFAULT_DOCUMENTATION_GRACE_DAYS;
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  async findAll(viewerId: number, query: FindEventsQueryDto) {
    const where: Prisma.PostWhereInput = {
      kind: PostKind.EVENT,
      status: PostStatus.PUBLISHED,
      ...(query.sectionId !== undefined ? { sectionId: query.sectionId } : {}),
      ...(query.authorId !== undefined ? { authorId: query.authorId } : {}),
      ...(query.topicId !== undefined
        ? { topics: { some: { topicId: query.topicId } } }
        : {}),
      event: {
        is: {
          ...(query.governorate ? { governorate: query.governorate } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
      },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: [{ event: { startsAt: 'asc' } }, { id: 'asc' }],
        ...pageArgs(query),
        select: postSelect(viewerId),
      }),
    ]);
    const now = new Date();
    return paginated(
      rows.map((row) => toPostView(row, now)),
      total,
      query,
    );
  }

  /** The event page: the post view plus roles, questions and the viewer's application. */
  async findOne(viewerId: number, id: number) {
    const post = await this.posts.findOne(viewerId, id);
    if (post.kind !== PostKind.EVENT || !post.event) {
      throw new NotFoundException(`No event found with id ${id}.`);
    }
    const [details, mine] = await Promise.all([
      this.prisma.event.findUniqueOrThrow({
        where: { postId: id },
        select: EVENT_DETAILS_SELECT,
      }),
      this.prisma.eventApplication.findUnique({
        where: { eventId_userId: { eventId: id, userId: viewerId } },
        select: APPLICATION_SELECT,
      }),
    ]);
    const now = new Date();
    return {
      ...post,
      event: {
        ...post.event,
        ...toEventDetails(details),
        applicationsOpen:
          post.event.status === EventStatus.OPEN &&
          applyUntil(post.event) > now,
        isOrganizer: post.author.id === viewerId,
      },
      myApplication: mine ? toApplicationView(mine) : null,
    };
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async create(userId: number, dto: CreateEventDto) {
    await this.posts.assertCanPublish(userId);
    const section = await this.prisma.section.findUnique({
      where: { id: dto.sectionId },
      select: { id: true },
    });
    if (!section) {
      throw new NotFoundException(`No section found with id ${dto.sectionId}.`);
    }
    const topicIds = dto.topicIds ?? [];
    await this.posts.assertTopicsInSection(section.id, topicIds);
    const dates = this.checkDates(dto, true);
    const roles = this.checkNewRoles(dto.roles ?? [], dto.capacity);
    const images = await this.posts.resolveImages(dto.imageKeys ?? []);

    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId: userId,
          sectionId: section.id,
          kind: PostKind.EVENT,
          title: dto.title,
          body: dto.body,
          media: { create: this.posts.mediaRows(images) },
          topics: { create: topicIds.map((topicId) => ({ topicId })) },
          event: {
            create: {
              ...dates,
              documentationDueAt: this.documentationDue(dates),
              volunteerHours: dto.volunteerHours,
              capacity: roles.length
                ? this.sumSeats(roles)
                : (dto.capacity ?? null),
              governorate: dto.governorate,
              city: dto.city,
              locationText: dto.locationText ?? '',
              latitude: dto.latitude ?? null,
              longitude: dto.longitude ?? null,
              minAge: dto.minAge ?? null,
              applicationQuestions: this.toQuestions(
                dto.questions ?? [],
              ) as unknown as Prisma.InputJsonArray,
              roles: { create: roles },
            },
          },
        },
        select: { id: true },
      });
      await this.posts.notifyNewPost(tx, {
        id: created.id,
        authorId: userId,
        sectionId: section.id,
        topicIds,
      });
      return created.id;
    });
    this.logger.log(`Event ${id} created by user ${userId}.`);
    return this.findOne(userId, id);
  }

  /** A new OPEN event pre-filled from one of the caller's events; only the dates are new. */
  async clone(userId: number, sourceId: number, dto: CloneEventDto) {
    await this.posts.assertCanPublish(userId);
    const source = await this.prisma.post.findFirst({
      where: {
        id: sourceId,
        kind: PostKind.EVENT,
        status: { not: PostStatus.DELETED },
      },
      select: {
        authorId: true,
        sectionId: true,
        title: true,
        body: true,
        topics: {
          where: { topic: { isActive: true } },
          select: { topicId: true },
        },
        media: {
          where: { phase: 'MAIN' },
          orderBy: { sortOrder: 'asc' },
          select: { storageKey: true },
        },
        event: {
          select: {
            capacity: true,
            volunteerHours: true,
            governorate: true,
            city: true,
            locationText: true,
            latitude: true,
            longitude: true,
            minAge: true,
            applicationQuestions: true,
            roles: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: { name: true, seats: true, sortOrder: true },
            },
          },
        },
      },
    });
    if (!source?.event) {
      throw new NotFoundException(`No event found with id ${sourceId}.`);
    }
    if (source.authorId !== userId) {
      throw new ForbiddenException('You can only copy your own events.');
    }
    const event = source.event;
    const dates = this.checkDates(dto, true);
    const topicIds = source.topics.map((t) => t.topicId);
    // New images if sent; otherwise each source image is copied into its own new file.
    const copied = dto.imageKeys === undefined;
    const images = copied
      ? (
          await Promise.all(
            source.media.map((m) => this.storage.copyPublicImage(m.storageKey)),
          )
        ).filter((image) => image !== null)
      : await this.posts.resolveImages(dto.imageKeys ?? []);

    const id = await this.prisma
      .$transaction(async (tx) => {
        const created = await tx.post.create({
          data: {
            authorId: userId,
            sectionId: source.sectionId,
            kind: PostKind.EVENT,
            title: source.title,
            body: source.body,
            media: { create: this.posts.mediaRows(images) },
            topics: { create: topicIds.map((topicId) => ({ topicId })) },
            event: {
              create: {
                ...dates,
                documentationDueAt: this.documentationDue(dates),
                capacity: event.roles.length
                  ? this.sumSeats(event.roles)
                  : event.capacity,
                volunteerHours: event.volunteerHours,
                governorate: event.governorate,
                city: event.city,
                locationText: event.locationText,
                latitude: event.latitude,
                longitude: event.longitude,
                minAge: event.minAge,
                applicationQuestions: readQuestions(
                  event.applicationQuestions,
                ) as unknown as Prisma.InputJsonArray,
                roles: { create: event.roles },
              },
            },
          },
          select: { id: true },
        });
        await this.posts.notifyNewPost(tx, {
          id: created.id,
          authorId: userId,
          sectionId: source.sectionId,
          topicIds,
        });
        return created.id;
      })
      .catch(async (error: unknown) => {
        // Nothing points at the copies: remove them before reporting the error.
        if (copied) {
          await Promise.all(images.map((i) => this.storage.delete(i.key)));
        }
        throw error;
      });
    this.logger.log(
      `Event ${id} cloned from event ${sourceId} by user ${userId}.`,
    );
    return this.findOne(userId, id);
  }

  // ── Edit ─────────────────────────────────────────────────────────────────

  async update(userId: number, id: number, dto: UpdateEventDto) {
    const current = await this.findOwnActive(userId, id);
    const event = current.event;
    if (dto.topicIds !== undefined) {
      await this.posts.assertTopicsInSection(current.sectionId, dto.topicIds);
    }
    const datesChanged =
      dto.startsAt !== undefined ||
      dto.endsAt !== undefined ||
      dto.applicationDeadline !== undefined;
    const dates = datesChanged
      ? this.checkDates(
          {
            startsAt: dto.startsAt ?? event.startsAt.toISOString(),
            endsAt:
              dto.endsAt !== undefined
                ? dto.endsAt
                : (event.endsAt?.toISOString() ?? null),
            applicationDeadline:
              dto.applicationDeadline !== undefined
                ? dto.applicationDeadline
                : (event.applicationDeadline?.toISOString() ?? null),
          },
          dto.startsAt !== undefined,
          dto.applicationDeadline !== undefined,
        )
      : undefined;
    if (dto.roles !== undefined && dto.roles.length > 0 && dto.capacity) {
      throw new BadRequestException(
        'Send either a capacity or roles, not both: with roles the capacity is the sum of the seats.',
      );
    }
    this.checkRoleNames(dto.roles ?? []);
    const images =
      dto.imageKeys !== undefined
        ? await this.posts.resolveImages(dto.imageKeys)
        : undefined;

    const removedKeys = await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, id);
      const activeApplications = await tx.eventApplication.count({
        where: { eventId: id, status: { in: ACTIVE_APPLICATION_STATUSES } },
      });
      if (dto.questions !== undefined && activeApplications > 0) {
        throw new BadRequestException(
          'Questions cannot change once people have applied.',
        );
      }

      let capacity: number | null | undefined;
      if (dto.roles !== undefined) {
        capacity = await this.replaceRoles(
          tx,
          id,
          dto.roles,
          activeApplications,
          dto.capacity,
        );
      } else if (dto.capacity !== undefined) {
        const roleCount = await tx.eventRole.count({ where: { eventId: id } });
        if (roleCount > 0) {
          throw new BadRequestException(
            'This event has roles: change the role seats instead of the capacity.',
          );
        }
        capacity = dto.capacity;
      }
      if (capacity !== undefined && capacity !== null) {
        const accepted = await tx.eventApplication.count({
          where: { eventId: id, status: 'ACCEPTED' },
        });
        if (capacity < accepted) {
          throw new BadRequestException(
            `The capacity cannot be lower than the ${accepted} volunteers already accepted.`,
          );
        }
      }

      await tx.post.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.body !== undefined ? { body: dto.body } : {}),
        },
      });
      if (dto.topicIds !== undefined) {
        await tx.postTopic.deleteMany({ where: { postId: id } });
        await tx.postTopic.createMany({
          data: dto.topicIds.map((topicId) => ({ postId: id, topicId })),
        });
      }
      let removed: string[] = [];
      if (images !== undefined) {
        const old = await tx.postMedia.findMany({
          where: { postId: id, phase: 'MAIN' },
          select: { storageKey: true },
        });
        const kept = new Set(images.map((i) => i.key));
        removed = old.map((m) => m.storageKey).filter((k) => !kept.has(k));
        await tx.postMedia.deleteMany({ where: { postId: id, phase: 'MAIN' } });
        await tx.postMedia.createMany({
          data: this.posts.mediaRows(images).map((m) => ({ ...m, postId: id })),
        });
      }

      await tx.event.update({
        where: { postId: id },
        data: {
          ...(dates
            ? { ...dates, documentationDueAt: this.documentationDue(dates) }
            : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(dto.volunteerHours !== undefined
            ? { volunteerHours: dto.volunteerHours }
            : {}),
          ...(dto.governorate !== undefined
            ? { governorate: dto.governorate }
            : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.locationText !== undefined
            ? { locationText: dto.locationText }
            : {}),
          ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
          ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
          ...(dto.minAge !== undefined ? { minAge: dto.minAge } : {}),
          ...(dto.questions !== undefined
            ? {
                applicationQuestions: this.toQuestions(
                  dto.questions,
                ) as unknown as Prisma.InputJsonArray,
              }
            : {}),
        },
      });
      // More seats or later dates may reopen an event that closed itself; fewer may close it.
      await syncCapacity(tx, id);
      return removed;
    });

    await Promise.all(removedKeys.map((key) => this.storage.delete(key)));
    this.logger.log(`Event ${id} updated by user ${userId}.`);
    return this.findOne(userId, id);
  }

  /** OPEN → CLOSED by hand. Also turns a self-closed event into a hand-closed one. */
  async close(userId: number, id: number) {
    await this.findOwnActive(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, id);
      const event = await tx.event.findUniqueOrThrow({
        where: { postId: id },
        select: { status: true, autoClosedAt: true },
      });
      if (event.status === EventStatus.CLOSED && !event.autoClosedAt) {
        throw new BadRequestException('The event is already closed.');
      }
      if (
        event.status !== EventStatus.OPEN &&
        event.status !== EventStatus.CLOSED
      ) {
        throw new BadRequestException(
          `A ${event.status.toLowerCase()} event cannot be closed.`,
        );
      }
      await tx.event.update({
        where: { postId: id },
        data: { status: EventStatus.CLOSED, autoClosedAt: null },
      });
    });
    this.logger.log(`Event ${id} closed by user ${userId}.`);
    return this.findOne(userId, id);
  }

  /** Any state → CANCELLED. Pending and accepted applicants are told. */
  async cancel(userId: number, id: number) {
    const post = await this.findOwnEvent(userId, id);
    if (post.event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('The event is already cancelled.');
    }
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, id);
      await tx.event.update({
        where: { postId: id },
        data: { status: EventStatus.CANCELLED, autoClosedAt: null },
      });
      const applicants = await tx.eventApplication.findMany({
        where: { eventId: id, status: { in: ACTIVE_APPLICATION_STATUSES } },
        select: { userId: true },
      });
      await this.notifications.createMany(
        applicants.map((a) => ({
          recipientId: a.userId,
          actorId: userId,
          type: NotificationType.EVENT_CANCELLED,
          postId: id,
        })),
        tx,
      );
    });
    this.logger.log(`Event ${id} cancelled by user ${userId}.`);
    return this.findOne(userId, id);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** The caller's own, not deleted event, with its current state. */
  private async findOwnEvent(userId: number, id: number) {
    const post = await this.prisma.post.findFirst({
      where: { id, kind: PostKind.EVENT, status: { not: PostStatus.DELETED } },
      select: {
        authorId: true,
        sectionId: true,
        author: { select: { isSuspended: true } },
        event: {
          select: {
            status: true,
            startsAt: true,
            endsAt: true,
            applicationDeadline: true,
          },
        },
      },
    });
    if (!post?.event) {
      throw new NotFoundException(`No event found with id ${id}.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only manage your own events.');
    }
    if (post.author.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
    return { ...post, event: post.event };
  }

  /** Like findOwnEvent, and the event must still be OPEN or CLOSED. */
  private async findOwnActive(userId: number, id: number) {
    const post = await this.findOwnEvent(userId, id);
    if (
      post.event.status === EventStatus.COMPLETED ||
      post.event.status === EventStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `A ${post.event.status.toLowerCase()} event cannot be changed.`,
      );
    }
    return post;
  }

  /**
   * Validates the dates. `startMustBeFuture` / `deadlineMustBeFuture` are true for values the
   * caller is setting now (an unchanged past value may stay).
   */
  private checkDates(
    dto: EventDatesDto,
    startMustBeFuture: boolean,
    deadlineMustBeFuture = startMustBeFuture,
  ): EventDates {
    const now = new Date();
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    const applicationDeadline = dto.applicationDeadline
      ? new Date(dto.applicationDeadline)
      : null;
    if (startMustBeFuture && startsAt <= now) {
      throw new BadRequestException('The event must start in the future.');
    }
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('The event must end after it starts.');
    }
    if (applicationDeadline) {
      if (applicationDeadline > startsAt) {
        throw new BadRequestException(
          'The application deadline cannot be after the start.',
        );
      }
      if (deadlineMustBeFuture && applicationDeadline <= now) {
        throw new BadRequestException(
          'The application deadline must be in the future.',
        );
      }
    }
    return { startsAt, endsAt, applicationDeadline };
  }

  private documentationDue(dates: EventDates): Date {
    const base = dates.endsAt ?? dates.startsAt;
    return new Date(base.getTime() + this.graceDays * DAY_MS);
  }

  private checkRoleNames(roles: EventRoleDto[]): void {
    const names = roles.map((r) => r.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      throw new BadRequestException('Role names must be unique.');
    }
  }

  private checkNewRoles(
    roles: EventRoleDto[],
    capacity: number | null | undefined,
  ) {
    if (roles.some((r) => r.id !== undefined)) {
      throw new BadRequestException('New roles cannot have an id.');
    }
    if (roles.length > 0 && capacity) {
      throw new BadRequestException(
        'Send either a capacity or roles, not both: with roles the capacity is the sum of the seats.',
      );
    }
    this.checkRoleNames(roles);
    return roles.map((r, index) => ({
      name: r.name,
      seats: r.seats,
      sortOrder: index,
    }));
  }

  private sumSeats(roles: { seats: number }[]): number {
    return roles.reduce((sum, r) => sum + r.seats, 0);
  }

  private toQuestions(questions: EventQuestionDto[]): EventQuestion[] {
    return questions.map((q, index) => ({
      id: `q${index + 1}`,
      text: q.text,
      required: q.required ?? false,
    }));
  }

  /**
   * Applies the new role list (event locked): keeps / updates roles sent with an id, adds the
   * others, removes the rest. Returns the new capacity.
   */
  private async replaceRoles(
    tx: Prisma.TransactionClient,
    eventId: number,
    wanted: EventRoleDto[],
    activeApplications: number,
    capacity: number | null | undefined,
  ): Promise<number | null | undefined> {
    const existing = await tx.eventRole.findMany({
      where: { eventId },
      select: {
        id: true,
        _count: {
          select: { applications: { where: { status: 'ACCEPTED' } } },
        },
      },
    });
    const existingIds = new Set(existing.map((r) => r.id));
    if (activeApplications > 0 && existing.length > 0 !== wanted.length > 0) {
      throw new BadRequestException(
        'Roles cannot be added to or removed from every seat once people have applied.',
      );
    }
    for (const role of wanted) {
      if (role.id !== undefined && !existingIds.has(role.id)) {
        throw new BadRequestException(
          `Role ${role.id} does not belong to this event.`,
        );
      }
    }
    const sentIds = wanted.flatMap((r) => (r.id !== undefined ? [r.id] : []));
    const keptIds = new Set(sentIds);
    if (keptIds.size !== sentIds.length) {
      throw new BadRequestException('A role id appears twice.');
    }
    const removedIds = existing
      .map((r) => r.id)
      .filter((roleId) => !keptIds.has(roleId));

    if (removedIds.length > 0) {
      const inUse = await tx.eventApplication.count({
        where: {
          eventId,
          status: { in: ACTIVE_APPLICATION_STATUSES },
          OR: [
            { roleId: { in: removedIds } },
            { roleChoices: { some: { roleId: { in: removedIds } } } },
          ],
        },
      });
      if (inUse > 0) {
        throw new ConflictException(
          'A role that applicants chose or were accepted into cannot be removed.',
        );
      }
    }
    const acceptedByRole = new Map(
      existing.map((r) => [r.id, r._count.applications]),
    );
    for (const role of wanted) {
      const taken = role.id !== undefined ? acceptedByRole.get(role.id) : 0;
      if (taken && role.seats < taken) {
        throw new BadRequestException(
          `The role "${role.name}" already has ${taken} accepted volunteers.`,
        );
      }
    }

    try {
      await tx.eventRole.deleteMany({ where: { id: { in: removedIds } } });
      // Temporary names first, so swapping two names never hits the unique index.
      for (const role of wanted) {
        if (role.id !== undefined) {
          await tx.eventRole.update({
            where: { id: role.id },
            data: { name: `__renaming_${role.id}` },
          });
        }
      }
      for (const [index, role] of wanted.entries()) {
        if (role.id !== undefined) {
          await tx.eventRole.update({
            where: { id: role.id },
            data: { name: role.name, seats: role.seats, sortOrder: index },
          });
        } else {
          await tx.eventRole.create({
            data: {
              eventId,
              name: role.name,
              seats: role.seats,
              sortOrder: index,
            },
          });
        }
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Role names must be unique.');
      }
      throw error;
    }
    if (wanted.length > 0) return this.sumSeats(wanted);
    // No roles now: the old roles' seats no longer apply; otherwise nothing changed.
    return existing.length > 0 ? (capacity ?? null) : capacity;
  }
}
