import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { normalizeArabic } from 'src/common/utils/arabic';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

interface CommentBody {
  id: number;
  body: string;
  parentId: number | null;
  author: { name: string };
  replies: CommentBody[];
}

interface NotificationBody {
  id: number;
  type: string;
  readAt: string | null;
  actor: { id: number } | null;
  post: { id: number } | null;
}

describe('Comments & notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let sectionId: number;
  let topicId: number;

  type Person = Awaited<ReturnType<typeof createUserAndLogin>>;
  let org: Person;
  let sara: Person;
  let omar: Person;

  async function post(token = org.token, extra: Record<string, unknown> = {}) {
    const res = await http()
      .post('/api/v1/posts')
      .set(bearer(token))
      .send({ sectionId, title: 'حملة تشجير', body: 'نص', ...extra })
      .expect(201);
    return (res.body as { id: number }).id;
  }

  async function comment(
    token: string,
    postId: number,
    body: string,
    parentId?: number,
    status = 201,
  ) {
    const res = await http()
      .post(`/api/v1/posts/${postId}/comments`)
      .set(bearer(token))
      .send({ body, ...(parentId ? { parentId } : {}) })
      .expect(status);
    return res.body as CommentBody;
  }

  async function inbox(token: string, query = '') {
    const res = await http()
      .get(`/api/v1/notifications${query}`)
      .set(bearer(token))
      .expect(200);
    return (res.body as { data: NotificationBody[] }).data;
  }

  async function commentCount(postId: number) {
    const p = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
    return p.commentCount;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections, banned_words RESTART IDENTITY CASCADE',
    );
    const section = await prisma.section.create({
      data: {
        slug: 'environment',
        nameAr: 'البيئة',
        nameEn: 'Environment',
        logoUrl: '',
        topics: {
          create: [
            { slug: 'environment--trees', nameAr: 'التشجير', nameEn: 'Trees' },
          ],
        },
      },
      include: { topics: true },
    });
    sectionId = section.id;
    topicId = section.topics[0].id;
    await prisma.bannedWord.create({
      data: { word: 'غبي', normalized: normalizeArabic('غبي') },
    });

    org = await createUserAndLogin(app, prisma, {
      email: 'org@example.com',
      name: 'Green Team',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });
    sara = await createUserAndLogin(app, prisma, {
      email: 'sara@example.com',
      name: 'Sara',
    });
    omar = await createUserAndLogin(app, prisma, {
      email: 'omar@example.com',
      name: 'Omar',
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections, banned_words RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  describe('comments', () => {
    it('adds comments and one level of replies, and lists them with counts', async () => {
      const postId = await post();
      const first = await comment(sara.token, postId, '  كيف أشارك؟  ');
      expect(first.body).toBe('كيف أشارك؟');
      await comment(org.token, postId, 'سجّلي من الرابط', first.id);
      await comment(omar.token, postId, 'فكرة رائعة');

      const res = await http()
        .get(`/api/v1/posts/${postId}/comments`)
        .set(bearer(omar.token))
        .expect(200);
      const body = res.body as { data: CommentBody[]; meta: { total: number } };
      expect(body.meta.total).toBe(2);
      expect(body.data.map((c) => c.body)).toEqual([
        'كيف أشارك؟',
        'فكرة رائعة',
      ]);
      expect(body.data[0].replies.map((r) => r.body)).toEqual([
        'سجّلي من الرابط',
      ]);
      expect(body.data[0].author).toMatchObject({ name: 'Sara' });
      expect(body.data[0].author).not.toHaveProperty('email');
      expect(await commentCount(postId)).toBe(3);
    });

    it('refuses replies to replies and parents from another post', async () => {
      const postId = await post();
      const otherPostId = await post();
      const top = await comment(sara.token, postId, 'سؤال');
      const reply = await comment(org.token, postId, 'جواب', top.id);
      await comment(omar.token, postId, 'رد على رد', reply.id, 400);
      await comment(omar.token, otherPostId, 'خارج المنشور', top.id, 400);
    });

    it('refuses banned words whatever their spelling', async () => {
      const postId = await post();
      await comment(sara.token, postId, 'إنتَ غبيّ!', undefined, 400);
      await comment(sara.token, postId, 'غبية الطقس اليوم؟', undefined, 201);
      expect(await commentCount(postId)).toBe(1);
    });

    it('returns 404 for unknown or deleted posts and 403 for suspended users', async () => {
      const postId = await post();
      await comment(sara.token, 9999, 'مرحبا', undefined, 404);
      await http()
        .delete(`/api/v1/posts/${postId}`)
        .set(bearer(org.token))
        .expect(204);
      await comment(sara.token, postId, 'مرحبا', undefined, 404);

      const livePostId = await post();
      await prisma.user.update({
        where: { id: omar.user.id },
        data: { isSuspended: true },
      });
      await comment(omar.token, livePostId, 'مرحبا', undefined, 403);
    });

    it('lets the comment author or the post author delete, and removes replies with it', async () => {
      const postId = await post();
      const top = await comment(sara.token, postId, 'سؤال');
      await comment(omar.token, postId, 'رد', top.id);
      const lone = await comment(omar.token, postId, 'تعليق آخر');
      expect(await commentCount(postId)).toBe(3);

      await http()
        .delete(`/api/v1/comments/${lone.id}`)
        .set(bearer(sara.token))
        .expect(403);
      await http()
        .delete(`/api/v1/comments/${lone.id}`)
        .set(bearer(omar.token))
        .expect(204);
      await http()
        .delete(`/api/v1/comments/${top.id}`)
        .set(bearer(org.token))
        .expect(204);
      await http()
        .delete(`/api/v1/comments/${top.id}`)
        .set(bearer(org.token))
        .expect(404);

      expect(await commentCount(postId)).toBe(0);
      const res = await http()
        .get(`/api/v1/posts/${postId}/comments`)
        .set(bearer(sara.token))
        .expect(200);
      expect((res.body as { data: CommentBody[] }).data).toHaveLength(0);
    });
  });

  describe('notifications', () => {
    it('notifies the post author of comments and the parent author of replies', async () => {
      const postId = await post();
      await comment(org.token, postId, 'تعليقي على منشوري');
      expect(await inbox(org.token)).toHaveLength(0);

      const top = await comment(sara.token, postId, 'سؤال');
      await comment(omar.token, postId, 'نفس السؤال', top.id);

      const orgTypes = (await inbox(org.token)).map((n) => n.type);
      expect(orgTypes).toEqual(['COMMENT_ON_POST', 'COMMENT_ON_POST']);
      const saraInbox = await inbox(sara.token);
      expect(saraInbox).toHaveLength(1);
      expect(saraInbox[0]).toMatchObject({
        type: 'COMMENT_REPLY',
        actor: { id: omar.user.id },
        post: { id: postId },
      });
    });

    it('tells followers, topic fans and section fans about a new post, once each', async () => {
      const lina = await createUserAndLogin(app, prisma, {
        email: 'lina@example.com',
      });
      await prisma.follow.create({
        data: { followerId: sara.user.id, followingId: org.user.id },
      });
      await prisma.userSectionInterest.create({
        data: { userId: sara.user.id, sectionId },
      });
      await prisma.userTopicInterest.create({
        data: { userId: omar.user.id, topicId },
      });
      await prisma.userSectionInterest.create({
        data: { userId: lina.user.id, sectionId },
      });
      await prisma.userSectionInterest.create({
        data: { userId: org.user.id, sectionId },
      });

      const postId = await post(org.token, { topicIds: [topicId] });

      const types = async (token: string) =>
        (await inbox(token)).map((n) => n.type);
      expect(await types(sara.token)).toEqual(['FOLLOWED_ACCOUNT_POSTED']);
      expect(await types(omar.token)).toEqual(['TOPIC_NEW_POST']);
      expect(await types(lina.token)).toEqual(['SECTION_NEW_POST']);
      expect(await types(org.token)).toEqual([]);
      expect((await inbox(lina.token))[0].post?.id).toBe(postId);
    });

    it('counts unread, marks one or all as read, and keeps inboxes private', async () => {
      const postId = await post();
      await comment(sara.token, postId, 'أول');
      await comment(omar.token, postId, 'ثاني');

      const unread = () =>
        http()
          .get('/api/v1/notifications/unread-count')
          .set(bearer(org.token))
          .expect(200)
          .then((r) => (r.body as { count: number }).count);
      expect(await unread()).toBe(2);

      const [latest] = await inbox(org.token);
      await http()
        .patch(`/api/v1/notifications/${latest.id}/read`)
        .set(bearer(sara.token))
        .expect(404);
      await http()
        .patch(`/api/v1/notifications/${latest.id}/read`)
        .set(bearer(org.token))
        .expect(204);
      expect(await unread()).toBe(1);
      expect(await inbox(org.token, '?unreadOnly=true')).toHaveLength(1);

      const all = await http()
        .post('/api/v1/notifications/read-all')
        .set(bearer(org.token))
        .expect(200);
      expect(all.body).toEqual({ updated: 1 });
      expect(await unread()).toBe(0);

      await http().get('/api/v1/notifications').expect(401);
    });
  });
});
