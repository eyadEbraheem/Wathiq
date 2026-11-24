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
  PostStatus,
  type Prisma,
} from '@prisma/client';
import type { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

/** Ratings can be given or changed for this long after the event is documented. */
export const RATING_WINDOW_DAYS = 30;
/** The public average appears only from this many ratings. */
export const MIN_PUBLIC_RATINGS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Only ratings of events that are still COMPLETED count (a later cancellation drops them). */
export const COUNTED_RATINGS: Prisma.EventRatingWhereInput = {
  event: {
    status: EventStatus.COMPLETED,
    post: { status: { not: PostStatus.DELETED } },
  },
};

export interface RatingSummary {
  /** The organizer chose to hide the average ("rating hidden", not "no ratings"). */
  hidden: boolean;
  /** Fewer than MIN_PUBLIC_RATINGS ratings: the public sees no average yet. */
  enoughRatings: boolean;
  average: number | null;
  count: number | null;
}

/**
 * Organizer ratings: a volunteer ACCEPTED to a COMPLETED event gives the organizer 1 to 5
 * stars (no text), editable for 30 days after the documentation. The public sees only the
 * average and count, from 3 ratings up; the organizer sees who rated.
 */
@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Creates or changes the caller's rating for one participation. */
  async rate(userId: number, applicationId: number, stars: number) {
    const application = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: {
        userId: true,
        status: true,
        eventId: true,
        event: {
          select: {
            status: true,
            documentedAt: true,
            post: { select: { authorId: true, status: true } },
          },
        },
      },
    });
    if (!application || application.event.post.status === PostStatus.DELETED) {
      throw new NotFoundException(
        `No application found with id ${applicationId}.`,
      );
    }
    if (application.userId !== userId) {
      throw new ForbiddenException(
        'You can only rate events you took part in.',
      );
    }
    if (
      application.status !== ApplicationStatus.ACCEPTED ||
      application.event.status !== EventStatus.COMPLETED ||
      !application.event.documentedAt
    ) {
      throw new BadRequestException(
        'Only accepted volunteers of a completed event can rate its organizer.',
      );
    }
    const editableUntil = this.editableUntil(application.event.documentedAt);
    if (editableUntil <= new Date()) {
      throw new BadRequestException(
        `Ratings are locked ${RATING_WINDOW_DAYS} days after the event was documented.`,
      );
    }

    const rating = await this.prisma.eventRating.upsert({
      where: { applicationId },
      create: {
        applicationId,
        eventId: application.eventId,
        raterId: userId,
        organizerId: application.event.post.authorId,
        stars,
      },
      update: { stars },
      select: { id: true, stars: true, createdAt: true, updatedAt: true },
    });
    this.logger.log(
      `User ${userId} rated event ${application.eventId} with ${stars} stars.`,
    );
    return { ...rating, applicationId, editableUntil };
  }

  /** What a viewer sees of an organizer's rating. The organizer always sees its own. */
  async summary(viewerId: number, organizerId: number): Promise<RatingSummary> {
    const organizer = await this.prisma.user.findUnique({
      where: { id: organizerId },
      select: { hideRating: true },
    });
    const isOwner = viewerId === organizerId;
    if (!isOwner && organizer?.hideRating) {
      return { hidden: true, enoughRatings: false, average: null, count: null };
    }
    const agg = await this.prisma.eventRating.aggregate({
      where: { organizerId, ...COUNTED_RATINGS },
      _avg: { stars: true },
      _count: { _all: true },
    });
    const count = agg._count._all;
    const enoughRatings = count >= MIN_PUBLIC_RATINGS;
    const average =
      agg._avg.stars === null ? null : Math.round(agg._avg.stars * 10) / 10;
    if (!isOwner && !enoughRatings) {
      return { hidden: false, enoughRatings, average: null, count: null };
    }
    return {
      hidden: isOwner ? (organizer?.hideRating ?? false) : false,
      enoughRatings,
      average,
      count,
    };
  }

  /** The organizer's ratings with who gave them, newest first. */
  async received(organizerId: number, query: PaginationQueryDto) {
    const where: Prisma.EventRatingWhereInput = {
      organizerId,
      ...COUNTED_RATINGS,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.eventRating.count({ where }),
      this.prisma.eventRating.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: {
          id: true,
          stars: true,
          createdAt: true,
          updatedAt: true,
          rater: { select: USER_CARD_SELECT },
          event: {
            select: { postId: true, post: { select: { title: true } } },
          },
        },
      }),
    ]);
    return paginated(
      rows.map(({ event, ...row }) => ({
        ...row,
        event: { id: event.postId, title: event.post.title },
      })),
      total,
      query,
    );
  }

  private editableUntil(documentedAt: Date): Date {
    return new Date(documentedAt.getTime() + RATING_WINDOW_DAYS * DAY_MS);
  }
}
