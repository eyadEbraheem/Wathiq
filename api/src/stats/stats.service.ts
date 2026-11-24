import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  STATS_MIN_GROUP,
  type StatsDemand,
  type StatsReport,
  type StatsSignal,
  type StatsTotals,
} from '@csh/shared';
import {
  ApplicationStatus,
  EventStatus,
  PostStatus,
  type Governorate,
  type Prisma,
} from '@prisma/client';
import { ageOn } from 'src/common/utils/age';
import { sumImpact } from 'src/organizers/impact';
import { PrismaService } from 'src/prisma/prisma.service';
import type { StatsQueryDto } from 'src/stats/dto/stats-query.dto';

const DAY = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<StatsQueryDto['period'], number | null> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
  all: null,
};
/** Below this many past campaigns a governorate gets no signal (too little to judge). */
const SIGNAL_MIN_CAMPAIGNS = 3;
const DAMASCUS_OFFSET = 3 * 60 * 60 * 1000;

interface Scope {
  /** Only this organizer's campaigns (its own report). */
  organizerId?: number;
}

/** One campaign with everything the report needs. */
interface Row {
  id: number;
  title: string;
  status: EventStatus;
  startsAt: Date;
  documentedAt: Date | null;
  governorate: Governorate;
  city: string;
  capacity: number | null;
  hours: number;
  sectionId: number;
  topicIds: number[];
  authorId: number;
  authorName: string;
  authorKind: string | null;
  upvotes: number;
  comments: number;
  impact: { label: string; normalized: string; value: number }[];
  pending: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
}

const month = (d: Date) =>
  new Date(d.getTime() + DAMASCUS_OFFSET).toISOString().slice(0, 7);
const ratio = (a: number, b: number) =>
  b > 0 ? Math.round((a / b) * 100) / 100 : null;
/** Small groups are hidden so no person can be picked out of the numbers. */
const safe = (n: number) => (n >= STATS_MIN_GROUP ? n : null);

