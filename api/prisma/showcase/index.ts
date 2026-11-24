// Showcase seed (local demos only, SEED_SHOWCASE=true): a platform that looks a year and a half
// old. 20 made-up organizations and 5 verified individuals across all 14 governorates, ~260
// volunteers, ~150 campaigns with photos, applications, badges, ratings and impact numbers,
// plus posts, humanitarian cases, opportunities, comments, upvotes, follows and team members.
//
// The numbers are random but repeatable (fixed seed), shaped so a statistical study shows real
// patterns: growth over time, seasons (planting in winter, Ramadan baskets, schools in summer),
// people volunteering near home and in the sections they follow, and organizers with
// different ratings. Dates are relative to the day the seed runs.
//
// Accounts: showcase-org-NN@wathiq.local, showcase-ind-N@wathiq.local and
// showcase-vNNN@wathiq.local, all with DEMO_PASSWORD. Runs once (skipped when they exist).

import type { EducationLevel, Governorate, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { normalizeArabic } from '../../src/common/utils/arabic';
import {
  APPLY_MESSAGES,
  BADGE_NOTES,
  CASES,
  COMMENTS,
  EVENT_TEMPLATES,
  FAMILY_NAMES,
  FIELDS_OF_STUDY,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  INDIVIDUALS,
  OPPORTUNITIES,
  ORGS,
  PLACES,
  POST_TEMPLATES,
  REPLIES,
  TEAM_ROLES,
  WORK_FIELDS,
  type EventTemplate,
  type SectionSlug,
} from './content';
import { downloadPhotos, PHOTOS, PhotoStore, type PhotoTopic } from './photos';

const DAY = 24 * 60 * 60 * 1000;
const VOLUNTEERS = 260;
const EVENTS = 150;
const HISTORY_DAYS = 540;
const MARKER = 'showcase-org-01@wathiq.local';
const GOVERNORATES = Object.keys(PLACES) as Governorate[];

/** Small repeatable random generator (mulberry32). */
class Random {
  constructor(private state: number) {}
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const weights = items.map(weight);
    let r = this.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  sample<T>(items: readonly T[], n: number): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.max(0, n));
  }
  /** Weighted sample without replacement. */
  sampleWeighted<T>(
    items: readonly T[],
    n: number,
    weight: (item: T) => number,
  ): T[] {
    return items
      .map((item) => ({
        item,
        key: Math.pow(this.next(), 1 / Math.max(weight(item), 1e-6)),
      }))
      .sort((a, b) => b.key - a.key)
      .slice(0, n)
      .map((x) => x.item);
  }
}

interface Account {
  id: number;
  key: string;
  name: string;
  governorate: Governorate;
  city: string;
  sections: SectionSlug[];
  createdAt: Date;
  quality: number;
  activity: number;
  isOrg: boolean;
}

interface Volunteer {
  id: number;
  governorate: Governorate;
  birthDate: Date;
  createdAt: Date;
  sections: Set<number>;
}

const ageOn = (birth: Date, on: Date) => {
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const m = on.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
};
const minDate = (a: Date, b: Date) => (a < b ? a : b);
const maxDate = (a: Date, b: Date) => (a > b ? a : b);
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);
/** A day at a given Damascus hour (UTC+3). */
const atHour = (d: Date, hour: number) => {
  const x = new Date(d);
  x.setUTCHours(hour - 3, 0, 0, 0);
  return x;
};
const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

