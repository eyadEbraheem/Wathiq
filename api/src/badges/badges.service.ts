import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  BadgeStatus,
  EventStatus,
  NotificationType,
  PostStatus,
  Prisma,
} from '@prisma/client';
import type {
  ApproveBadgeDto,
  FindBadgesQueryDto,
} from 'src/badges/dto/badge.dto';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

const EDUCATION = 'education';

const BADGE_SELECT = {
  id: true,
  status: true,
  description: true,
  isShownOnProfile: true,
  createdAt: true,
  decidedAt: true,
  user: { select: USER_CARD_SELECT },
  application: {
    select: { id: true, role: { select: { id: true, name: true } } },
  },
  event: {
    select: {
      postId: true,
      status: true,
      startsAt: true,
      endsAt: true,
      documentedAt: true,
      post: {
        select: {
          title: true,
          author: { select: USER_CARD_SELECT },
          section: {
            select: {
              id: true,
              slug: true,
              nameAr: true,
              nameEn: true,
              logoUrl: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BadgeSelect;

type BadgeRow = Prisma.BadgeGetPayload<{ select: typeof BADGE_SELECT }>;

/**
 * The API shape of a badge. In the education section it is shown as an attendance
 * certificate. The image is the section logo; `event.id` links to the documentation.
 */
function toBadgeView(row: BadgeRow) {
  const { user, application, event, ...rest } = row;
  const { post, postId, ...eventRest } = event;
  return {
    ...rest,
    kind:
      post.section.slug === EDUCATION
        ? ('CERTIFICATE' as const)
        : ('BADGE' as const),
    imageUrl: post.section.logoUrl,
    holder: user,
    applicationId: application.id,
    role: application.role,
    event: {
      id: postId,
      title: post.title,
      ...eventRest,
      section: post.section,
      organizer: post.author,
    },
  };
}

/**
 * Badges: a volunteer ACCEPTED to a COMPLETED event requests one, the organizer approves or
 * rejects it. After a rejection the same row goes back to REQUESTED. Approved badges stay
 * even if the event is cancelled later.
 */
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async request(userId: number, applicationId: number) {
    const application = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: {
        userId: true,
        status: true,
        eventId: true,
        event: {
          select: {
            status: true,
            post: { select: { authorId: true, status: true } },
          },
        },
        badge: { select: { id: true, status: true } },
      },
    });
    if (!application || application.event.post.status === PostStatus.DELETED) {
      throw new NotFoundException(
        `No application found with id ${applicationId}.`,
      );
    }
    if (application.userId !== userId) {
      throw new ForbiddenException(
        'You can only request a badge for your own application.',
      );
    }
    if (application.status !== ApplicationStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only accepted volunteers can request a badge.',
      );
    }
    if (application.event.status !== EventStatus.COMPLETED) {
      throw new BadRequestException(
        'Badges can be requested once the event is documented.',
      );
    }
    const existing = application.badge;
    if (existing && existing.status !== BadgeStatus.REJECTED) {
      throw new ConflictException(
        existing.status === BadgeStatus.REVOKED
          ? 'This badge was revoked.'
          : 'You already requested this badge.',
      );
    }

    const badgeId = await this.prisma.$transaction(async (tx) => {
      let id: number;
      if (existing) {
        await tx.badge.update({
          where: { id: existing.id },
          data: {
            status: BadgeStatus.REQUESTED,
            description: '',
            decidedById: null,
            decidedAt: null,
          },
        });
        id = existing.id;
      } else {
        try {
          const created = await tx.badge.create({
            data: {
              applicationId,
              eventId: application.eventId,
              userId,
            },
            select: { id: true },
          });
          id = created.id;
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new ConflictException('You already requested this badge.');
          }
          throw error;
        }
      }
      await this.notifications.create(
        {
          recipientId: application.event.post.authorId,
          actorId: userId,
          type: NotificationType.BADGE_REQUESTED,
          postId: application.eventId,
          data: { badgeId: id, applicationId },
        },
        tx,
      );
      return id;
    });
    this.logger.log(`Badge ${badgeId} requested by user ${userId}.`);
    return this.findView(badgeId);
  }

  async approve(userId: number, id: number, dto: ApproveBadgeDto) {
    const badge = await this.findForOrganizer(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.badge.update({
        where: { id },
        data: {
          status: BadgeStatus.APPROVED,
          description: dto.description ?? '',
          decidedById: userId,
          decidedAt: new Date(),
        },
      });
      await this.notifyDecision(tx, userId, badge, BadgeStatus.APPROVED);
    });
    this.logger.log(`Badge ${id} approved by user ${userId}.`);
    return this.findView(id);
  }

  async reject(userId: number, id: number) {
    const badge = await this.findForOrganizer(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.badge.update({
        where: { id },
        data: {
          status: BadgeStatus.REJECTED,
          decidedById: userId,
          decidedAt: new Date(),
        },
      });
      await this.notifyDecision(tx, userId, badge, BadgeStatus.REJECTED);
    });
    this.logger.log(`Badge ${id} rejected by user ${userId}.`);
    return this.findView(id);
  }

  /** The holder shows or hides an approved badge on their profile. */
  async setShown(userId: number, id: number, isShownOnProfile: boolean) {
    const badge = await this.prisma.badge.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!badge) throw new NotFoundException(`No badge found with id ${id}.`);
    if (badge.userId !== userId) {
      throw new ForbiddenException('You can only change your own badges.');
    }
    await this.prisma.badge.update({
      where: { id },
      data: { isShownOnProfile },
    });
    this.logger.log(`Badge ${id} visibility set to ${isShownOnProfile}.`);
    return this.findView(id);
  }

  /** The caller's badges in every state. */
  findMine(userId: number, query: FindBadgesQueryDto) {
    return this.list({ userId, ...this.statusFilter(query) }, query);
  }

  /** What the public sees on a profile: approved badges the holder shows. */
  findForUser(userId: number, query: FindBadgesQueryDto) {
    return this.list(
      { userId, status: BadgeStatus.APPROVED, isShownOnProfile: true },
      query,
    );
  }

  /** Public lookup used by QR verification; hidden, revoked, or deleted badges stay private. */
  async verifyPublic(id: number) {
    const row = await this.prisma.badge.findFirst({
      where: {
        id,
        status: BadgeStatus.APPROVED,
        isShownOnProfile: true,
        event: { post: { status: { not: PostStatus.DELETED } } },
      },
      select: BADGE_SELECT,
    });
    if (!row) throw new NotFoundException('No public approved badge found.');
    return toBadgeView(row);
  }

  /** The organizer's queue for one event (requested first by default via `status`). */
  async findForEvent(
    userId: number,
    eventId: number,
    query: FindBadgesQueryDto,
  ) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: eventId,
        kind: 'EVENT',
        status: { not: PostStatus.DELETED },
      },
      select: { authorId: true },
    });
    if (!post) {
      throw new NotFoundException(`No event found with id ${eventId}.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the event organizer can see its badge requests.',
      );
    }
    return this.list({ eventId, ...this.statusFilter(query) }, query);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private statusFilter(query: FindBadgesQueryDto) {
    return query.status ? { status: query.status } : {};
  }

  private async list(where: Prisma.BadgeWhereInput, query: FindBadgesQueryDto) {
    const scoped: Prisma.BadgeWhereInput = {
      ...where,
      event: { post: { status: { not: PostStatus.DELETED } } },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.badge.count({ where: scoped }),
      this.prisma.badge.findMany({
        where: scoped,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: BADGE_SELECT,
      }),
    ]);
    return paginated(rows.map(toBadgeView), total, query);
  }

  private async findView(id: number) {
    const row = await this.prisma.badge.findUniqueOrThrow({
      where: { id },
      select: BADGE_SELECT,
    });
    return toBadgeView(row);
  }

  /** A REQUESTED badge of a COMPLETED event organized by the caller. */
  private async findForOrganizer(userId: number, id: number) {
    const badge = await this.prisma.badge.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        eventId: true,
        status: true,
        event: {
          select: {
            status: true,
            post: {
              select: {
                authorId: true,
                status: true,
                author: { select: { isSuspended: true } },
              },
            },
          },
        },
      },
    });
    if (!badge || badge.event.post.status === PostStatus.DELETED) {
      throw new NotFoundException(`No badge found with id ${id}.`);
    }
    if (badge.event.post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the event organizer can decide its badges.',
      );
    }
    if (badge.event.post.author.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
    if (badge.status !== BadgeStatus.REQUESTED) {
      throw new BadRequestException('Only requested badges can be decided.');
    }
    if (badge.event.status !== EventStatus.COMPLETED) {
      throw new BadRequestException(
        'Badges can only be decided for a completed event.',
      );
    }
    return badge;
  }

  private notifyDecision(
    tx: Prisma.TransactionClient,
    organizerId: number,
    badge: { id: number; userId: number; eventId: number },
    status: BadgeStatus,
  ) {
    return this.notifications.create(
      {
        recipientId: badge.userId,
        actorId: organizerId,
        type: NotificationType.BADGE_DECIDED,
        postId: badge.eventId,
        data: { badgeId: badge.id, status },
      },
      tx,
    );
  }
}
