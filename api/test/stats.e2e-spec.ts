import { INestApplication } from '@nestjs/common';
import type { StatsReport } from '@csh/shared';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

/** Collects a text body (supertest does not buffer text/csv attachments by itself). */
const text = (
  res: request.Response,
  done: (err: Error | null, body: string) => void,
) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk: string) => (body += chunk));
  res.on('end', () => done(null, body));
};

describe('Statistics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sectionId: number;
  let people = 0;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const volunteers = async (n: number, extra = {}) => {
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      people += 1;
      ids.push(
        (
          await prisma.user.create({
            data: {
              email: `v${people}@example.com`,
              name: `متطوع ${people}`,
              birthDate: new Date('2000-01-01'),
              passwordHash: '',
              governorate: 'ALEPPO',
              ...extra,
            },
          })
        ).id,
      );
    }
    return ids;
  };

  const campaign = async (
    authorId: number,
    opts: {
      startsDaysAgo: number;
      status?: 'OPEN' | 'COMPLETED' | 'CANCELLED';
      capacity: number;
      accepted: number[];
      rejected?: number[];
      governorate?: 'ALEPPO' | 'HOMS';
    },
  ) => {
    const startsAt = daysAgo(opts.startsDaysAgo);
    const status = opts.status ?? 'COMPLETED';
    const post = await prisma.post.create({
      data: {
        authorId,
        sectionId,
        kind: 'EVENT',
        title: 'حملة تنظيف',
        body: 'تفاصيل',
        upvoteCount: 4,
        event: {
          create: {
            status,
            startsAt,
            endsAt: startsAt,
            capacity: opts.capacity,
            volunteerHours: 3,
            governorate: opts.governorate ?? 'ALEPPO',
            city: 'حلب',
            documentationDueAt: startsAt,
            documentedAt: status === 'COMPLETED' ? startsAt : null,
            impactMetrics:
              status === 'COMPLETED'
                ? {
                    create: [
                      {
                        label: 'أكياس نفايات',
                        normalized: 'اكياس نفايات',
                        value: 50,
                      },
                    ],
                  }
                : undefined,
          },
        },
      },
    });
    await prisma.eventApplication.createMany({
      data: [
        ...opts.accepted.map((userId) => ({
          eventId: post.id,
          userId,
          status: 'ACCEPTED' as const,
        })),
        ...(opts.rejected ?? []).map((userId) => ({
          eventId: post.id,
          userId,
          status: 'REJECTED' as const,
        })),
      ],
    });
    return post.id;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    sectionId = (
      await prisma.section.upsert({
        where: { slug: 'environment' },
        update: {},
        create: {
          slug: 'environment',
          nameAr: 'البيئة',
          nameEn: 'Environment',
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

  async function setup() {
    const { user: org, token: orgToken } = await createUserAndLogin(
      app,
      prisma,
      {
        email: 'org@example.com',
        name: 'جمعية',
        verifiedKind: 'ORGANIZATION',
      },
    );
    const { user: other } = await createUserAndLogin(app, prisma, {
      email: 'other@example.com',
      name: 'جمعية أخرى',
      verifiedKind: 'ORGANIZATION',
    });
    const { token: adminToken } = await createUserAndLogin(app, prisma, {
      email: 'admin@example.com',
      role: 'ADMIN',
    });
    const { token: userToken } = await createUserAndLogin(app, prisma, {
      email: 'user@example.com',
    });
    // Six people show their age and education, two do not; two are teenagers.
    const shown = await volunteers(6, {
      showAge: true,
      showEducation: true,
      educationLevel: 'BACHELOR',
    });
    const hidden = await volunteers(2);
    const teens = await volunteers(2, { birthDate: daysAgo(15 * 365) });
    const turnedAway = await volunteers(3);
    // Org: two completed campaigns (the six come back), one cancelled, one upcoming.
    await campaign(org.id, {
      startsDaysAgo: 40,
      capacity: 10,
      accepted: [...shown, ...hidden],
      rejected: turnedAway,
    });
    await campaign(org.id, {
      startsDaysAgo: 10,
      capacity: 10,
      accepted: [...shown, ...teens],
    });
    await campaign(org.id, {
      startsDaysAgo: 5,
      status: 'CANCELLED',
      capacity: 5,
      accepted: [],
    });
    await campaign(org.id, {
      startsDaysAgo: -7,
      status: 'OPEN',
      capacity: 5,
      accepted: [],
    });
    // Another organizer, long ago, in Homs.
    await campaign(other.id, {
      startsDaysAgo: 300,
      capacity: 20,
      accepted: hidden,
      governorate: 'HOMS',
    });
    return { org, orgToken, adminToken, userToken, shown, hidden, teens };
  }

  it('is for admins (platform) and verified accounts (their own) only', async () => {
    const { userToken } = await setup();
    await http().get('/api/v1/admin/stats').expect(401);
    await http().get('/api/v1/admin/stats').set(bearer(userToken)).expect(403);
    await http()
      .get('/api/v1/users/me/stats')
      .set(bearer(userToken))
      .expect(403);
    await http().get('/api/v1/admin/stats?period=week').expect(401);
  });

  it('gives an organizer its own campaigns, with what each volunteer shows', async () => {
    const { orgToken } = await setup();
    const res = await http()
      .get('/api/v1/users/me/stats?period=90d')
      .set(bearer(orgToken))
      .expect(200);
    const r = res.body as StatsReport;
    expect(r.scope).toBe('organizer');
    expect(r.totals).toEqual({
      campaigns: 4,
      completed: 2,
      cancelled: 1,
      upcoming: 1,
      volunteers: 10,
      // Everyone but the two who volunteered with the other organizer before.
      newVolunteers: 8,
      volunteerHours: (8 + 8) * 3,
      organizers: 1,
    });
    expect(r.volunteers.firstTime).toBe(8);
    expect(r.volunteers.returning).toBe(6);
    // Ages: the six who show it are 25-34; the teens and the two hidden ones are "hidden".
    expect(r.volunteers.ageGroups).toEqual(
      expect.arrayContaining([
        { group: '25-34', count: 6 },
        { group: '18-24', count: null },
        { group: 'hidden', count: null },
      ]),
    );
    expect(r.impact).toEqual([{ label: 'أكياس نفايات', total: 100 }]);
    expect(r.topOrganizers).toBeNull();
    expect(r.requests).toBeNull();
    const [section] = r.bySection;
    expect(section).toMatchObject({
      campaigns: 2,
      completed: 2,
      seats: 20,
      accepted: 16,
      rejected: 3,
      applicants: 19,
      unfilledSeats: 4,
      applicantsPerSeat: 0.95,
      fillRate: 0.8,
    });
  });

  it('gives admins the whole platform, filters and the previous window', async () => {
    const { adminToken, org } = await setup();
    const all = (
      await http()
        .get('/api/v1/admin/stats?period=all')
        .set(bearer(adminToken))
        .expect(200)
    ).body as StatsReport;
    expect(all.scope).toBe('platform');
    expect(all.totals.completed).toBe(3);
    expect(all.totals.organizers).toBe(2);
    expect(all.previous).toBeNull();
    expect(all.byGovernorate.map((g) => g.governorate).sort()).toEqual([
      'ALEPPO',
      'HOMS',
    ]);
    expect(all.topOrganizers?.[0]).toMatchObject({
      id: org.id,
      completed: 2,
      volunteers: 10,
    });

    const homs = (
      await http()
        .get('/api/v1/admin/stats?period=all&governorate=HOMS')
        .set(bearer(adminToken))
        .expect(200)
    ).body as StatsReport;
    expect(homs.totals).toMatchObject({ completed: 1, volunteers: 2 });

    const recent = (
      await http()
        .get('/api/v1/admin/stats?period=30d')
        .set(bearer(adminToken))
        .expect(200)
    ).body as StatsReport;
    expect(recent.totals.completed).toBe(1);
    expect(recent.previous?.completed).toBe(1);
    await http()
      .get('/api/v1/admin/stats?period=week')
      .set(bearer(adminToken))
      .expect(400);
  });

  it('exports campaigns as CSV without names of volunteers', async () => {
    const { orgToken, adminToken } = await setup();
    const mine = await http()
      .get('/api/v1/users/me/stats/campaigns.csv?period=all')
      .set(bearer(orgToken))
      .buffer(true)
      .parse(text)
      .expect(200);
    expect(mine.headers['content-type']).toContain('text/csv');
    const body = mine.body as string;
    expect(body.startsWith('﻿event_id,title,section')).toBe(true);
    const lines = body.trim().split('\r\n');
    expect(lines).toHaveLength(5);
    expect(lines[0]).not.toContain('organizer');
    expect(body).not.toContain('متطوع');

    const platform = await http()
      .get('/api/v1/admin/stats/campaigns.csv?period=all')
      .set(bearer(adminToken))
      .buffer(true)
      .parse(text)
      .expect(200);
    expect((platform.body as string).split('\r\n')[0]).toContain(
      'organizer_id,organizer',
    );
  });
});
