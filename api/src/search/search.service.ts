import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  EventStatus,
  type Governorate,
  PostStatus,
  type Prisma,
  VerifiedKind,
} from '@prisma/client';
import { normalizeArabic } from 'src/common/utils/arabic';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { LIVE_VERIFIED } from 'src/organizers/organizers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  COUNTED_RATINGS,
  MIN_PUBLIC_RATINGS,
} from 'src/ratings/ratings.service';
import type {
  DirectoryQueryDto,
  SearchAccountsQueryDto,
  SearchPeopleQueryDto,
} from 'src/search/dto/search.dto';
import { toPublicProfile } from 'src/users/public-profile';
import { USER_CARD_SELECT } from 'src/users/user-card';

const ADULT_AGE = 18;

/**
 * A verified account's region is searchable when it is an organization (its address is
 * public) or a verified individual who shows their address.
 */
/** Upper bound for the in-memory directory sort. */
const DIRECTORY_MAX = 1000;

const REGION_VISIBLE: Prisma.UserWhereInput = {
  OR: [{ verifiedKind: VerifiedKind.ORGANIZATION }, { showAddress: true }],
};

const VOLUNTEERED: Prisma.UserWhereInput = {
  applications: {
    some: {
      status: ApplicationStatus.ACCEPTED,
      event: { status: EventStatus.COMPLETED },
    },
  },
};

