import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HighlightsService } from 'src/highlights/highlights.service';
import { lastFinishedWeek, weekStartOf } from 'src/highlights/week';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

const DAY = 24 * 60 * 60 * 1000;
/** Saturday 14 Nov 2026, 00:00 Damascus. */
const WEEK = new Date('2026-11-13T21:00:00Z');
const inWeek = (week: Date, days: number) =>
  new Date(week.getTime() + days * DAY);

interface HighlightBody {
  weekStart: string;
  weekEnd: string;
  newVolunteers: number;
  organizer: { id: number; name: string } | null;
}

describe('Organization of the week (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let highlights: HighlightsService;
  let sectionId: number;
  let people = 0;
  const http = () => request(app.getHttpServer());

  const organizer = async (name: string, extra = {}) =>
    (
      await createUserAndLogin(app, prisma, {
        email: `${name}@example.com`,
        name,
        verifiedKind: 'ORGANIZATION',
        verifiedAt: new Date(),
        ...extra,
      })
    ).user;

  const volunteers = async (n: number) => {
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      people += 1;
      const user = await prisma.user.create({
        data: {
          email: `v${people}@example.com`,
          name: `Volunteer ${people}`,
          birthDate: new Date('2000-01-01'),
          passwordHash: '',
        },
      });
      ids.push(user.id);
    }
    return ids;
  };

  /** A completed event documented at `documentedAt`, with these volunteers accepted. */
  const completedEvent = async (
    authorId: number,
    documentedAt: Date,
    accepted: number[],
    extra: { others?: [number, 'PENDING' | 'REJECTED'][]; stars?: number } = {},
  ) => {
    const startsAt = new Date(documentedAt.getTime() - DAY);
    const post = await prisma.post.create({
      data: {
        authorId,
        sectionId,
        kind: 'EVENT',
        title: 'حملة',
        body: 'تفاصيل',
        event: {
          create: {
            status: 'COMPLETED',
            startsAt,
            endsAt: startsAt,
            volunteerHours: 4,
            governorate: 'DAMASCUS',
            city: 'دمشق',
            documentationDueAt: documentedAt,
            documentedAt,
            documentation: 'تم',
          },
        },
      },
    });
    await prisma.eventApplication.createMany({
      data: [
        ...accepted.map((userId) => ({
          eventId: post.id,
          userId,
          status: 'ACCEPTED' as const,
        })),
        ...(extra.others ?? []).map(([userId, status]) => ({
          eventId: post.id,
          userId,
          status,
        })),
      ],
    });
    if (extra.stars) {
      const apps = await prisma.eventApplication.findMany({
        where: { eventId: post.id, status: 'ACCEPTED' },
      });
      await prisma.eventRating.createMany({
        data: apps.map((a) => ({
          eventId: post.id,
          applicationId: a.id,
          raterId: a.userId,
          organizerId: authorId,
          stars: extra.stars as number,
        })),
      });
    }
    return post.id;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    highlights = app.get(HighlightsService);
    sectionId = (
      await prisma.section.upsert({
        where: { slug: 'community' },
        update: {},
        create: {
          slug: 'community',
          nameAr: 'المجتمع',
          nameEn: 'Community',
          logoUrl: '',
        },
      })
    ).id;
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('weeks run Saturday to Friday, Damascus time', () => {
    // Friday 23:30 Damascus is still the old week; Saturday 00:10 starts the new one.
    expect(weekStartOf(new Date('2026-11-20T20:30:00Z'))).toEqual(WEEK);
    expect(weekStartOf(new Date('2026-11-20T21:10:00Z'))).toEqual(
      new Date('2026-11-20T21:00:00Z'),
    );
    expect(lastFinishedWeek(new Date('2026-11-23T09:00:00Z'))).toEqual(WEEK);
  });

  it('counts first-time volunteers only, from events documented that week', async () => {
    const a = await organizer('a');
    const b = await organizer('b');
    const regulars = await volunteers(3);
    const newcomersA = await volunteers(4);
    const newcomersB = await volunteers(5);
    // The regulars already volunteered the week before.
    await completedEvent(b.id, inWeek(WEEK, -3), regulars);
    // A has 7 accepted people but only 4 are new; pending and rejected never count.
    const [pending, rejected] = await volunteers(2);
    await completedEvent(a.id, inWeek(WEEK, 2), [...regulars, ...newcomersA], {
      others: [
        [pending, 'PENDING'],
        [rejected, 'REJECTED'],
      ],
    });
    await completedEvent(b.id, inWeek(WEEK, 4), newcomersB);
    // Documented the next week: belongs to that week, not this one.
    await completedEvent(a.id, inWeek(WEEK, 8), await volunteers(9));

    const winner = await highlights.computeWeek(WEEK, false);
    expect(winner).toMatchObject({ organizer_id: b.id, new_volunteers: 5 });
  });

  it('names nobody below 5 first-time volunteers', async () => {
    const a = await organizer('a');
    await completedEvent(a.id, inWeek(WEEK, 1), await volunteers(4));
    expect(await highlights.computeWeek(WEEK, false)).toBeNull();
    const row = await prisma.weeklyHighlight.findUnique({
      where: { weekStart: WEEK },
    });
    expect(row).toMatchObject({ organizerId: null, newVolunteers: 0 });
  });

  it('breaks a tie with the ratings of the week', async () => {
    const a = await organizer('a');
    const b = await organizer('b');
    await completedEvent(a.id, inWeek(WEEK, 1), await volunteers(6), {
      stars: 4,
    });
    await completedEvent(b.id, inWeek(WEEK, 2), await volunteers(6), {
      stars: 5,
    });
    expect(await highlights.computeWeek(WEEK, false)).toMatchObject({
      organizer_id: b.id,
    });
  });

  it('ignores suspended organizers and deleted posts', async () => {
    const suspended = await organizer('s', { isSuspended: true });
    const deleted = await organizer('d');
    const fair = await organizer('f');
    await completedEvent(suspended.id, inWeek(WEEK, 1), await volunteers(9));
    const gone = await completedEvent(
      deleted.id,
      inWeek(WEEK, 1),
      await volunteers(8),
    );
    await prisma.post.update({
      where: { id: gone },
      data: { status: 'DELETED' },
    });
    await completedEvent(fair.id, inWeek(WEEK, 2), await volunteers(5));
    expect(await highlights.computeWeek(WEEK, false)).toMatchObject({
      organizer_id: fair.id,
    });
  });

  it('catches up missed weeks, notifies only for the latest, and serves it publicly', async () => {
    const old = await organizer('old');
    const latest = await organizer('latest');
    const { user: fan } = await createUserAndLogin(app, prisma, {
      email: 'fan@example.com',
    });
    await prisma.follow.create({
      data: { followerId: fan.id, followingId: latest.id },
    });
    await completedEvent(old.id, inWeek(WEEK, -6), await volunteers(5));
    await completedEvent(latest.id, inWeek(WEEK, 3), await volunteers(7));

    const now = new Date('2026-11-23T09:00:00Z');
    expect(await highlights.catchUp(now)).toBe(2);
    expect(await highlights.catchUp(now)).toBe(0);

    // Only the latest week notified: the winner and its follower, not the old winner.
    const notes = await prisma.notification.findMany({
      where: { type: 'WEEKLY_HIGHLIGHT' },
      orderBy: { recipientId: 'asc' },
    });
    expect(notes.map((n) => [n.recipientId, n.actorId])).toEqual([
      [latest.id, null],
      [fan.id, latest.id],
    ]);

    const current = await http().get('/api/v1/highlights/current').expect(200);
    const body = current.body as HighlightBody;
    expect(body).toMatchObject({
      weekStart: WEEK.toISOString(),
      weekEnd: inWeek(WEEK, 7).toISOString(),
      newVolunteers: 7,
      organizer: { id: latest.id, name: 'latest' },
    });

    const board = await http().get('/api/v1/highlights').expect(200);
    expect(
      (board.body as { data: HighlightBody[] }).data.map(
        (h) => h.organizer?.id,
      ),
    ).toEqual([latest.id, old.id]);

    const { token } = await createUserAndLogin(app, prisma, {
      email: 'viewer@example.com',
    });
    const stats = await http()
      .get(`/api/v1/users/${latest.id}/organizer-stats`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect((stats.body as { weeklyHighlights: number }).weeklyHighlights).toBe(
      1,
    );
  });

  it('answers 404 before any week is computed', async () => {
    await http().get('/api/v1/highlights/current').expect(404);
  });
});