export async function seedShowcase(prisma: PrismaClient): Promise<string> {
  const password = process.env.DEMO_PASSWORD ?? '';
  if (password.length < 8)
    return 'showcase skipped (set DEMO_PASSWORD, 8+ characters)';
  if (await prisma.user.findUnique({ where: { email: MARKER } })) {
    return 'showcase already there';
  }

  const failed = await downloadPhotos();
  const total = new Set(Object.values(PHOTOS).flat()).size;
  if (failed.length > total / 2) {
    throw new Error(
      `Only ${total - failed.length} of ${total} showcase photos downloaded (no internet?). Try again.`,
    );
  }
  const photos = new PhotoStore();
  const usable = (topic: PhotoTopic) =>
    PHOTOS[topic].filter((id) => !failed.includes(id));

  const r = new Random(20261123);
  const now = new Date();
  const start = addDays(now, -HISTORY_DAYS);
  const passwordHash = await bcrypt.hash(password, 10);

  const sections = await prisma.section.findMany({ include: { topics: true } });
  const sectionId = (slug: SectionSlug) => {
    const s = sections.find((x) => x.slug === slug);
    if (!s)
      throw new Error(`Run the normal seed first: section ${slug} is missing.`);
    return s.id;
  };
  const topicId = (slug: SectionSlug, topic: string) => {
    const t = sections
      .find((x) => x.slug === slug)
      ?.topics.find((x) => x.slug === `${slug}--${topic}`);
    if (!t) throw new Error(`Topic ${slug}--${topic} is missing.`);
    return t.id;
  };
  const topicsOf = (slug: SectionSlug) =>
    sections.find((x) => x.slug === slug)?.topics.map((t) => t.id) ?? [];

  // ---------- Organizers ----------
  const organizers: Account[] = [];
  const specialtyIds = new Map<string, number>();
  const specialty = async (name: string) => {
    const normalized = normalizeArabic(name);
    let id = specialtyIds.get(normalized);
    if (!id) {
      id = (
        await prisma.specialty.upsert({
          where: { normalized },
          update: {},
          create: { name, normalized },
        })
      ).id;
      specialtyIds.set(normalized, id);
    }
    return id;
  };

  const allOrganizers = [
    ...ORGS.map((o, i) => ({
      ...o,
      email: `showcase-org-${String(i + 1).padStart(2, '0')}@wathiq.local`,
      isOrg: true,
    })),
    ...INDIVIDUALS.map((o, i) => ({
      ...o,
      founded: '',
      isPartner: false,
      email: `showcase-ind-${i + 1}@wathiq.local`,
      isOrg: false,
    })),
  ];
  for (const o of allOrganizers) {
    const founded = o.founded ? new Date(o.founded) : null;
    // On the platform from the first months, or from their founding if that was later.
    const createdAt = maxDate(
      addDays(start, r.int(-30, 40)),
      founded ? addDays(founded, 20) : start,
    );
    const user = await prisma.user.create({
      data: {
        email: o.email,
        name: o.name,
        searchName: normalizeArabic(o.name),
        passwordHash,
        emailVerifiedAt: createdAt,
        birthDate:
          founded ??
          new Date(`${r.int(1980, 1993)}-0${r.int(1, 9)}-1${r.int(0, 9)}`),
        governorate: o.governorate,
        city: o.city,
        bio: o.bio,
        verifiedKind: o.isOrg ? 'ORGANIZATION' : 'INDIVIDUAL',
        verifiedAt: addDays(createdAt, r.int(2, 9)),
        isPartner: o.isPartner ?? false,
        onboardingCompletedAt: createdAt,
        primarySectionId: sectionId(o.sections[0]),
        showAddress: true,
        showWorkField: !o.isOrg,
        createdAt,
        interests: {
          create: o.sections.map((s) => ({
            sectionId: sectionId(s),
            createdAt,
          })),
        },
      },
    });
    for (const name of o.specialties) {
      await prisma.userSpecialty.create({
        data: {
          userId: user.id,
          specialtyId: await specialty(name),
          createdAt,
        },
      });
    }
    organizers.push({
      id: user.id,
      key: o.key,
      name: o.name,
      governorate: o.governorate,
      city: o.city,
      sections: o.sections,
      createdAt,
      quality: o.quality,
      activity: o.activity,
      isOrg: o.isOrg,
    });
  }
  const orgs = organizers.filter((o) => o.isOrg);

  // ---------- Volunteers ----------
  const govWeight: Partial<Record<Governorate, number>> = {
    DAMASCUS: 9,
    RIF_DIMASHQ: 6,
    ALEPPO: 9,
    HOMS: 6,
    HAMA: 5,
    LATAKIA: 5,
    TARTUS: 4,
    IDLIB: 5,
    DEIR_EZ_ZOR: 3,
    RAQQA: 2,
    HASAKAH: 2,
    DARAA: 3,
    SUWAYDA: 2,
    QUNEITRA: 1,
  };
  const volunteerRows = Array.from({ length: VOLUNTEERS }, (_, i) => {
    const female = r.chance(0.52);
    const name = `${r.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M)} ${r.pick(FAMILY_NAMES)}`;
    const governorate = r.weighted(GOVERNORATES, (g) => govWeight[g] ?? 1);
    // More people join as the platform grows: sign-up dates lean towards today.
    const createdAt = addDays(
      now,
      -Math.floor(HISTORY_DAYS * (1 - Math.sqrt(r.next()))) - 1,
    );
    const age = r.weighted(
      [
        [13, 17],
        [18, 24],
        [25, 34],
        [35, 55],
      ] as const,
      ([a]) => (a === 13 ? 12 : a === 18 ? 45 : a === 25 ? 30 : 13),
    );
    const years = r.int(age[0], age[1]);
    const birthDate = new Date(
      Date.UTC(now.getUTCFullYear() - years - 1, r.int(0, 11), r.int(1, 28)),
    );
    const student = years < 23;
    const educationLevel: EducationLevel =
      years < 15
        ? 'PREPARATORY'
        : years < 18
          ? 'SECONDARY'
          : student
            ? r.pick([
                'SECONDARY',
                'INSTITUTE',
                'BACHELOR',
                'BACHELOR',
              ] as const)
            : r.pick([
                'BACHELOR',
                'BACHELOR',
                'BACHELOR',
                'INSTITUTE',
                'MASTER',
                'SECONDARY',
              ] as const);
    const adult = years >= 18;
    return {
      email: `showcase-v${String(i + 1).padStart(3, '0')}@wathiq.local`,
      name,
      searchName: normalizeArabic(name),
      passwordHash,
      emailVerifiedAt: createdAt,
      birthDate,
      governorate,
      city: r.pick(PLACES[governorate].cities),
      educationLevel,
      fieldOfStudy:
        years >= 18 && educationLevel !== 'SECONDARY'
          ? r.pick(FIELDS_OF_STUDY)
          : '',
      workField: years >= 20 ? r.pick(WORK_FIELDS) : '',
      onboardingCompletedAt: createdAt,
      showAddress: adult && r.chance(0.45),
      showAge: adult && r.chance(0.35),
      showEducation: adult && r.chance(0.5),
      showWorkField: adult && r.chance(0.35),
      showInSearch: r.chance(0.92),
      createdAt,
    };
  });
  await prisma.user.createMany({ data: volunteerRows });
  const created = await prisma.user.findMany({
    where: { email: { startsWith: 'showcase-v' } },
    select: {
      id: true,
      email: true,
      governorate: true,
      birthDate: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });
  const allSections: SectionSlug[] = [
    'humanitarian',
    'environment',
    'animal-welfare',
    'community',
    'education',
  ];
  const volunteers: Volunteer[] = [];
  const interestRows: { userId: number; sectionId: number; createdAt: Date }[] =
    [];
  const topicRows: { userId: number; topicId: number; createdAt: Date }[] = [];
  for (const v of created) {
    const picks = r.sampleWeighted(allSections, r.int(2, 4), (s) =>
      s === 'humanitarian'
        ? 5
        : s === 'environment'
          ? 4
          : s === 'education'
            ? 4
            : s === 'community'
              ? 3
              : 2,
    );
    for (const s of picks) {
      interestRows.push({
        userId: v.id,
        sectionId: sectionId(s),
        createdAt: v.createdAt,
      });
      for (const t of r.sample(topicsOf(s), r.int(1, 2))) {
        topicRows.push({ userId: v.id, topicId: t, createdAt: v.createdAt });
      }
    }
    await prisma.user.update({
      where: { id: v.id },
      data: { primarySectionId: sectionId(picks[0]) },
    });
    volunteers.push({
      id: v.id,
      governorate: v.governorate as Governorate,
      birthDate: v.birthDate,
      createdAt: v.createdAt,
      sections: new Set(picks.map(sectionId)),
    });
  }
  await prisma.userSectionInterest.createMany({ data: interestRows });
  await prisma.userTopicInterest.createMany({
    data: topicRows,
    skipDuplicates: true,
  });

  // Follows: people follow organizers near them and in their sections.
  const followRows: {
    followerId: number;
    followingId: number;
    createdAt: Date;
  }[] = [];
  for (const v of volunteers) {
    const n = r.int(1, 7);
    const chosen = r.sampleWeighted(
      organizers,
      n,
      (o) =>
        (o.governorate === v.governorate ? 6 : 1) *
        (o.sections.some((s) => v.sections.has(sectionId(s))) ? 3 : 1),
    );
    for (const o of chosen) {
      followRows.push({
        followerId: v.id,
        followingId: o.id,
        createdAt:
          addDays(maxDate(v.createdAt, o.createdAt), r.int(0, 60)) < now
            ? addDays(maxDate(v.createdAt, o.createdAt), r.int(0, 60))
            : now,
      });
    }
  }
  await prisma.follow.createMany({ data: followRows, skipDuplicates: true });

  // Team membership: about a third of adult volunteers are members of a team near them.
  const teamRows: {
    userId: number;
    teamId: number;
    status: 'APPROVED' | 'PENDING';
    role: string;
    startYear: number;
    endYear: number | null;
    decidedAt: Date | null;
    createdAt: Date;
  }[] = [];
  for (const v of volunteers) {
    if (ageOn(v.birthDate, now) < 16 || !r.chance(0.35)) continue;
    const near = orgs.filter((o) => o.governorate === v.governorate);
    for (const team of r.sample(
      near.length ? near : orgs,
      r.int(1, near.length > 1 ? 2 : 1),
    )) {
      const approved = r.chance(0.85);
      const startYear = r.int(
        Math.max(2019, team.createdAt.getUTCFullYear() - 3),
        now.getUTCFullYear(),
      );
      teamRows.push({
        userId: v.id,
        teamId: team.id,
        status: approved ? 'APPROVED' : 'PENDING',
        role: r.pick(TEAM_ROLES),
        startYear,
        endYear:
          approved && r.chance(0.2) && startYear < now.getUTCFullYear()
            ? startYear + 1
            : null,
        decidedAt: approved ? addDays(v.createdAt, r.int(1, 10)) : null,
        createdAt: v.createdAt,
      });
    }
  }
  await prisma.teamMembership.createMany({ data: teamRows });

  // ---------- Posts, media, engagement ----------
  const posts: {
    id: number;
    authorId: number;
    createdAt: Date;
    weight: number;
  }[] = [];
  const addMedia = async (
    postId: number,
    topic: PhotoTopic,
    count: number,
    phase: 'MAIN' | 'DOCUMENTATION',
    createdAt: Date,
  ) => {
    const ids = r.sample(usable(topic), count);
    for (const [i, id] of ids.entries()) {
      const file = await photos.store(id);
      if (file) {
        await prisma.postMedia.create({
          data: { postId, phase, sortOrder: i, createdAt, ...file },
        });
      }
    }
  };

  // ---------- Events ----------
  const eventPlans: { org: Account; template: EventTemplate }[] = [];
  for (let i = 0; i < EVENTS; i++) {
    const org = r.weighted(organizers, (o) => o.activity * (o.isOrg ? 1 : 0.7));
    const governorate = r.chance(0.85) ? org.governorate : r.pick(GOVERNORATES);
    const place = PLACES[governorate];
    const options = EVENT_TEMPLATES.filter(
      (t) =>
        org.sections.includes(t.section) &&
        (t.needs !== 'river' || place.river) &&
        (t.needs !== 'coast' || place.coast),
    );
    if (!options.length) continue;
    eventPlans.push({
      org: { ...org, governorate },
      template: r.pick(options),
    });
  }

  let eventCount = 0;
  let applicationCount = 0;
  let badgeCount = 0;
  let ratingCount = 0;
  const completedEvents: {
    postId: number;
    org: Account;
    section: SectionSlug;
  }[] = [];

  for (const [index, { org, template }] of eventPlans.entries()) {
    const place = PLACES[org.governorate];
    const city =
      org.governorate ===
        organizers.find((o) => o.id === org.id)?.governorate && r.chance(0.6)
        ? org.city
        : r.pick(place.cities);
    const vars = { city, spot: r.pick(place.spots), river: place.river ?? '' };

    // 1 in 9 is upcoming; the rest are spread over the history, more of them recently.
    const upcoming = index % 9 === 4;
    let startsAt = now;
    for (let attempt = 0; attempt < 30; attempt++) {
      const day = upcoming
        ? addDays(now, r.int(3, 45))
        : addDays(
            maxDate(org.createdAt, start),
            Math.floor(
              ((now.getTime() - maxDate(org.createdAt, start).getTime()) /
                DAY) *
                Math.pow(r.next(), 0.75),
            ),
          );
      startsAt = atHour(day, r.pick([9, 9, 10, 10, 15, 16, 17]));
      if (
        !template.months ||
        template.months.includes(startsAt.getUTCMonth() + 1)
      )
        break;
    }
    if (!upcoming && startsAt > addDays(now, -2))
      startsAt = addDays(now, -r.int(2, 10));
    const hours = r.int(template.hours[0], template.hours[1]);
    const endsAt = new Date(
      startsAt.getTime() + Math.min(hours, 8) * 60 * 60 * 1000,
    );
    const createdAt = minDate(
      maxDate(addDays(startsAt, -r.int(8, 25)), addDays(org.createdAt, 1)),
      addDays(now, -0.05),
    );
    const deadline = atHour(addDays(startsAt, -1), 22);
    const capacity = r.int(template.capacity[0], template.capacity[1]);

    const past = startsAt < now;
    const status: 'OPEN' | 'CLOSED' | 'COMPLETED' | 'CANCELLED' = !past
      ? 'OPEN'
      : r.chance(0.05)
        ? 'CANCELLED'
        : endsAt > addDays(now, -6) && r.chance(0.5)
          ? 'CLOSED'
          : 'COMPLETED';
    const documentedAt =
      status === 'COMPLETED'
        ? minDate(addDays(endsAt, r.int(1, 5)), addDays(now, -0.02))
        : null;

    // Roles split the capacity by their shares (at least one seat each).
    const roles = template.roles?.map(([name, share], i) => ({
      name,
      seats: Math.max(1, Math.round(capacity * share)),
      sortOrder: i,
    }));
    const realCapacity = roles
      ? roles.reduce((a, b) => a + b.seats, 0)
      : capacity;

    const metrics =
      status === 'COMPLETED'
        ? template.metrics.map((m, i) => ({
            label: m.label,
            normalized: normalizeArabic(m.label),
            value: Math.round(
              r.int(m.min, m.max) *
                (0.6 + 0.6 * (realCapacity / template.capacity[1])),
            ),
            sortOrder: i,
          }))
        : [];

    const post = await prisma.post.create({
      data: {
        authorId: org.id,
        sectionId: sectionId(template.section),
        kind: 'EVENT',
        title: fill(r.pick(template.titles), vars),
        body: fill(template.body, vars),
        createdAt,
        topics: {
          create: [{ topicId: topicId(template.section, template.topic) }],
        },
        event: {
          create: {
            status,
            startsAt,
            endsAt,
            applicationDeadline: deadline,
            capacity: realCapacity,
            volunteerHours: hours,
            governorate: org.governorate,
            city,
            locationText: vars.spot,
            minAge: template.minAge ?? null,
            documentationDueAt: addDays(endsAt, 7),
            documentedAt,
            documentation:
              status === 'COMPLETED'
                ? r
                    .sample(
                      template.documentation,
                      r.int(1, template.documentation.length),
                    )
                    .join('\n\n')
                : '',
            roles: roles ? { create: roles } : undefined,
            impactMetrics: metrics.length ? { create: metrics } : undefined,
          },
        },
      },
      include: { event: { include: { roles: true } } },
    });
    eventCount += 1;
    await addMedia(post.id, template.photos, 1, 'MAIN', createdAt);
    if (status === 'COMPLETED' && documentedAt) {
      await addMedia(
        post.id,
        template.photos,
        r.int(2, 3),
        'DOCUMENTATION',
        documentedAt,
      );
      completedEvents.push({ postId: post.id, org, section: template.section });
    }

    // Applicants: people who had joined by then, old enough on the event day, mostly from the
    // same governorate and interested in the section.
    const section = sectionId(template.section);
    const pool = volunteers.filter(
      (v) =>
        v.createdAt < addDays(createdAt, 5) &&
        ageOn(v.birthDate, startsAt) >= (template.minAge ?? 13),
    );
    const wanted = Math.round(
      realCapacity * (past ? 0.85 + r.next() * 0.7 : 0.2 + r.next() * 0.8),
    );
    const applicants = r.sampleWeighted(
      pool,
      wanted,
      (v) =>
        (v.governorate === org.governorate ? 8 : 1) *
        (v.sections.has(section) ? 3 : 1),
    );
    const acceptedTarget = past
      ? Math.min(
          realCapacity,
          Math.round(applicants.length * (0.7 + r.next() * 0.25)),
        )
      : Math.min(realCapacity, Math.round(applicants.length * 0.45));
    const seatsLeft = new Map(
      (post.event?.roles ?? []).map((role) => [role.id, role.seats]),
    );
    const lastApplyDay = minDate(deadline, addDays(now, -0.01));

    const apps = applicants.map((v, i) => {
      const accepted = i < acceptedTarget;
      const status = accepted
        ? ('ACCEPTED' as const)
        : past
          ? r.chance(0.6)
            ? ('REJECTED' as const)
            : ('WITHDRAWN' as const)
          : r.chance(0.9)
            ? ('PENDING' as const)
            : ('WITHDRAWN' as const);
      const appliedAt = new Date(
        maxDate(createdAt, v.createdAt).getTime() +
          r.next() *
            Math.max(
              0,
              lastApplyDay.getTime() -
                maxDate(createdAt, v.createdAt).getTime(),
            ),
      );
      let roleId: number | null = null;
      if (accepted && seatsLeft.size) {
        const free = [...seatsLeft.entries()].filter(([, left]) => left > 0);
        if (free.length) {
          roleId = r.weighted(free, ([, left]) => left)[0];
          seatsLeft.set(roleId, (seatsLeft.get(roleId) ?? 1) - 1);
        }
      }
      const decided = status === 'ACCEPTED' || status === 'REJECTED';
      return {
        eventId: post.id,
        userId: v.id,
        status,
        message: r.pick(APPLY_MESSAGES),
        roleId,
        decidedById: decided ? org.id : null,
        decidedAt: decided
          ? minDate(addDays(appliedAt, r.int(0, 3)), addDays(now, -0.01))
          : null,
        createdAt: appliedAt,
      };
    });
    await prisma.eventApplication.createMany({ data: apps });
    applicationCount += apps.length;

    // A full upcoming event closed itself, as the service does.
    const acceptedCount = apps.filter((a) => a.status === 'ACCEPTED').length;
    if (!past && acceptedCount >= realCapacity) {
      await prisma.event.update({
        where: { postId: post.id },
        data: { status: 'CLOSED', autoClosedAt: addDays(now, -r.int(0, 2)) },
      });
    }

    const saved = await prisma.eventApplication.findMany({
      where: { eventId: post.id },
      select: {
        id: true,
        userId: true,
        status: true,
        roleId: true,
        createdAt: true,
      },
    });
    // Ranked role choices (1 to 3), the given role first.
    if (post.event?.roles.length) {
      const roleIds = post.event.roles.map((x) => x.id);
      await prisma.eventApplicationRoleChoice.createMany({
        data: saved.flatMap((a) => {
          const first = a.roleId ?? r.pick(roleIds);
          const rest = r.sample(
            roleIds.filter((id) => id !== first),
            r.int(0, Math.min(2, roleIds.length - 1)),
          );
          return [first, ...rest].map((roleId, rank) => ({
            applicationId: a.id,
            roleId,
            rank: rank + 1,
          }));
        }),
      });
    }

    if (status === 'COMPLETED' && documentedAt) {
      const accepted = saved.filter((a) => a.status === 'ACCEPTED');
      const badges = accepted.flatMap((a) => {
        const roll = r.next();
        if (roll > 0.92) return [];
        const badgeStatus =
          roll < 0.8
            ? ('APPROVED' as const)
            : roll < 0.88
              ? ('REQUESTED' as const)
              : ('REJECTED' as const);
        const requested = minDate(
          addDays(documentedAt, r.int(0, 4)),
          addDays(now, -0.01),
        );
        return [
          {
            applicationId: a.id,
            eventId: post.id,
            userId: a.userId,
            status: badgeStatus,
            description: badgeStatus === 'APPROVED' ? r.pick(BADGE_NOTES) : '',
            isShownOnProfile: r.chance(0.97),
            decidedById: badgeStatus === 'REQUESTED' ? null : org.id,
            decidedAt:
              badgeStatus === 'REQUESTED'
                ? null
                : minDate(addDays(requested, r.int(0, 5)), now),
            createdAt: requested,
          },
        ];
      });
      await prisma.badge.createMany({ data: badges });
      badgeCount += badges.length;

      // Ratings: about half the accepted volunteers rate, better organizers get more stars.
      const ratings = accepted
        .filter(() => r.chance(0.55))
        .map((a) => {
          const q = org.quality;
          const stars = r.weighted([5, 4, 3, 2, 1], (s) =>
            s === 5
              ? 20 + 60 * q
              : s === 4
                ? 30
                : s === 3
                  ? 18 - 12 * q
                  : s === 2
                    ? 6 - 5 * q
                    : 3 - 2.5 * q,
          );
          return {
            eventId: post.id,
            applicationId: a.id,
            raterId: a.userId,
            organizerId: org.id,
            stars,
            createdAt: minDate(addDays(documentedAt, r.int(0, 20)), now),
          };
        });
      await prisma.eventRating.createMany({ data: ratings });
      ratingCount += ratings.length;
    }

    posts.push({
      id: post.id,
      authorId: org.id,
      createdAt,
      weight: status === 'COMPLETED' ? 1.4 : 1,
    });
  }

  // Collaborations: some completed campaigns were run with a second organizer.
  let collabCount = 0;
  for (const e of r.sample(completedEvents, 20)) {
    const partner = r.pick(
      organizers.filter(
        (o) => o.id !== e.org.id && o.sections.includes(e.section),
      ),
    );
    if (!partner) continue;
    await prisma.collaboration.create({
      data: {
        postId: e.postId,
        inviterId: e.org.id,
        inviteeId: partner.id,
        status: 'ACCEPTED',
        respondedAt: now,
      },
    });
    collabCount += 1;
  }

  // ---------- Normal posts ----------
  for (const o of organizers) {
    const options = POST_TEMPLATES.filter((p) =>
      o.sections.includes(p.section),
    );
    for (const p of r.sample(options, r.int(2, Math.min(5, options.length)))) {
      const createdAt = addDays(
        o.createdAt,
        r.next() * ((now.getTime() - o.createdAt.getTime()) / DAY),
      );
      const post = await prisma.post.create({
        data: {
          authorId: o.id,
          sectionId: sectionId(p.section),
          title: p.title,
          body: p.body,
          createdAt,
          topics: { create: [{ topicId: topicId(p.section, p.topic) }] },
        },
      });
      await addMedia(post.id, p.photos, r.int(1, 2), 'MAIN', createdAt);
      posts.push({ id: post.id, authorId: o.id, createdAt, weight: 0.8 });
    }
  }

  // Humanitarian cases: contact details are made up (+963 90 is not a real mobile prefix).
  const humanitarian = orgs.filter((o) => o.sections.includes('humanitarian'));
  for (const [i, c] of CASES.entries()) {
    const o = r.pick(humanitarian);
    const createdAt = addDays(now, -r.int(2, 320));
    const post = await prisma.post.create({
      data: {
        authorId: o.id,
        sectionId: sectionId('humanitarian'),
        title: c.title,
        body: c.body,
        createdAt,
        topics: {
          create: [
            {
              topicId: topicId(
                'humanitarian',
                i === 5 ? 'housing' : 'medical-cases',
              ),
            },
          ],
        },
        caseDetails: {
          create: {
            contactPhone: `+9639000000${String(i + 10).padStart(2, '0')}`,
            paymentNote: c.note,
          },
        },
      },
    });
    await addMedia(
      post.id,
      i === 5 ? 'painting' : 'hospital',
      1,
      'MAIN',
      createdAt,
    );
    posts.push({ id: post.id, authorId: o.id, createdAt, weight: 1.6 });
  }

  // Education opportunities: half still open, half past their deadline (shown as closed).
  const educators = organizers.filter((o) => o.sections.includes('education'));
  for (const [i, op] of OPPORTUNITIES.entries()) {
    const o = r.pick(educators);
    const open = i % 2 === 0;
    const createdAt = open
      ? addDays(now, -r.int(2, 25))
      : addDays(now, -r.int(60, 400));
    const post = await prisma.post.create({
      data: {
        authorId: o.id,
        sectionId: sectionId('education'),
        title: op.title,
        body: op.body,
        createdAt,
        topics: {
          create: [
            {
              topicId: topicId(
                'education',
                op.title.startsWith('منحة')
                  ? 'scholarships'
                  : op.title.startsWith('مسابقة')
                    ? 'competitions'
                    : op.title.startsWith('فرصة عمل')
                      ? 'jobs'
                      : 'internships',
              ),
            },
          ],
        },
        opportunity: {
          create: {
            deadline: addDays(createdAt, r.int(20, 45)),
            applyUrl: `https://example.org/opportunities/${i + 1}`,
            mode: op.mode,
            location: op.mode === 'ONLINE' ? '' : o.city,
            eligibility: op.eligibility,
            minAge: op.minAge ?? null,
            maxAge: op.maxAge ?? null,
            educationLevel: op.education ?? null,
            field: op.field,
          },
        },
      },
    });
    await addMedia(
      post.id,
      op.field === 'البرمجة'
        ? 'coding'
        : r.pick(['classroom', 'workshop', 'books'] as const),
      1,
      'MAIN',
      createdAt,
    );
    posts.push({ id: post.id, authorId: o.id, createdAt, weight: 0.9 });
  }

  // Upvotes and comments from people who were on the platform then.
  let upvoteCount = 0;
  let commentCount = 0;
  for (const p of posts) {
    const audience = volunteers.filter(
      (v) => v.createdAt < addDays(p.createdAt, 30),
    );
    const ageDays = (now.getTime() - p.createdAt.getTime()) / DAY;
    const n = Math.min(
      audience.length,
      Math.round(
        (4 + r.next() * 40) * p.weight * Math.min(1, 0.3 + ageDays / 60),
      ),
    );
    const voters = r.sample(audience, n);
    await prisma.upvote.createMany({
      data: voters.map((v) => ({
        userId: v.id,
        postId: p.id,
        createdAt: minDate(
          addDays(maxDate(p.createdAt, v.createdAt), r.next() * 20),
          now,
        ),
      })),
    });
    let comments = 0;
    for (const v of r.sample(audience, r.int(0, 5))) {
      const at = minDate(
        addDays(maxDate(p.createdAt, v.createdAt), r.next() * 10),
        now,
      );
      const comment = await prisma.comment.create({
        data: {
          postId: p.id,
          authorId: v.id,
          body: r.pick(COMMENTS),
          createdAt: at,
        },
      });
      comments += 1;
      if (r.chance(0.35)) {
        await prisma.comment.create({
          data: {
            postId: p.id,
            authorId: p.authorId,
            parentId: comment.id,
            body: r.pick(REPLIES),
            createdAt: minDate(addDays(at, r.next() * 2), now),
          },
        });
        comments += 1;
      }
    }
    await prisma.post.update({
      where: { id: p.id },
      data: { upvoteCount: voters.length, commentCount: comments },
    });
    upvoteCount += voters.length;
    commentCount += comments;
  }

  const missing = failed.length ? `, ${failed.length} photos missing` : '';
  return (
    `showcase created: ${organizers.length} organizers, ${volunteers.length} volunteers, ` +
    `${eventCount} events (${completedEvents.length} completed), ${applicationCount} applications, ` +
    `${badgeCount} badges, ${ratingCount} ratings, ${collabCount} collaborations, ` +
    `${posts.length - eventCount} other posts, ${upvoteCount} upvotes, ${commentCount} comments, ` +
    `${photos.stored} photo files${missing}`
  );
}
