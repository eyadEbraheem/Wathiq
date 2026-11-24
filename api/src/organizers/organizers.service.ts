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
  PostKind,
  PostStatus,
  type Prisma,
} from '@prisma/client';
import { normalizeArabic } from 'src/common/utils/arabic';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import type { FindSpecialtiesQueryDto } from 'src/organizers/dto/organizers.dto';
import { HighlightsService } from 'src/highlights/highlights.service';
import { sumImpact } from 'src/organizers/impact';
import { PrismaService } from 'src/prisma/prisma.service';
import { RatingsService } from 'src/ratings/ratings.service';

/** Verified accounts that are visible on the platform. */
export const LIVE_VERIFIED: Prisma.UserWhereInput = {
  verifiedKind: { not: null },
  deletedAt: null,
  isSuspended: false,
};

/**
 * Organizer profile numbers (completed events, accepted volunteers, impact totals, rating)
 * and organizer specialties.
 */
@Injectable()
export class OrganizersService {
  private readonly logger = new Logger(OrganizersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
    private readonly highlights: HighlightsService,
  ) {}

  async stats(viewerId: number, organizerId: number) {
    const organizer = await this.prisma.user.findUnique({
      where: { id: organizerId },
      select: { verifiedKind: true, deletedAt: true },
    });
    if (!organizer || organizer.deletedAt) {
      throw new NotFoundException(`No user found with id ${organizerId}.`);
    }
    if (!organizer.verifiedKind) {
      throw new BadRequestException('Only verified accounts organize events.');
    }
    const completed: Prisma.EventWhereInput = {
      status: EventStatus.COMPLETED,
      post: {
        authorId: organizerId,
        kind: PostKind.EVENT,
        status: { not: PostStatus.DELETED },
      },
    };
    const [
      completedEvents,
      acceptedVolunteers,
      metrics,
      rating,
      weeklyHighlights,
    ] = await Promise.all([
      this.prisma.event.count({ where: completed }),
      this.prisma.eventApplication.count({
        where: { status: ApplicationStatus.ACCEPTED, event: completed },
      }),
      this.prisma.eventImpactMetric.findMany({
        where: { event: completed },
        orderBy: { id: 'desc' },
        select: { label: true, normalized: true, value: true },
      }),
      this.ratings.summary(viewerId, organizerId),
      this.highlights.countWins(organizerId),
    ]);
    return {
      completedEvents,
      acceptedVolunteers,
      impact: sumImpact(metrics),
      rating,
      // Weeks this account was "organization of the week".
      weeklyHighlights,
    };
  }

  /** Replaces the caller's specialties; each name reuses an existing specialty when it matches. */
  async setSpecialties(userId: number, names: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedKind: true },
    });
    if (!user?.verifiedKind) {
      throw new ForbiddenException('Only verified accounts add specialties.');
    }
    const unique = new Map<string, string>();
    for (const name of names) {
      const normalized = normalizeArabic(name);
      if (normalized && !unique.has(normalized)) unique.set(normalized, name);
    }

    await this.prisma.$transaction(async (tx) => {
      const ids: number[] = [];
      for (const [normalized, name] of unique) {
        const specialty = await tx.specialty.upsert({
          where: { normalized },
          create: { name, normalized },
          update: {},
          select: { id: true },
        });
        ids.push(specialty.id);
      }
      await tx.userSpecialty.deleteMany({ where: { userId } });
      await tx.userSpecialty.createMany({
        data: ids.map((specialtyId) => ({ userId, specialtyId })),
      });
    });
    this.logger.log(`User ${userId} set ${unique.size} specialties.`);
    return this.mySpecialties(userId);
  }

  async mySpecialties(userId: number) {
    const data = await this.prisma.specialty.findMany({
      where: { users: { some: { userId } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return { data };
  }

  /**
   * Specialties of live verified accounts, most used first: suggestions while typing and the
   * value list of the accounts search.
   */
  async findSpecialties(query: FindSpecialtiesQueryDto) {
    const where: Prisma.SpecialtyWhereInput = {
      users: { some: { user: LIVE_VERIFIED } },
      ...(query.q
        ? { normalized: { contains: normalizeArabic(query.q) } }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.specialty.count({ where }),
      this.prisma.specialty.findMany({
        where,
        orderBy: [{ users: { _count: 'desc' } }, { name: 'asc' }],
        ...pageArgs(query),
        select: {
          id: true,
          name: true,
          _count: { select: { users: { where: { user: LIVE_VERIFIED } } } },
        },
      }),
    ]);
    return paginated(
      rows.map(({ _count, ...row }) => ({ ...row, accounts: _count.users })),
      total,
      query,
    );
  }
}
