import { INestApplication } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

type Person = Awaited<ReturnType<typeof createUserAndLogin>>;

interface RequestBody {
  id: number;
  status: string;
  toPlatform: boolean;
  resultingPostId: number | null;
  attribution: string | null;
  images: string[];
  caseDetails: { contactPhone: string; paymentQrUrl: string } | null;
}

interface PostBody {
  id: number;
  author: { id: number };
  creditedUser: { id: number } | null;
  caseDetails: { contactPhone: string } | null;
  collaborators: { id: number }[];
  commentCount: number;
  media: unknown[];
  topics: { id: number }[];
}

describe('Publish requests, collaborations & moderation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let sec: { humanitarian: number; environment: number };
  let envTopic: number;
  let counter = 0;

  function person(data: Partial<Prisma.UserCreateInput> = {}): Promise<Person> {
    counter += 1;
    return createUserAndLogin(app, prisma, {
      name: `User ${counter}`,
      ...data,
      email: `rm${counter}@example.com`,
    });
  }

  const verified = (data: Partial<Prisma.UserCreateInput> = {}) =>
    person({ verifiedKind: 'ORGANIZATION', verifiedAt: new Date(), ...data });

  async function upload(token: string): Promise<string> {
    const res = await http()
      .post('/api/v1/uploads/images')
      .set(bearer(token))
      .attach('file', PNG, 'photo.png')
      .expect(201);
    return (res.body as { key: string }).key;
  }

  async function sendRequest(
    token: string,
    body: Record<string, unknown>,
    status = 201,
  ) {
    const res = await http()
      .post('/api/v1/publish-requests')
      .set(bearer(token))
      .send({ title: 'طلب نشر', body: 'نص الطلب', ...body })
      .expect(status);
    return res.body as RequestBody;
  }

  async function getPost(token: string, id: number, status = 200) {
    const res = await http()
      .get(`/api/v1/posts/${id}`)
      .set(bearer(token))
      .expect(status);
    return res.body as PostBody;
  }

  async function publish(token: string) {
    const res = await http()
      .post('/api/v1/posts')
      .set(bearer(token))
      .send({ sectionId: sec.environment, title: 'منشور', body: 'نص المنشور' })
      .expect(201);
    return res.body as PostBody;
  }

  const notifications = (userId: number) =>
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { id: 'asc' },
    });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections, banned_words RESTART IDENTITY CASCADE',
    );
    const hum = await prisma.section.create({
      data: {
        slug: 'humanitarian',
        nameAr: 'إنساني',
        nameEn: 'Humanitarian',
        logoUrl: '',
      },
    });
    const env = await prisma.section.create({
      data: {
        slug: 'environment',
        nameAr: 'بيئي',
        nameEn: 'Environment',
        logoUrl: '',
        topics: {
          create: [
            { slug: 'environment--trees', nameAr: 'تشجير', nameEn: 'Trees' },
          ],
        },
      },
      include: { topics: true },
    });
    sec = { humanitarian: hum.id, environment: env.id };
    envTopic = env.topics[0].id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections, banned_words RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  describe('publish requests', () => {
    it('lets a regular user ask an account, which publishes it crediting the requester', async () => {
      const org = await verified({ name: 'Green Team' });
      const closed = await verified({ acceptsPublishRequests: false });
      const requester = await person();
      const stranger = await person();
      const key = await upload(requester.token);

      await sendRequest(
        org.token,
        { targetUserId: closed.user.id, sectionId: sec.environment },
        400,
      );
      await sendRequest(
        requester.token,
        { targetUserId: closed.user.id, sectionId: sec.environment },
        400,
      );
      await sendRequest(
        requester.token,
        {
          targetUserId: org.user.id,
          sectionId: sec.environment,
          requestedAttribution: 'REQUESTER',
        },
        400,
      );
      await sendRequest(
        requester.token,
        {
          targetUserId: org.user.id,
          sectionId: sec.environment,
          caseDetails: { contactPhone: '+963912345678' },
        },
        400,
      );

      const sent = await sendRequest(requester.token, {
        targetUserId: org.user.id,
        sectionId: sec.environment,
        imageKeys: [key],
      });
      expect(sent).toMatchObject({ status: 'PENDING', toPlatform: false });
      expect(sent.images).toHaveLength(1);
      expect((await notifications(org.user.id)).map((n) => n.type)).toEqual([
        'PUBLISH_REQUEST_RECEIVED',
      ]);
      await http()
        .get(`/api/v1/publish-requests/${sent.id}`)
        .set(bearer(stranger.token))
        .expect(403);
      const incoming = await http()
        .get('/api/v1/publish-requests/incoming?status=PENDING')
        .set(bearer(org.token))
        .expect(200);
      expect((incoming.body as { data: unknown[] }).data).toHaveLength(1);

      await http()
        .post(`/api/v1/publish-requests/${sent.id}/approve`)
        .set(bearer(stranger.token))
        .send({ attribution: 'PUBLISHER' })
        .expect(403);
      await http()
        .post(`/api/v1/publish-requests/${sent.id}/approve`)
        .set(bearer(org.token))
        .send({})
        .expect(400);
      const approved = await http()
        .post(`/api/v1/publish-requests/${sent.id}/approve`)
        .set(bearer(org.token))
        .send({ attribution: 'REQUESTER', topicIds: [envTopic] })
        .expect(200);
      const body = approved.body as RequestBody;
      expect(body).toMatchObject({
        status: 'APPROVED',
        attribution: 'REQUESTER',
      });
      const post = await getPost(
        stranger.token,
        body.resultingPostId as number,
      );
      expect(post.author.id).toBe(org.user.id);
      expect(post.creditedUser?.id).toBe(requester.user.id);
      expect(post.media).toHaveLength(1);
      expect(post.topics.map((t) => t.id)).toEqual([envTopic]);
      expect(
        (await notifications(requester.user.id)).map((n) => n.type),
      ).toContain('PUBLISH_REQUEST_DECIDED');
      await http()
        .post(`/api/v1/publish-requests/${sent.id}/reject`)
        .set(bearer(org.token))
        .send({})
        .expect(400);
    });

    it('sends platform requests to admins, who publish them from the official account', async () => {
      const official = await verified({ name: 'واثق', isOfficial: true });
      const admin = await person({ role: 'ADMIN' });
      const requester = await person();
      const qr = await upload(requester.token);

      await sendRequest(requester.token, { sectionId: sec.humanitarian }, 400);
      const sent = await sendRequest(requester.token, {
        sectionId: sec.humanitarian,
        requestedAttribution: 'PUBLISHER',
        caseDetails: {
          contactPhone: '+963912345678',
          paymentQrKey: qr,
          paymentNote: 'شام كاش',
        },
      });
      expect(sent).toMatchObject({
        toPlatform: true,
        caseDetails: { contactPhone: '+963912345678' },
      });
      expect((await notifications(admin.user.id)).map((n) => n.type)).toEqual([
        'PUBLISH_REQUEST_RECEIVED',
      ]);

      await http()
        .get('/api/v1/publish-requests/platform')
        .set(bearer(requester.token))
        .expect(403);
      await http()
        .post(`/api/v1/publish-requests/${sent.id}/approve`)
        .set(bearer(official.token))
        .send({})
        .expect(403);
      await http()
        .post(`/api/v1/publish-requests/${sent.id}/approve`)
        .set(bearer(admin.token))
        .send({ attribution: 'REQUESTER' })
        .expect(400);
      const approved = await http()
        .post(`/api/v1/publish-requests/${sent.id}/approve`)
        .set(bearer(admin.token))
        .send({})
        .expect(200);
      const post = await getPost(
        requester.token,
        (approved.body as RequestBody).resultingPostId as number,
      );
      expect(post.author.id).toBe(official.user.id);
      expect(post.creditedUser).toBeNull();
      expect(post.caseDetails?.contactPhone).toBe('+963912345678');
    });

    it('lets the requester cancel, the target reject with a reason, and accounts stop requests', async () => {
      const org = await verified();
      const requester = await person();
      const first = await sendRequest(requester.token, {
        targetUserId: org.user.id,
        sectionId: sec.environment,
      });
      const other = await person();
      await http()
        .post(`/api/v1/publish-requests/${first.id}/cancel`)
        .set(bearer(other.token))
        .expect(403);
      const cancelled = await http()
        .post(`/api/v1/publish-requests/${first.id}/cancel`)
        .set(bearer(requester.token))
        .expect(200);
      expect((cancelled.body as RequestBody).status).toBe('CANCELLED');

      const second = await sendRequest(requester.token, {
        targetUserId: org.user.id,
        sectionId: sec.environment,
      });
      const rejected = await http()
        .post(`/api/v1/publish-requests/${second.id}/reject`)
        .set(bearer(org.token))
        .send({ reason: 'غير مناسب' })
        .expect(200);
      expect(rejected.body).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'غير مناسب',
      });

      await http()
        .patch('/api/v1/users/me/privacy')
        .set(bearer(org.token))
        .send({ acceptsPublishRequests: false })
        .expect(200);
      await sendRequest(
        requester.token,
        { targetUserId: org.user.id, sectionId: sec.environment },
        400,
      );
      const mine = await http()
        .get('/api/v1/publish-requests/mine')
        .set(bearer(requester.token))
        .expect(200);
      expect((mine.body as { data: unknown[] }).data).toHaveLength(2);
    });
  });

  describe('collaborations', () => {
    it('invites an account; on acceptance it shows on the post and its followers hear about it', async () => {
      const author = await verified({ name: 'Author' });
      const partner = await verified({ name: 'Partner' });
      const partnerFan = await person();
      const bothFan = await person();
      for (const [follower, following] of [
        [partnerFan, partner],
        [bothFan, partner],
        [bothFan, author],
      ] as const) {
        await prisma.follow.create({
          data: {
            followerId: follower.user.id,
            followingId: following.user.id,
          },
        });
      }
      const post = await publish(author.token);

      await http()
        .post(`/api/v1/posts/${post.id}/collaborations`)
        .set(bearer(partner.token))
        .send({ inviteeId: author.user.id })
        .expect(403);
      await http()
        .post(`/api/v1/posts/${post.id}/collaborations`)
        .set(bearer(author.token))
        .send({ inviteeId: author.user.id })
        .expect(400);
      const invited = await http()
        .post(`/api/v1/posts/${post.id}/collaborations`)
        .set(bearer(author.token))
        .send({ inviteeId: partner.user.id })
        .expect(201);
      const collabId = (invited.body as { id: number }).id;
      await http()
        .post(`/api/v1/posts/${post.id}/collaborations`)
        .set(bearer(author.token))
        .send({ inviteeId: partner.user.id })
        .expect(409);
      expect((await notifications(partner.user.id)).map((n) => n.type)).toEqual(
        ['COLLAB_INVITED'],
      );

      await http()
        .post(`/api/v1/collaborations/${collabId}/accept`)
        .set(bearer(author.token))
        .expect(403);
      await http()
        .post(`/api/v1/collaborations/${collabId}/accept`)
        .set(bearer(partner.token))
        .expect(200);
      expect(
        (await getPost(partnerFan.token, post.id)).collaborators.map(
          (c) => c.id,
        ),
      ).toEqual([partner.user.id]);
      expect(
        (await notifications(author.user.id)).map((n) => n.type),
      ).toContain('COLLAB_ACCEPTED');
      // The partner's follower is told; the follower of both already was, so no second notice.
      expect(
        (await notifications(partnerFan.user.id)).map((n) => n.type),
      ).toEqual(['FOLLOWED_ACCOUNT_POSTED']);
      expect(await notifications(bothFan.user.id)).toHaveLength(1);

      // The partner leaves; the author can invite again.
      await http()
        .post(`/api/v1/collaborations/${collabId}/cancel`)
        .set(bearer(partner.token))
        .expect(200);
      expect((await getPost(partnerFan.token, post.id)).collaborators).toEqual(
        [],
      );
      const again = await http()
        .post(`/api/v1/posts/${post.id}/collaborations`)
        .set(bearer(author.token))
        .send({ inviteeId: partner.user.id })
        .expect(201);
      expect((again.body as { id: number }).id).toBe(collabId);
      await http()
        .post(`/api/v1/collaborations/${collabId}/decline`)
        .set(bearer(partner.token))
        .expect(200);
      const incoming = await http()
        .get('/api/v1/collaborations/incoming?status=DECLINED')
        .set(bearer(partner.token))
        .expect(200);
      expect((incoming.body as { data: unknown[] }).data).toHaveLength(1);
    });
  });

  describe('reports & admin', () => {
    it('queues reports for admins, who can hide the content and resolve every report on it', async () => {
      const admin = await person({ role: 'ADMIN' });
      const author = await verified();
      const [a, b] = [await person(), await person()];
      const post = await publish(author.token);

      const report = async (
        token: string,
        body: Record<string, unknown>,
        status = 201,
      ) =>
        (
          await http()
            .post('/api/v1/reports')
            .set(bearer(token))
            .send(body)
            .expect(status)
        ).body as { id: number };
      const first = await report(a.token, {
        target: 'POST',
        targetId: post.id,
        reason: 'FRAUD',
      });
      await report(
        a.token,
        { target: 'POST', targetId: post.id, reason: 'SPAM' },
        409,
      );
      await report(b.token, {
        target: 'POST',
        targetId: post.id,
        reason: 'MISLEADING',
        details: 'كذب',
      });
      await report(
        a.token,
        { target: 'USER', targetId: a.user.id, reason: 'OTHER' },
        400,
      );
      await report(
        a.token,
        { target: 'POST', targetId: 999, reason: 'OTHER' },
        404,
      );

      await http()
        .get('/api/v1/admin/reports')
        .set(bearer(a.token))
        .expect(403);
      const queue = await http()
        .get('/api/v1/admin/reports')
        .set(bearer(admin.token))
        .expect(200);
      expect(
        (queue.body as { data: { id: number }[] }).data.map((r) => r.id)[0],
      ).toBe(first.id);

      await http()
        .post(`/api/v1/admin/reports/${first.id}/resolve`)
        .set(bearer(admin.token))
        .send({ hideContent: true })
        .expect(200);
      expect(await prisma.report.count({ where: { status: 'OPEN' } })).toBe(0);
      await getPost(a.token, post.id, 404);
      expect(
        (await notifications(author.user.id)).map((n) => n.type),
      ).toContain('CONTENT_MODERATED');
      await http()
        .post(`/api/v1/admin/reports/${first.id}/dismiss`)
        .set(bearer(admin.token))
        .expect(400);

      await http()
        .post(`/api/v1/admin/posts/${post.id}/restore`)
        .set(bearer(admin.token))
        .expect(200);
      await getPost(a.token, post.id);
    });

    it('hides and restores comments keeping the comment count exact', async () => {
      const admin = await person({ role: 'ADMIN' });
      const author = await verified();
      const commenter = await person();
      const post = await publish(author.token);
      const comment = await http()
        .post(`/api/v1/posts/${post.id}/comments`)
        .set(bearer(commenter.token))
        .send({ body: 'تعليق' })
        .expect(201);
      const commentId = (comment.body as { id: number }).id;
      await http()
        .post(`/api/v1/posts/${post.id}/comments`)
        .set(bearer(author.token))
        .send({ body: 'رد', parentId: commentId })
        .expect(201);
      expect((await getPost(admin.token, post.id)).commentCount).toBe(2);

      const reported = await http()
        .post('/api/v1/reports')
        .set(bearer(author.token))
        .send({ target: 'COMMENT', targetId: commentId, reason: 'OFFENSIVE' })
        .expect(201);
      await http()
        .post(
          `/api/v1/admin/reports/${(reported.body as { id: number }).id}/resolve`,
        )
        .set(bearer(admin.token))
        .send({ hideContent: true })
        .expect(200);
      expect((await getPost(admin.token, post.id)).commentCount).toBe(0);
      await http()
        .post(`/api/v1/admin/comments/${commentId}/restore`)
        .set(bearer(admin.token))
        .expect(200);
      expect((await getPost(admin.token, post.id)).commentCount).toBe(2);
    });

    it('suspends and unsuspends accounts', async () => {
      const admin = await person({ role: 'ADMIN' });
      const otherAdmin = await person({ role: 'ADMIN' });
      const org = await verified();
      await http()
        .post(`/api/v1/admin/users/${org.user.id}/suspend`)
        .set(bearer(org.token))
        .expect(403);
      await http()
        .post(`/api/v1/admin/users/${otherAdmin.user.id}/suspend`)
        .set(bearer(admin.token))
        .expect(400);
      await http()
        .post(`/api/v1/admin/users/${org.user.id}/suspend`)
        .set(bearer(admin.token))
        .expect(200);
      await http()
        .post('/api/v1/posts')
        .set(bearer(org.token))
        .send({ sectionId: sec.environment, title: 'منشور', body: 'نص' })
        .expect(403);
      await http()
        .post(`/api/v1/admin/users/${org.user.id}/unsuspend`)
        .set(bearer(admin.token))
        .expect(200);
      await publish(org.token);
    });

    it('manages the banned words used by comments', async () => {
      const admin = await person({ role: 'ADMIN' });
      const author = await verified();
      const post = await publish(author.token);
      const added = await http()
        .post('/api/v1/admin/banned-words')
        .set(bearer(admin.token))
        .send({ word: 'كلمةممنوعة' })
        .expect(201);
      await http()
        .post('/api/v1/admin/banned-words')
        .set(bearer(admin.token))
        .send({ word: ' كلمةممنوعة ' })
        .expect(409);
      await http()
        .post(`/api/v1/posts/${post.id}/comments`)
        .set(bearer(author.token))
        .send({ body: 'هذه كلمةممنوعة هنا' })
        .expect(400);
      const list = await http()
        .get('/api/v1/admin/banned-words?q=كلمة')
        .set(bearer(admin.token))
        .expect(200);
      expect((list.body as { data: unknown[] }).data).toHaveLength(1);
      await http()
        .delete(
          `/api/v1/admin/banned-words/${(added.body as { id: number }).id}`,
        )
        .set(bearer(admin.token))
        .expect(204);
      await http()
        .post(`/api/v1/posts/${post.id}/comments`)
        .set(bearer(author.token))
        .send({ body: 'هذه كلمةممنوعة هنا' })
        .expect(201);
    });
  });
});
