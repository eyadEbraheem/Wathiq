import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const PDF = Buffer.from('%PDF-1.4 not an image');

interface PostBody {
  id: number;
  title: string;
  body: string;
  section: { slug: string };
  topics: { id: number }[];
  media: { url: string }[];
  author: Record<string, unknown>;
  caseDetails: { contactPhone: string; paymentQrUrl: string } | null;
  opportunity: { isOpen: boolean; mode: string } | null;
  upvoteCount: number;
  upvotedByMe: boolean;
}

describe('Posts & upvotes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let sec: Record<'humanitarian' | 'environment' | 'education', number>;
  let topic: { env1: number; env2: number; edu1: number };

  async function seedSections() {
    const mk = (slug: string, sortOrder: number, topics: string[]) =>
      prisma.section.create({
        data: {
          slug,
          nameAr: slug,
          nameEn: slug,
          logoUrl: '',
          sortOrder,
          topics: {
            create: topics.map((t, i) => ({
              slug: `${slug}--${t}`,
              nameAr: t,
              nameEn: t,
              sortOrder: i,
            })),
          },
        },
        include: { topics: { orderBy: { sortOrder: 'asc' } } },
      });
    const hum = await mk('humanitarian', 0, ['medical']);
    const env = await mk('environment', 1, ['trees', 'clean-ups']);
    const edu = await mk('education', 2, ['scholarships']);
    sec = { humanitarian: hum.id, environment: env.id, education: edu.id };
    topic = {
      env1: env.topics[0].id,
      env2: env.topics[1].id,
      edu1: edu.topics[0].id,
    };
  }

  async function people() {
    const org = await createUserAndLogin(app, prisma, {
      email: 'org@example.com',
      name: 'Green Team',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });
    const other = await createUserAndLogin(app, prisma, {
      email: 'other@example.com',
      name: 'Other Org',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });
    const regular = await createUserAndLogin(app, prisma, {
      email: 'regular@example.com',
    });
    return { org, other, regular };
  }

  async function upload(token: string): Promise<string> {
    const res = await http()
      .post('/api/v1/uploads/images')
      .set(bearer(token))
      .attach('file', PNG, 'photo.png')
      .expect(201);
    return (res.body as { key: string }).key;
  }

  async function createPost(
    token: string,
    body: Record<string, unknown>,
    status = 201,
  ) {
    const res = await http()
      .post('/api/v1/posts')
      .set(bearer(token))
      .send(body)
      .expect(status);
    return res.body as PostBody;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections RESTART IDENTITY CASCADE',
    );
    await seedSections();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  describe('uploads', () => {
    it('stores an image and returns its key and URL', async () => {
      const { regular } = await people();
      const res = await http()
        .post('/api/v1/uploads/images')
        .set(bearer(regular.token))
        .attach('file', PNG, 'photo.png')
        .expect(201);
      const body = res.body as { key: string; url: string; mimeType: string };
      expect(body.key).toMatch(/^public\/[0-9a-f-]{36}\.png$/);
      expect(body.mimeType).toBe('image/png');
      await http().get(new URL(body.url).pathname).expect(200);
    });

    it('refuses files that are not images, and anonymous uploads', async () => {
      const { regular } = await people();
      await http()
        .post('/api/v1/uploads/images')
        .set(bearer(regular.token))
        .attach('file', PDF, 'doc.pdf')
        .expect(400);
      await http()
        .post('/api/v1/uploads/images')
        .attach('file', PNG, 'photo.png')
        .expect(401);
    });
  });

  describe('publishing', () => {
    it('lets a verified account publish with topics and images', async () => {
      const { org } = await people();
      const key = await upload(org.token);
      const post = await createPost(org.token, {
        sectionId: sec.environment,
        title: '  حملة تشجير  ',
        body: 'نزرع 300 شجرة',
        topicIds: [topic.env1, topic.env2],
        imageKeys: [key],
      });
      expect(post.title).toBe('حملة تشجير');
      expect(post.section.slug).toBe('environment');
      expect(post.topics.map((t) => t.id).sort()).toEqual(
        [topic.env1, topic.env2].sort(),
      );
      expect(post.media).toHaveLength(1);
      expect(post.author).toMatchObject({ name: 'Green Team' });
      expect(post.author).not.toHaveProperty('passwordHash');
      expect(post.author).not.toHaveProperty('email');
      expect(post).toMatchObject({
        upvoteCount: 0,
        upvotedByMe: false,
        caseDetails: null,
        opportunity: null,
      });
    });

    it('refuses regular accounts and anonymous callers', async () => {
      const { regular } = await people();
      await createPost(
        regular.token,
        { sectionId: sec.environment, title: 'عنوان', body: 'نص' },
        403,
      );
      await http()
        .post('/api/v1/posts')
        .send({ sectionId: sec.environment, title: 'عنوان', body: 'نص' })
        .expect(401);
    });

    it('validates section, topics and images', async () => {
      const { org } = await people();
      const base = { title: 'عنوان', body: 'نص' };
      await createPost(org.token, { ...base, sectionId: 999 }, 404);
      await createPost(
        org.token,
        { ...base, sectionId: sec.environment, topicIds: [topic.edu1] },
        400,
      );
      await createPost(
        org.token,
        {
          ...base,
          sectionId: sec.environment,
          imageKeys: ['public/00000000-0000-0000-0000-000000000000.png'],
        },
        400,
      );
      await createPost(
        org.token,
        { ...base, sectionId: sec.environment, title: '' },
        400,
      );
    });

    it('publishes a humanitarian case only in the humanitarian section', async () => {
      const { org } = await people();
      const qr = await upload(org.token);
      const caseDetails = { contactPhone: '+963912345678', paymentQrKey: qr };
      const post = await createPost(org.token, {
        sectionId: sec.humanitarian,
        title: 'عملية قلب عاجلة',
        body: 'تفاصيل الحالة',
        caseDetails,
      });
      expect(post.caseDetails?.contactPhone).toBe('+963912345678');
      expect(post.caseDetails?.paymentQrUrl).toContain('/files/public/');

      await createPost(
        org.token,
        {
          sectionId: sec.environment,
          title: 'عنوان',
          body: 'نص',
          caseDetails,
        },
        400,
      );
      await createPost(
        org.token,
        {
          sectionId: sec.humanitarian,
          title: 'عنوان',
          body: 'نص',
          caseDetails: { contactPhone: '0912345678' },
        },
        400,
      );
    });

    it('publishes an opportunity only in the education section, with valid dates and ages', async () => {
      const { org } = await people();
      const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const opportunity = {
        deadline: future,
        applyUrl: 'https://example.org/apply',
        mode: 'ONLINE',
        minAge: 18,
        maxAge: 30,
      };
      const post = await createPost(org.token, {
        sectionId: sec.education,
        title: 'منحة ماجستير',
        body: 'تفاصيل المنحة',
        opportunity,
      });
      expect(post.opportunity).toMatchObject({ mode: 'ONLINE', isOpen: true });

      const base = { title: 'منحة', body: 'نص' };
      await createPost(
        org.token,
        { ...base, sectionId: sec.environment, opportunity },
        400,
      );
      await createPost(
        org.token,
        {
          ...base,
          sectionId: sec.education,
          opportunity: {
            ...opportunity,
            deadline: new Date(Date.now() - 86_400_000).toISOString(),
          },
        },
        400,
      );
      await createPost(
        org.token,
        {
          ...base,
          sectionId: sec.education,
          opportunity: { ...opportunity, minAge: 40 },
        },
        400,
      );
      await createPost(
        org.token,
        {
          ...base,
          sectionId: sec.education,
          opportunity: { ...opportunity, applyUrl: 'not a url' },
        },
        400,
      );
    });
  });

  describe('feed', () => {
    it('shows the home section by default: primary section, else humanitarian', async () => {
      const { org, regular } = await people();
      await createPost(org.token, {
        sectionId: sec.humanitarian,
        title: 'إنساني',
        body: 'نص',
      });
      await createPost(org.token, {
        sectionId: sec.environment,
        title: 'بيئي',
        body: 'نص',
      });

      let res = await http()
        .get('/api/v1/posts')
        .set(bearer(regular.token))
        .expect(200);
      let data = (res.body as { data: PostBody[] }).data;
      expect(data.map((p) => p.title)).toEqual(['إنساني']);

      await prisma.user.update({
        where: { id: regular.user.id },
        data: { primarySectionId: sec.environment },
      });
      res = await http()
        .get('/api/v1/posts')
        .set(bearer(regular.token))
        .expect(200);
      data = (res.body as { data: PostBody[] }).data;
      expect(data.map((p) => p.title)).toEqual(['بيئي']);
    });

    it('sorts by newest or top, filters by topic, author and cases, and paginates', async () => {
      const { org, other, regular } = await people();
      const a = await createPost(org.token, {
        sectionId: sec.environment,
        title: 'Alpha',
        body: 'نص',
        topicIds: [topic.env1],
      });
      await createPost(other.token, {
        sectionId: sec.environment,
        title: 'Beta',
        body: 'نص',
        topicIds: [topic.env2],
      });
      await http()
        .post(`/api/v1/posts/${a.id}/upvote`)
        .set(bearer(regular.token))
        .expect(200);

      const titles = async (q: string) => {
        const res = await http()
          .get(`/api/v1/posts?${q}`)
          .set(bearer(regular.token))
          .expect(200);
        return (res.body as { data: PostBody[] }).data.map((p) => p.title);
      };
      expect(await titles(`sectionId=${sec.environment}`)).toEqual([
        'Beta',
        'Alpha',
      ]);
      expect(await titles(`sectionId=${sec.environment}&sort=top`)).toEqual([
        'Alpha',
        'Beta',
      ]);
      expect(
        await titles(`sectionId=${sec.environment}&topicId=${topic.env2}`),
      ).toEqual(['Beta']);
      expect(await titles(`authorId=${org.user.id}`)).toEqual(['Alpha']);

      const page = await http()
        .get(`/api/v1/posts?sectionId=${sec.environment}&limit=1&page=2`)
        .set(bearer(regular.token))
        .expect(200);
      const body = page.body as { data: PostBody[]; meta: unknown };
      expect(body.data.map((p) => p.title)).toEqual(['Alpha']);
      expect(body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
      expect(body.data[0].upvotedByMe).toBe(true);

      await createPost(org.token, {
        sectionId: sec.humanitarian,
        title: 'حالة',
        body: 'نص',
        caseDetails: { contactPhone: '+963912345678' },
      });
      await createPost(org.token, {
        sectionId: sec.humanitarian,
        title: 'منشور',
        body: 'نص',
      });
      expect(await titles(`sectionId=${sec.humanitarian}&cases=true`)).toEqual([
        'حالة',
      ]);
      expect(await titles(`sectionId=${sec.humanitarian}&cases=false`)).toEqual(
        ['منشور'],
      );
    });

    it('lists only open opportunities when asked', async () => {
      const { org, regular } = await people();
      const opportunity = {
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        applyUrl: 'https://example.org/apply',
        mode: 'HYBRID',
      };
      const open = await createPost(org.token, {
        sectionId: sec.education,
        title: 'مفتوحة',
        body: 'نص',
        opportunity,
      });
      const closed = await createPost(org.token, {
        sectionId: sec.education,
        title: 'منتهية',
        body: 'نص',
        opportunity,
      });
      await prisma.opportunityDetails.update({
        where: { postId: closed.id },
        data: { deadline: new Date(Date.now() - 1000) },
      });

      const res = await http()
        .get(`/api/v1/posts?sectionId=${sec.education}&openOpportunities=true`)
        .set(bearer(regular.token))
        .expect(200);
      const data = (res.body as { data: PostBody[] }).data;
      expect(data.map((p) => p.id)).toEqual([open.id]);

      const closedView = await http()
        .get(`/api/v1/posts/${closed.id}`)
        .set(bearer(regular.token))
        .expect(200);
      expect((closedView.body as PostBody).opportunity?.isOpen).toBe(false);
    });

    it('needs a token', async () => {
      await http().get('/api/v1/posts').expect(401);
    });
  });

  describe('editing and deleting', () => {
    it('changes only the fields sent and replaces images, removing old files', async () => {
      const { org } = await people();
      const oldKey = await upload(org.token);
      const post = await createPost(org.token, {
        sectionId: sec.humanitarian,
        title: 'قبل',
        body: 'النص الأصلي',
        imageKeys: [oldKey],
        caseDetails: { contactPhone: '+963912345678' },
      });
      const oldUrl = new URL(post.media[0].url).pathname;
      const newKey = await upload(org.token);

      const res = await http()
        .patch(`/api/v1/posts/${post.id}`)
        .set(bearer(org.token))
        .send({ title: 'بعد', imageKeys: [newKey], caseDetails: null })
        .expect(200);
      const updated = res.body as PostBody;
      expect(updated.title).toBe('بعد');
      expect(updated.body).toBe('النص الأصلي');
      expect(updated.caseDetails).toBeNull();
      expect(updated.media).toHaveLength(1);
      expect(updated.media[0].url).toContain(newKey.split('/')[1]);
      await http().get(oldUrl).expect(404);
    });

    it("refuses to edit someone else's post or an unknown one", async () => {
      const { org, other } = await people();
      const post = await createPost(org.token, {
        sectionId: sec.environment,
        title: 'عنوان',
        body: 'نص',
      });
      await http()
        .patch(`/api/v1/posts/${post.id}`)
        .set(bearer(other.token))
        .send({ title: 'سرقة' })
        .expect(403);
      await http()
        .patch('/api/v1/posts/9999')
        .set(bearer(org.token))
        .send({ title: 'عنوان جديد' })
        .expect(404);
    });

    it('lets the author or an admin delete, then hides the post', async () => {
      const { org, other, regular } = await people();
      const first = await createPost(org.token, {
        sectionId: sec.environment,
        title: 'أول',
        body: 'نص',
      });
      const second = await createPost(org.token, {
        sectionId: sec.environment,
        title: 'ثاني',
        body: 'نص',
      });
      await http()
        .delete(`/api/v1/posts/${first.id}`)
        .set(bearer(other.token))
        .expect(403);
      await http()
        .delete(`/api/v1/posts/${first.id}`)
        .set(bearer(org.token))
        .expect(204);
      await http()
        .get(`/api/v1/posts/${first.id}`)
        .set(bearer(regular.token))
        .expect(404);

      const admin = await createUserAndLogin(app, prisma, {
        email: 'admin@example.com',
        role: 'ADMIN',
      });
      await http()
        .delete(`/api/v1/posts/${second.id}`)
        .set(bearer(admin.token))
        .expect(204);

      const feed = await http()
        .get(`/api/v1/posts?sectionId=${sec.environment}`)
        .set(bearer(regular.token))
        .expect(200);
      expect((feed.body as { data: PostBody[] }).data).toHaveLength(0);
    });
  });

  describe('upvotes', () => {
    it('counts one upvote per user, idempotently, and can be removed', async () => {
      const { org, regular, other } = await people();
      const post = await createPost(org.token, {
        sectionId: sec.environment,
        title: 'عنوان',
        body: 'نص',
      });
      const up = (token: string) =>
        http()
          .post(`/api/v1/posts/${post.id}/upvote`)
          .set(bearer(token))
          .expect(200);

      await up(regular.token);
      const twice = await up(regular.token);
      expect(twice.body).toEqual({ upvoteCount: 1, upvotedByMe: true });
      const third = await up(other.token);
      expect(third.body).toEqual({ upvoteCount: 2, upvotedByMe: true });

      const removed = await http()
        .delete(`/api/v1/posts/${post.id}/upvote`)
        .set(bearer(regular.token))
        .expect(200);
      expect(removed.body).toEqual({ upvoteCount: 1, upvotedByMe: false });
      const again = await http()
        .delete(`/api/v1/posts/${post.id}/upvote`)
        .set(bearer(regular.token))
        .expect(200);
      expect(again.body).toEqual({ upvoteCount: 1, upvotedByMe: false });
    });

    it('returns 404 for a deleted or unknown post', async () => {
      const { org, regular } = await people();
      const post = await createPost(org.token, {
        sectionId: sec.environment,
        title: 'عنوان',
        body: 'نص',
      });
      await http()
        .delete(`/api/v1/posts/${post.id}`)
        .set(bearer(org.token))
        .expect(204);
      await http()
        .post(`/api/v1/posts/${post.id}/upvote`)
        .set(bearer(regular.token))
        .expect(404);
      await http()
        .post('/api/v1/posts/9999/upvote')
        .set(bearer(regular.token))
        .expect(404);
    });
  });
});
