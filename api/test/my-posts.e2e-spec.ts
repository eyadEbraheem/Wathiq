import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

interface MyPostsBody {
  data: {
    id: number;
    title: string;
    status: string;
    kind: string;
    waiting: { applications: number; badges: number } | null;
  }[];
  meta: { total: number };
  counts: { all: number; posts: number; events: number; hidden: number };
}

describe('My posts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sectionId: number;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

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
    const { user: org, token } = await createUserAndLogin(app, prisma, {
      email: 'org@example.com',
      verifiedKind: 'ORGANIZATION',
    });
    const { user: other } = await createUserAndLogin(app, prisma, {
      email: 'other@example.com',
      verifiedKind: 'ORGANIZATION',
    });
    const { user: volunteer, token: userToken } = await createUserAndLogin(
      app,
      prisma,
      { email: 'v@example.com' },
    );
    const post = (authorId: number, title: string, extra = {}) =>
      prisma.post.create({
        data: { authorId, sectionId, title, body: 'نص', ...extra },
      });
    const event = (title: string, status: 'OPEN' | 'COMPLETED') =>
      post(org.id, title, {
        kind: 'EVENT',
        event: {
          create: {
            status,
            startsAt: new Date(),
            volunteerHours: 3,
            governorate: 'DAMASCUS',
            city: 'دمشق',
            documentationDueAt: new Date(),
          },
        },
      });
    await post(org.id, 'منشور عن التشجير');
    await post(org.id, 'منشور أخفته الإدارة', { status: 'HIDDEN' });
    await post(org.id, 'منشور محذوف', { status: 'DELETED' });
    const open = await event('حملة تشجير الحي', 'OPEN');
    const done = await event('حملة نظافة', 'COMPLETED');
    await post(other.id, 'منشور جهة أخرى');
    // One pending application on the open event; a badge request on the completed one.
    await prisma.eventApplication.create({
      data: { eventId: open.id, userId: volunteer.id },
    });
    const app2 = await prisma.eventApplication.create({
      data: { eventId: done.id, userId: volunteer.id, status: 'ACCEPTED' },
    });
    await prisma.badge.create({
      data: { applicationId: app2.id, eventId: done.id, userId: volunteer.id },
    });
    return { token, userToken, open, done };
  }

  it('lists everything the account published except deleted, with tab counts', async () => {
    const { token } = await setup();
    const res = await http()
      .get('/api/v1/users/me/posts')
      .set(bearer(token))
      .expect(200);
    const body = res.body as MyPostsBody;
    expect(body.counts).toEqual({ all: 4, posts: 2, events: 2, hidden: 1 });
    expect(body.data.map((p) => p.title).sort()).toEqual(
      [
        'حملة تشجير الحي',
        'حملة نظافة',
        'منشور أخفته الإدارة',
        'منشور عن التشجير',
      ].sort(),
    );
    expect(
      body.data.find((p) => p.title === 'منشور أخفته الإدارة')?.status,
    ).toBe('HIDDEN');
  });

  it('filters by kind, event status, hidden and title, and shows what waits', async () => {
    const { token, open, done } = await setup();
    const get = async (q: string) =>
      (
        await http()
          .get(`/api/v1/users/me/posts?${q}`)
          .set(bearer(token))
          .expect(200)
      ).body as MyPostsBody;

    const events = await get('kind=EVENT');
    expect(events.data).toHaveLength(2);
    expect(events.data.find((e) => e.id === open.id)?.waiting).toEqual({
      applications: 1,
      badges: 0,
    });
    expect(events.data.find((e) => e.id === done.id)?.waiting).toEqual({
      applications: 0,
      badges: 1,
    });
    expect((await get('kind=POST')).data.every((p) => p.waiting === null)).toBe(
      true,
    );
    expect((await get('eventStatus=OPEN')).data.map((e) => e.id)).toEqual([
      open.id,
    ]);
    expect((await get('hidden=true')).data).toHaveLength(1);
    const search = await get(`q=${encodeURIComponent('تشجير')}`);
    expect(search.data).toHaveLength(2);
    expect(search.counts.all).toBe(2);
  });

  it('is for verified accounts only', async () => {
    const { userToken } = await setup();
    await http().get('/api/v1/users/me/posts').expect(401);
    await http()
      .get('/api/v1/users/me/posts')
      .set(bearer(userToken))
      .expect(403);
  });
});