/**
 * Two searches:
 * - everyone searches verified accounts by name, region and specialty;
 * - verified accounts search people. A filter only matches a field the person made visible,
 *   and under-18 optional fields never match. People appear only with `showInSearch` on.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async accounts(query: SearchAccountsQueryDto) {
    const and: Prisma.UserWhereInput[] = [LIVE_VERIFIED];
    if (query.q) {
      and.push({ searchName: { contains: normalizeArabic(query.q) } });
    }
    if (query.governorate || query.city) {
      and.push(REGION_VISIBLE);
      if (query.governorate) and.push({ governorate: query.governorate });
      if (query.city) {
        and.push({ city: { equals: query.city, mode: 'insensitive' } });
      }
    }
    if (query.specialtyId) {
      and.push({ specialties: { some: { specialtyId: query.specialtyId } } });
    }
    const where: Prisma.UserWhereInput = { AND: and };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ searchName: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: {
          ...USER_CARD_SELECT,
          bio: true,
          governorate: true,
          city: true,
          showAddress: true,
          specialties: {
            select: { specialty: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);
    return paginated(
      rows.map(({ governorate, city, showAddress, specialties, ...card }) => {
        const regionShown =
          card.verifiedKind === VerifiedKind.ORGANIZATION || showAddress;
        return {
          ...card,
          region: regionShown && governorate ? { governorate, city } : null,
          specialties: specialties.map((s) => s.specialty),
        };
      }),
      total,
      query,
    );
  }

  /**
   * The directory of verified accounts (organizations and individuals). An account belongs to a
   * section when it chose it as an interest or has published in it (posts or events), so it
   * appears there even if it skipped onboarding. Best public rating first (average, then
   * count); accounts without a public average follow, most completed events first. A hidden or
   * not-yet-public average never affects the order, so the order never leaks it. Built in
   * memory: verified accounts are a short list (capped at DIRECTORY_MAX).
   */
  async directory(query: DirectoryQueryDto) {
    const rows = await this.prisma.user.findMany({
      where: LIVE_VERIFIED,
      orderBy: [{ searchName: 'asc' }, { id: 'asc' }],
      take: DIRECTORY_MAX,
      select: {
        ...USER_CARD_SELECT,
        bio: true,
        governorate: true,
        city: true,
        showAddress: true,
        hideRating: true,
        interests: { select: { sectionId: true } },
        posts: {
          where: { status: { not: PostStatus.DELETED } },
          distinct: ['sectionId'],
          select: { sectionId: true },
        },
        specialties: {
          select: { specialty: { select: { id: true, name: true } } },
        },
      },
    });
    const ids = rows.map((r) => r.id);
    const [ratings, events] = await Promise.all([
      this.prisma.eventRating.groupBy({
        by: ['organizerId'],
        where: { organizerId: { in: ids }, ...COUNTED_RATINGS },
        _avg: { stars: true },
        _count: { _all: true },
      }),
      this.prisma.post.groupBy({
        by: ['authorId'],
        where: {
          authorId: { in: ids },
          kind: 'EVENT',
          status: { not: PostStatus.DELETED },
          event: { status: EventStatus.COMPLETED },
        },
        _count: { _all: true },
      }),
    ]);
    const ratingOf = new Map(ratings.map((r) => [r.organizerId, r]));
    const eventsOf = new Map(events.map((e) => [e.authorId, e._count._all]));

    const all = rows.map(
      ({
        governorate,
        city,
        showAddress,
        hideRating,
        interests,
        posts,
        specialties,
        ...card
      }) => {
        const agg = ratingOf.get(card.id);
        const count = agg?._count._all ?? 0;
        const isPublic =
          !hideRating && count >= MIN_PUBLIC_RATINGS && agg?._avg.stars != null;
        const regionShown =
          card.verifiedKind === VerifiedKind.ORGANIZATION || showAddress;
        const sectionIds = [
          ...new Set([
            ...interests.map((i) => i.sectionId),
            ...posts.map((p) => p.sectionId),
          ]),
        ].sort((a, b) => a - b);
        return {
          ...card,
          region: regionShown && governorate ? { governorate, city } : null,
          specialties: specialties.map((s) => s.specialty),
          sectionIds,
          completedEvents: eventsOf.get(card.id) ?? 0,
          rating: {
            hidden: hideRating,
            average: isPublic
              ? Math.round((agg?._avg.stars ?? 0) * 10) / 10
              : null,
            count: isPublic ? count : null,
          },
        };
      },
    );

    // How many accounts each section has (for the section filter).
    const perSection = new Map<number, number>();
    for (const a of all) {
      for (const id of a.sectionIds) {
        perSection.set(id, (perSection.get(id) ?? 0) + 1);
      }
    }
    const sectionId = query.sectionId;
    const accounts = sectionId
      ? all.filter((a) => a.sectionIds.includes(sectionId))
      : all;
    accounts.sort(
      (a, b) =>
        (b.rating.average ?? -1) - (a.rating.average ?? -1) ||
        (b.rating.count ?? 0) - (a.rating.count ?? 0) ||
        b.completedEvents - a.completedEvents,
    );
    const { skip, take } = pageArgs(query);
    return {
      ...paginated(accounts.slice(skip, skip + take), accounts.length, query),
      sections: [...perSection].map(([id, count]) => ({
        sectionId: id,
        count,
      })),
    };
  }

  /** The governorates and cities that verified accounts actually show (filter values). */
  async accountRegions() {
    const groups = await this.prisma.user.groupBy({
      by: ['governorate', 'city'],
      where: {
        AND: [LIVE_VERIFIED, REGION_VISIBLE, { governorate: { not: null } }],
      },
      _count: { _all: true },
      orderBy: [{ governorate: 'asc' }, { city: 'asc' }],
    });
    const byGovernorate = new Map<
      Governorate,
      {
        governorate: Governorate;
        accounts: number;
        cities: { city: string; accounts: number }[];
      }
    >();
    for (const group of groups) {
      if (!group.governorate) continue;
      let entry = byGovernorate.get(group.governorate);
      if (!entry) {
        entry = { governorate: group.governorate, accounts: 0, cities: [] };
        byGovernorate.set(group.governorate, entry);
      }
      entry.accounts += group._count._all;
      if (group.city) {
        entry.cities.push({ city: group.city, accounts: group._count._all });
      }
    }
    return { data: [...byGovernorate.values()] };
  }

  async people(viewerId: number, query: SearchPeopleQueryDto) {
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { verifiedKind: true, isSuspended: true },
    });
    if (!viewer?.verifiedKind || viewer.isSuspended) {
      throw new ForbiddenException('Only verified accounts can search people.');
    }

    // Born on or before this date = 18 or older today.
    const now = new Date();
    const adultCutoff = new Date(
      Date.UTC(
        now.getUTCFullYear() - ADULT_AGE,
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );
    const adult: Prisma.UserWhereInput = { birthDate: { lte: adultCutoff } };

    const and: Prisma.UserWhereInput[] = [
      {
        id: { not: viewerId },
        deletedAt: null,
        isSuspended: false,
        showInSearch: true,
        OR: [{ verifiedKind: null }, { verifiedKind: VerifiedKind.INDIVIDUAL }],
      },
    ];
    if (query.q) {
      and.push({ searchName: { contains: normalizeArabic(query.q) } });
    }
    if (query.governorate || query.city) {
      and.push(adult, { showAddress: true });
      if (query.governorate) and.push({ governorate: query.governorate });
      if (query.city) {
        and.push({ city: { equals: query.city, mode: 'insensitive' } });
      }
    }
    if (query.educationLevel || query.fieldOfStudy) {
      and.push(adult, { showEducation: true });
      if (query.educationLevel) {
        and.push({ educationLevel: query.educationLevel });
      }
      if (query.fieldOfStudy) {
        and.push({
          fieldOfStudy: { contains: query.fieldOfStudy, mode: 'insensitive' },
        });
      }
    }
    if (query.workField) {
      and.push(
        adult,
        { showWorkField: true },
        {
          workField: { contains: query.workField, mode: 'insensitive' },
        },
      );
    }
    if (query.hasVolunteered) and.push(VOLUNTEERED);
    if (query.sectionId) {
      and.push({ interests: { some: { sectionId: query.sectionId } } });
    }
    if (query.topicId) {
      and.push({ topicInterests: { some: { topicId: query.topicId } } });
    }

    const where: Prisma.UserWhereInput = { AND: and };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ searchName: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
        include: {
          _count: {
            select: {
              applications: {
                where: {
                  status: ApplicationStatus.ACCEPTED,
                  event: { status: EventStatus.COMPLETED },
                },
              },
            },
          },
        },
      }),
    ]);
    return paginated(
      rows.map(({ _count, ...user }) => ({
        ...toPublicProfile(user, now),
        completedVolunteering: _count.applications,
      })),
      total,
      query,
    );
  }
}