/**
 * Statistics of campaigns (events): what runs most, what people ask for and where help is
 * missing. Admins get the whole platform; a verified account gets its own campaigns. Only
 * numbers leave the service (no names of volunteers), and groups smaller than 5 are hidden.
 */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** A verified account's own report (403 for everyone else). */
  async forOrganizer(userId: number, query: StatsQueryDto) {
    await this.requireOrganizer(userId);
    return this.report({ organizerId: userId }, query);
  }

  forPlatform(query: StatsQueryDto) {
    return this.report({}, query);
  }

  async csvForOrganizer(userId: number, query: StatsQueryDto) {
    await this.requireOrganizer(userId);
    return this.csv({ organizerId: userId }, query);
  }

  csvForPlatform(query: StatsQueryDto) {
    return this.csv({}, query);
  }

  // ── Report ───────────────────────────────────────────────────────────────

  private async report(
    scope: Scope,
    query: StatsQueryDto,
  ): Promise<StatsReport> {
    const now = new Date();
    const days = PERIOD_DAYS[query.period];
    const from = days ? new Date(now.getTime() - days * DAY) : null;
    const platform = scope.organizerId === undefined;

    const rows = await this.rows(scope, query, from, null);
    const past = rows.filter(
      (r) => r.startsAt < now && r.status !== EventStatus.CANCELLED,
    );
    const completed = rows.filter((r) => r.status === EventStatus.COMPLETED);

    const sections = await this.prisma.section.findMany({
      include: { topics: true },
      orderBy: { sortOrder: 'asc' },
    });
    const accepted = await this.accepted(completed.map((r) => r.id));
    const firsts = await this.firstCampaigns([
      ...new Set(accepted.map((a) => a.userId)),
    ]);

    const totals = this.totals(
      rows,
      completed,
      accepted,
      firsts,
      scope,
      from,
      now,
    );
    let previous: StatsTotals | null = null;
    if (from && days) {
      const before = new Date(from.getTime() - days * DAY);
      const prevRows = await this.rows(scope, query, before, from);
      const prevCompleted = prevRows.filter(
        (r) => r.status === EventStatus.COMPLETED,
      );
      const prevAccepted = await this.accepted(prevCompleted.map((r) => r.id));
      const prevFirsts = await this.firstCampaigns([
        ...new Set(prevAccepted.map((a) => a.userId)),
      ]);
      previous = this.totals(
        prevRows,
        prevCompleted,
        prevAccepted,
        prevFirsts,
        scope,
        before,
        from,
      );
    }

    // Per month (completed campaigns).
    const hoursOf = new Map(completed.map((r) => [r.id, r.hours]));
    const monthly = new Map<
      string,
      { campaigns: number; volunteers: number; hours: number }
    >();
    for (const r of completed) {
      const m = monthly.get(month(r.startsAt)) ?? {
        campaigns: 0,
        volunteers: 0,
        hours: 0,
      };
      m.campaigns += 1;
      m.volunteers += r.accepted;
      m.hours += r.accepted * (hoursOf.get(r.id) ?? 0);
      monthly.set(month(r.startsAt), m);
    }
    // Every month from the first to the last one, empty months as zero (gaps must show).
    const known = [...monthly.keys()].sort();
    const byMonth: StatsReport['byMonth'] = [];
    if (known.length) {
      const [y0, m0] = known[0].split('-').map(Number);
      const last = known[known.length - 1];
      for (let i = 0; ; i++) {
        const key = new Date(Date.UTC(y0, m0 - 1 + i, 1))
          .toISOString()
          .slice(0, 7);
        byMonth.push({
          month: key,
          ...(monthly.get(key) ?? { campaigns: 0, volunteers: 0, hours: 0 }),
        });
        if (key === last) break;
      }
    }

    const bySection = sections
      .map((s) => ({
        sectionId: s.id,
        slug: s.slug,
        nameAr: s.nameAr,
        ...this.demand(past.filter((r) => r.sectionId === s.id)),
      }))
      .filter((s) => s.campaigns > 0);

    const byTopic = sections
      .flatMap((s) =>
        s.topics.map((t) => ({
          topicId: t.id,
          nameAr: t.nameAr,
          sectionSlug: s.slug,
          ...this.demand(past.filter((r) => r.topicIds.includes(t.id))),
        })),
      )
      .filter((t) => t.campaigns > 0)
      .sort((a, b) => b.campaigns - a.campaigns);

    const byGovernorate = await this.governorates(past, platform, from);

    // Volunteers: first-timers vs returning, ages, education.
    const perUser = new Map<number, number>();
    for (const a of accepted)
      perUser.set(a.userId, (perUser.get(a.userId) ?? 0) + 1);
    // Two separate numbers (a person can be in both): their first completed campaign on the
    // platform is one of these, and they took part in two or more of these.
    const scopeIds = new Set(completed.map((r) => r.id));
    const firstTime = [...perUser.keys()].filter((u) =>
      scopeIds.has(firsts.get(u)?.eventId ?? -1),
    ).length;
    const returning = [...perUser.values()].filter((n) => n > 1).length;
    const people = await this.prisma.user.findMany({
      where: { id: { in: [...perUser.keys()] } },
      select: {
        birthDate: true,
        educationLevel: true,
        showAge: true,
        showEducation: true,
      },
    });
    const ages = { '13-17': 0, '18-24': 0, '25-34': 0, '35+': 0, hidden: 0 };
    const education = new Map<string, number>();
    for (const p of people) {
      const age = ageOn(p.birthDate, now);
      // An organizer only sees what each person chose to show (and nothing under 18).
      const ageVisible = platform || (p.showAge && age >= 18);
      const eduVisible = platform || (p.showEducation && age >= 18);
      const group = !ageVisible
        ? 'hidden'
        : age < 18
          ? '13-17'
          : age < 25
            ? '18-24'
            : age < 35
              ? '25-34'
              : '35+';
      ages[group] += 1;
      const level = eduVisible ? (p.educationLevel ?? 'UNKNOWN') : 'HIDDEN';
      education.set(level, (education.get(level) ?? 0) + 1);
    }

    const ratingRows = await this.prisma.eventRating.findMany({
      where: { eventId: { in: completed.map((r) => r.id) } },
      select: { stars: true, organizerId: true },
    });
    const distribution = [1, 2, 3, 4, 5].map(
      (s) => ratingRows.filter((r) => r.stars === s).length,
    );
    const average = ratingRows.length
      ? Math.round(
          (ratingRows.reduce((a, r) => a + r.stars, 0) / ratingRows.length) *
            10,
        ) / 10
      : null;

    return {
      scope: platform ? 'platform' : 'organizer',
      period: {
        key: query.period,
        from: from?.toISOString() ?? null,
        to: now.toISOString(),
      },
      filters: {
        governorate: query.governorate ?? null,
        sectionId: query.sectionId ?? null,
      },
      totals,
      previous,
      byMonth,
      bySection,
      byTopic,
      byGovernorate,
      impact: sumImpact(completed.flatMap((r) => r.impact)),
      volunteers: {
        firstTime,
        returning,
        ageGroups: (Object.keys(ages) as (keyof typeof ages)[])
          .filter((g) => g !== 'hidden' || !platform)
          .map((group) => ({ group, count: safe(ages[group]) })),
        education: [...education.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([level, count]) => ({ level, count: safe(count) })),
      },
      ratings: { average, count: ratingRows.length, distribution },
      topOrganizers: platform
        ? this.topOrganizers(completed, accepted, firsts, ratingRows)
        : null,
      requests: platform ? await this.requests(query, from) : null,
    };
  }

  private totals(
    rows: Row[],
    completed: Row[],
    accepted: { eventId: number; userId: number }[],
    firsts: Map<number, { eventId: number; at: Date; authorId: number }>,
    scope: Scope,
    from: Date | null,
    to: Date,
  ): StatsTotals {
    const hours = new Map(completed.map((r) => [r.id, r.hours]));
    const volunteers = new Set(accepted.map((a) => a.userId));
    const inScope = new Set(completed.map((r) => r.id));
    const newVolunteers = [...volunteers].filter((u) => {
      const f = firsts.get(u);
      return (
        f !== undefined &&
        inScope.has(f.eventId) &&
        (!from || f.at >= from) &&
        f.at < to
      );
    }).length;
    return {
      campaigns: rows.length,
      completed: completed.length,
      cancelled: rows.filter((r) => r.status === EventStatus.CANCELLED).length,
      upcoming: rows.filter(
        (r) => r.startsAt >= to && r.status !== EventStatus.CANCELLED,
      ).length,
      volunteers: volunteers.size,
      newVolunteers,
      volunteerHours: accepted.reduce(
        (a, x) => a + (hours.get(x.eventId) ?? 0),
        0,
      ),
      organizers: scope.organizerId
        ? 1
        : new Set(completed.map((r) => r.authorId)).size,
    };
  }

  /** Demand numbers of a group of past, not cancelled campaigns. */
  private demand(rows: Row[]): StatsDemand {
    const done = rows.filter((r) => r.status === EventStatus.COMPLETED);
    const seatsOf = (r: Row) => r.capacity ?? r.accepted;
    const seats = rows.reduce((a, r) => a + seatsOf(r), 0);
    const accepted = rows.reduce((a, r) => a + r.accepted, 0);
    const applicants = rows.reduce(
      (a, r) => a + r.pending + r.accepted + r.rejected,
      0,
    );
    return {
      campaigns: rows.length,
      completed: done.length,
      applicants,
      seats,
      accepted,
      rejected: rows.reduce((a, r) => a + r.rejected, 0),
      unfilledSeats: done.reduce(
        (a, r) => a + Math.max(0, seatsOf(r) - r.accepted),
        0,
      ),
      applicantsPerSeat: ratio(applicants, seats),
      fillRate: ratio(accepted, seats),
      upvotesPerCampaign: rows.length
        ? Math.round(
            (rows.reduce((a, r) => a + r.upvotes, 0) / rows.length) * 10,
          ) / 10
        : null,
    };
  }

  /**
   * Per governorate, with a signal where help is missing, judged against the whole report so
   * it works at any size:
   * - NEEDS_CAMPAIGNS: many people ready to volunteer for each campaign there (platform: people
   *   living there per campaign; organizer: applicants per seat), at least 1.5× the overall.
   * - NEEDS_VOLUNTEERS: seats filled clearly less than overall (8 points or more below).
   * Governorates with fewer than 3 past campaigns get no signal, except a platform governorate
   * with people living there and no campaign at all (it needs campaigns).
   */
  private async governorates(
    past: Row[],
    platform: boolean,
    from: Date | null,
  ) {
    const govs = [...new Set(past.map((r) => r.governorate))];
    const extra = platform ? await this.governorateExtras(from) : null;
    if (extra)
      for (const g of extra.keys()) if (!govs.includes(g)) govs.push(g);
    const overall = this.demand(past);
    const people = (g: Governorate) => extra?.get(g)?.volunteers ?? 0;
    const totalPeople = govs.reduce((a, g) => a + people(g), 0);
    const overallReady = platform
      ? ratio(totalPeople, Math.max(1, past.length))
      : overall.applicantsPerSeat;
    return govs
      .map((governorate) => {
        const d = this.demand(
          past.filter((r) => r.governorate === governorate),
        );
        const peoplePerCampaign = platform
          ? ratio(people(governorate), Math.max(1, d.campaigns))
          : null;
        const ready = platform ? peoplePerCampaign : d.applicantsPerSeat;
        let signal: StatsSignal = null;
        if (platform && d.campaigns === 0 && people(governorate) >= 5) {
          signal = 'NEEDS_CAMPAIGNS';
        } else if (d.campaigns >= SIGNAL_MIN_CAMPAIGNS) {
          if (ready !== null && overallReady && ready >= overallReady * 1.5) {
            signal = 'NEEDS_CAMPAIGNS';
          } else if (
            d.fillRate !== null &&
            overall.fillRate !== null &&
            d.fillRate <= overall.fillRate - 0.08
          ) {
            signal = 'NEEDS_VOLUNTEERS';
          }
        }
        const e = extra?.get(governorate);
        return {
          governorate,
          ...d,
          registeredVolunteers: platform ? (e?.volunteers ?? 0) : null,
          peoplePerCampaign,
          organizers: platform ? (e?.organizers ?? 0) : null,
          cases: platform ? (e?.cases ?? 0) : null,
          publishRequests: platform ? (e?.requests ?? 0) : null,
          signal,
        };
      })
      .sort(
        (a, b) =>
          b.campaigns - a.campaigns ||
          (b.registeredVolunteers ?? 0) - (a.registeredVolunteers ?? 0),
      );
  }

  /** Platform only: people and organizers living in each governorate, cases and requests. */
  private async governorateExtras(from: Date | null) {
    const alive = { deletedAt: null, isSuspended: false };
    const since = from ? { gte: from } : undefined;
    const [volunteers, organizers, cases, requests] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['governorate'],
        where: {
          ...alive,
          verifiedKind: null,
          pendingOrganization: false,
          role: 'USER',
        },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['governorate'],
        where: { ...alive, verifiedKind: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.post.findMany({
        where: {
          status: PostStatus.PUBLISHED,
          caseDetails: { isNot: null },
          createdAt: since,
        },
        select: { author: { select: { governorate: true } } },
      }),
      this.prisma.publishRequest.findMany({
        where: { createdAt: since },
        select: { requester: { select: { governorate: true } } },
      }),
    ]);
    const map = new Map<
      Governorate,
      {
        volunteers: number;
        organizers: number;
        cases: number;
        requests: number;
      }
    >();
    const get = (g: Governorate) => {
      let v = map.get(g);
      if (!v)
        map.set(
          g,
          (v = { volunteers: 0, organizers: 0, cases: 0, requests: 0 }),
        );
      return v;
    };
    for (const v of volunteers)
      if (v.governorate) get(v.governorate).volunteers = v._count._all;
    for (const o of organizers)
      if (o.governorate) get(o.governorate).organizers = o._count._all;
    for (const c of cases)
      if (c.author.governorate) get(c.author.governorate).cases += 1;
    for (const r of requests)
      if (r.requester.governorate) get(r.requester.governorate).requests += 1;
    return map;
  }

  private topOrganizers(
    completed: Row[],
    accepted: { eventId: number; userId: number }[],
    firsts: Map<number, { eventId: number; at: Date; authorId: number }>,
    ratings: { stars: number; organizerId: number }[],
  ) {
    const byAuthor = new Map<
      number,
      {
        name: string;
        kind: string | null;
        events: Set<number>;
        people: Set<number>;
      }
    >();
    const authorOf = new Map(completed.map((r) => [r.id, r.authorId]));
    for (const r of completed) {
      const o = byAuthor.get(r.authorId) ?? {
        name: r.authorName,
        kind: r.authorKind,
        events: new Set(),
        people: new Set(),
      };
      o.events.add(r.id);
      byAuthor.set(r.authorId, o);
    }
    for (const a of accepted)
      byAuthor.get(authorOf.get(a.eventId) ?? -1)?.people.add(a.userId);
    return [...byAuthor.entries()]
      .map(([id, o]) => {
        const mine = ratings.filter((r) => r.organizerId === id);
        return {
          id,
          name: o.name,
          verifiedKind: o.kind,
          completed: o.events.size,
          volunteers: o.people.size,
          newVolunteers: [...o.people].filter((u) =>
            o.events.has(firsts.get(u)?.eventId ?? -1),
          ).length,
          ratingAverage: mine.length
            ? Math.round(
                (mine.reduce((a, r) => a + r.stars, 0) / mine.length) * 10,
              ) / 10
            : null,
          ratingCount: mine.length,
        };
      })
      .sort((a, b) => b.completed - a.completed || b.volunteers - a.volunteers)
      .slice(0, 10);
  }

  /** Platform only: publish requests per section and humanitarian cases per topic. */
  private async requests(query: StatsQueryDto, from: Date | null) {
    const since = from ? { gte: from } : undefined;
    const sectionFilter = query.sectionId ? { sectionId: query.sectionId } : {};
    const [sections, requests, cases] = await Promise.all([
      this.prisma.section.findMany({
        select: { id: true, nameAr: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.publishRequest.groupBy({
        by: ['sectionId', 'status'],
        where: { createdAt: since, ...sectionFilter },
        _count: { _all: true },
      }),
      this.prisma.post.findMany({
        where: {
          status: PostStatus.PUBLISHED,
          caseDetails: { isNot: null },
          createdAt: since,
          ...(query.governorate
            ? { author: { governorate: query.governorate } }
            : {}),
        },
        select: {
          topics: { select: { topic: { select: { id: true, nameAr: true } } } },
        },
      }),
    ]);
    const byTopic = new Map<number | null, { nameAr: string; total: number }>();
    for (const c of cases) {
      const t = c.topics[0]?.topic;
      const key = t?.id ?? null;
      const e = byTopic.get(key) ?? {
        nameAr: t?.nameAr ?? 'بلا موضوع',
        total: 0,
      };
      e.total += 1;
      byTopic.set(key, e);
    }
    return {
      publishRequestsBySection: sections
        .map((s) => {
          const mine = requests.filter((r) => r.sectionId === s.id);
          return {
            sectionId: s.id,
            nameAr: s.nameAr,
            total: mine.reduce((a, r) => a + r._count._all, 0),
            approved: mine
              .filter((r) => r.status === 'APPROVED')
              .reduce((a, r) => a + r._count._all, 0),
          };
        })
        .filter((s) => s.total > 0),
      casesByTopic: [...byTopic.entries()]
        .map(([topicId, v]) => ({ topicId, ...v }))
        .sort((a, b) => b.total - a.total),
    };
  }

  // ── CSV ──────────────────────────────────────────────────────────────────

  /**
   * One campaign per line, for Excel / SPSS: no names of people. UTF-8 with a BOM so Excel
   * shows Arabic, CRLF line ends.
   */
  private async csv(scope: Scope, query: StatsQueryDto): Promise<string> {
    const days = PERIOD_DAYS[query.period];
    const from = days ? new Date(Date.now() - days * DAY) : null;
    const rows = await this.rows(scope, query, from, null);
    const [sections, topics, ratings] = await Promise.all([
      this.prisma.section.findMany({ select: { id: true, slug: true } }),
      this.prisma.topic.findMany({ select: { id: true, slug: true } }),
      this.prisma.eventRating.groupBy({
        by: ['eventId'],
        where: { eventId: { in: rows.map((r) => r.id) } },
        _avg: { stars: true },
        _count: { _all: true },
      }),
    ]);
    const sectionSlug = new Map(sections.map((s) => [s.id, s.slug]));
    const topicSlug = new Map(
      topics.map((t) => [t.id, t.slug.split('--')[1] ?? t.slug]),
    );
    const rating = new Map(ratings.map((r) => [r.eventId, r]));
    const header = [
      'event_id',
      'title',
      'section',
      'topics',
      'governorate',
      'city',
      ...(scope.organizerId ? [] : ['organizer_id', 'organizer']),
      'starts_at',
      'month',
      'status',
      'seats',
      'applicants',
      'accepted',
      'rejected',
      'withdrawn',
      'hours_per_volunteer',
      'volunteer_hours',
      'upvotes',
      'comments',
      'rating_avg',
      'rating_count',
      'impact',
    ];
    const cell = (v: string | number | null) => {
      const s = v === null ? '' : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) => {
      const rt = rating.get(r.id);
      return [
        r.id,
        r.title,
        sectionSlug.get(r.sectionId) ?? '',
        r.topicIds.map((t) => topicSlug.get(t)).join('|'),
        r.governorate,
        r.city,
        ...(scope.organizerId ? [] : [r.authorId, r.authorName]),
        r.startsAt.toISOString(),
        month(r.startsAt),
        r.status,
        r.capacity ?? '',
        r.pending + r.accepted + r.rejected,
        r.accepted,
        r.rejected,
        r.withdrawn,
        r.hours,
        r.status === EventStatus.COMPLETED ? r.accepted * r.hours : 0,
        r.upvotes,
        r.comments,
        rt?._avg.stars !== undefined && rt._avg.stars !== null
          ? Math.round(rt._avg.stars * 100) / 100
          : '',
        rt?._count._all ?? 0,
        r.impact.map((m) => `${m.label}:${m.value}`).join('|'),
      ]
        .map(cell)
        .join(',');
    });
    this.logger.log(
      `CSV export: ${rows.length} campaigns (${scope.organizerId ? `organizer ${scope.organizerId}` : 'platform'}).`,
    );
    return `﻿${[header.join(','), ...lines].join('\r\n')}\r\n`;
  }

  // ── Data ─────────────────────────────────────────────────────────────────

  private async requireOrganizer(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedKind: true, deletedAt: true },
    });
    if (!user || user.deletedAt)
      throw new NotFoundException(`No user found with id ${userId}.`);
    if (!user.verifiedKind) {
      throw new ForbiddenException(
        'Only verified accounts have campaign statistics.',
      );
    }
  }

  /** Campaigns starting in [from, to) that match the filters, with their application counts. */
  private async rows(
    scope: Scope,
    query: StatsQueryDto,
    from: Date | null,
    to: Date | null,
  ): Promise<Row[]> {
    const where: Prisma.EventWhereInput = {
      ...(from || to
        ? {
            startsAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lt: to } : {}),
            },
          }
        : {}),
      ...(query.governorate ? { governorate: query.governorate } : {}),
      post: {
        status: { not: PostStatus.DELETED },
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(scope.organizerId ? { authorId: scope.organizerId } : {}),
      },
    };
    const events = await this.prisma.event.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      select: {
        postId: true,
        status: true,
        startsAt: true,
        documentedAt: true,
        governorate: true,
        city: true,
        capacity: true,
        volunteerHours: true,
        impactMetrics: {
          select: { label: true, normalized: true, value: true },
        },
        post: {
          select: {
            title: true,
            sectionId: true,
            authorId: true,
            upvoteCount: true,
            commentCount: true,
            author: { select: { name: true, verifiedKind: true } },
            topics: { select: { topicId: true } },
          },
        },
      },
    });
    const counts = await this.prisma.eventApplication.groupBy({
      by: ['eventId', 'status'],
      where: { eventId: { in: events.map((e) => e.postId) } },
      _count: { _all: true },
    });
    const count = (eventId: number, status: ApplicationStatus) =>
      counts.find((c) => c.eventId === eventId && c.status === status)?._count
        ._all ?? 0;
    return events.map((e) => ({
      id: e.postId,
      title: e.post.title,
      status: e.status,
      startsAt: e.startsAt,
      documentedAt: e.documentedAt,
      governorate: e.governorate,
      city: e.city,
      capacity: e.capacity,
      hours: e.volunteerHours,
      sectionId: e.post.sectionId,
      topicIds: e.post.topics.map((t) => t.topicId),
      authorId: e.post.authorId,
      authorName: e.post.author.name,
      authorKind: e.post.author.verifiedKind,
      upvotes: e.post.upvoteCount,
      comments: e.post.commentCount,
      impact: e.impactMetrics,
      pending: count(e.postId, ApplicationStatus.PENDING),
      accepted: count(e.postId, ApplicationStatus.ACCEPTED),
      rejected: count(e.postId, ApplicationStatus.REJECTED),
      withdrawn: count(e.postId, ApplicationStatus.WITHDRAWN),
    }));
  }

  private accepted(eventIds: number[]) {
    return this.prisma.eventApplication.findMany({
      where: { eventId: { in: eventIds }, status: ApplicationStatus.ACCEPTED },
      select: { eventId: true, userId: true },
    });
  }

  /** Each person's first completed campaign on the whole platform (by documentation date). */
  private async firstCampaigns(userIds: number[]) {
    const rows = await this.prisma.eventApplication.findMany({
      where: {
        userId: { in: userIds },
        status: ApplicationStatus.ACCEPTED,
        event: {
          status: EventStatus.COMPLETED,
          documentedAt: { not: null },
          post: { status: { not: PostStatus.DELETED } },
        },
      },
      select: {
        userId: true,
        eventId: true,
        event: {
          select: { documentedAt: true, post: { select: { authorId: true } } },
        },
      },
    });
    const firsts = new Map<
      number,
      { eventId: number; at: Date; authorId: number }
    >();
    for (const r of rows) {
      const at = r.event.documentedAt as Date;
      const seen = firsts.get(r.userId);
      if (
        !seen ||
        at < seen.at ||
        (at.getTime() === seen.at.getTime() && r.eventId < seen.eventId)
      ) {
        firsts.set(r.userId, {
          eventId: r.eventId,
          at,
          authorId: r.event.post.authorId,
        });
      }
    }
    return firsts;
  }
}
