import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  createTestApp,
  createUserAndLogin,
  TEST_PASSWORD,
} from './utils/test-app';

interface SectionWithTopics {
  id: number;
  slug: string;
  topics: { id: number; slug: string }[];
}

describe('Users & onboarding (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sections: SectionWithTopics[];
  const http = () => request(app.getHttpServer());

  // Reference data the seed would create; inserted once for this file.
  async function seedSections(): Promise<void> {
    const defs = [
      { slug: 'environment', topics: ['tree-planting', 'recycling'] },
      { slug: 'humanitarian', topics: ['food-aid', 'medical-cases'] },
    ];
    for (const [i, def] of defs.entries()) {
      await prisma.section.create({
        data: {
          slug: def.slug,
          nameAr: def.slug,
          nameEn: def.slug,
          logoUrl: '',
          sortOrder: i,
          topics: {
            create: def.topics.map((t, j) => ({
              slug: `${def.slug}--${t}`,
              nameAr: t,
              nameEn: t,
              sortOrder: j,
            })),
          },
        },
      });
    }
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections RESTART IDENTITY CASCADE',
    );
    await seedSections();
    const res = await http().get('/api/v1/sections').expect(200);
    sections = (res.body as { data: SectionWithTopics[] }).data;
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  const env = () => sections[0];
  const hum = () => sections[1];

  it('lists sections with topics, paginated', async () => {
    const res = await http().get('/api/v1/sections?page=1&limit=1').expect(200);
    expect(res.body).toMatchObject({
      data: [{ slug: 'environment' }],
      meta: { page: 1, limit: 1, total: 2, totalPages: 2 },
    });
    expect(sections[0].topics).toHaveLength(2);
  });

  describe('interests and onboarding', () => {
    it('saves interests, sets the primary section and completes onboarding', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'a@example.com',
      });
      const auth = { Authorization: `Bearer ${token}` };

      await http()
        .post('/api/v1/users/me/onboarding/complete')
        .set(auth)
        .expect(400);

      const saved = await http()
        .put('/api/v1/users/me/interests')
        .set(auth)
        .send({
          sectionIds: [env().id, hum().id],
          topicIds: [env().topics[0].id, hum().topics[1].id],
          primarySectionId: env().id,
        })
        .expect(200);
      expect(saved.body).toEqual({
        sectionIds: [env().id, hum().id],
        topicIds: [env().topics[0].id, hum().topics[1].id],
        primarySectionId: env().id,
      });

      const done = await http()
        .post('/api/v1/users/me/onboarding/complete')
        .set(auth)
        .expect(200);
      expect(
        (done.body as { onboardingCompletedAt: string | null })
          .onboardingCompletedAt,
      ).not.toBeNull();
    });

    it('rejects a topic outside the chosen sections', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'a@example.com',
      });
      await http()
        .put('/api/v1/users/me/interests')
        .set('Authorization', `Bearer ${token}`)
        .send({ sectionIds: [env().id], topicIds: [hum().topics[0].id] })
        .expect(400);
    });

    it('rejects a primary section that is not an interest', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'a@example.com',
      });
      const auth = { Authorization: `Bearer ${token}` };
      await http()
        .put('/api/v1/users/me/interests')
        .set(auth)
        .send({
          sectionIds: [env().id],
          topicIds: [env().topics[0].id],
          primarySectionId: hum().id,
        })
        .expect(400);

      await http()
        .put('/api/v1/users/me/interests')
        .set(auth)
        .send({ sectionIds: [env().id], topicIds: [env().topics[0].id] })
        .expect(200);
      await http()
        .patch('/api/v1/users/me/primary-section')
        .set(auth)
        .send({ sectionId: hum().id })
        .expect(400);
      const ok = await http()
        .patch('/api/v1/users/me/primary-section')
        .set(auth)
        .send({ sectionId: env().id })
        .expect(200);
      expect(ok.body).toMatchObject({ primarySectionId: env().id });
    });

    it('drops the primary section when it is no longer an interest', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'a@example.com',
      });
      const auth = { Authorization: `Bearer ${token}` };
      await http()
        .put('/api/v1/users/me/interests')
        .set(auth)
        .send({
          sectionIds: [env().id],
          topicIds: [env().topics[0].id],
          primarySectionId: env().id,
        })
        .expect(200);
      const res = await http()
        .put('/api/v1/users/me/interests')
        .set(auth)
        .send({ sectionIds: [hum().id], topicIds: [hum().topics[0].id] })
        .expect(200);
      expect(res.body).toMatchObject({ primarySectionId: null });
    });

    it('requires a token', async () => {
      await http().get('/api/v1/users/me/interests').expect(401);
    });
  });

  describe('profile and privacy', () => {
    it('updates only the fields sent and never returns the password hash', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'a@example.com',
        bio: 'old bio',
      });
      const res = await http()
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ city: '  Salamiyah  ', governorate: 'HAMA' })
        .expect(200);
      expect(res.body).toMatchObject({
        city: 'Salamiyah',
        governorate: 'HAMA',
        bio: 'old bio',
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('hides profile groups by default and shows them when switched on', async () => {
      const { user, token } = await createUserAndLogin(app, prisma, {
        email: 'a@example.com',
        city: 'Hama',
        workField: 'Design',
      });

      const hidden = await http().get(`/api/v1/users/${user.id}`).expect(200);
      expect(hidden.body).toMatchObject({
        address: null,
        age: null,
        education: null,
        workField: null,
      });
      expect(hidden.body).not.toHaveProperty('birthDate');
      expect(hidden.body).not.toHaveProperty('email');

      await http()
        .patch('/api/v1/users/me/privacy')
        .set('Authorization', `Bearer ${token}`)
        .send({ showAddress: true, showAge: true, showWorkField: true })
        .expect(200);
      const shown = await http().get(`/api/v1/users/${user.id}`).expect(200);
      expect(shown.body).toMatchObject({
        address: { city: 'Hama' },
        workField: 'Design',
      });
      expect(typeof (shown.body as { age: unknown }).age).toBe('number');
    });

    it('always hides profile groups for users under 18', async () => {
      const birthDate = new Date();
      birthDate.setUTCFullYear(birthDate.getUTCFullYear() - 15);
      const { user } = await createUserAndLogin(app, prisma, {
        email: 'teen@example.com',
        birthDate,
        city: 'Hama',
        showAddress: true,
        showAge: true,
        showWorkField: true,
        workField: 'Student',
      });
      const res = await http().get(`/api/v1/users/${user.id}`).expect(200);
      expect(res.body).toMatchObject({
        address: null,
        age: null,
        workField: null,
      });
    });

    it('returns 404 for an unknown user', async () => {
      await http().get('/api/v1/users/999999').expect(404);
    });
  });

  describe('account deletion', () => {
    it('refuses a wrong password', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'a@example.com',
      });
      await http()
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrong password' })
        .expect(400);
    });

    it('anonymizes the account, frees the email and signs out', async () => {
      const { user, token } = await createUserAndLogin(app, prisma, {
        email: 'a@example.com',
        city: 'Hama',
      });
      await http()
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: TEST_PASSWORD })
        .expect(204);

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row).toMatchObject({
        name: 'Deleted account',
        email: null,
        passwordHash: '',
        city: '',
      });
      expect(row.deletedAt).not.toBeNull();
      expect(
        await prisma.refreshToken.count({
          where: { userId: user.id, revokedAt: null },
        }),
      ).toBe(0);

      await http().get(`/api/v1/users/${user.id}`).expect(404);
      await http()
        .post('/api/v1/auth/login')
        .send({ identifier: 'a@example.com', password: TEST_PASSWORD })
        .expect(401);
      // The email can be used for a new account.
      await createUserAndLogin(app, prisma, { email: 'a@example.com' });
    });

    it('does not let the official account delete itself', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'official@example.com',
        isOfficial: true,
        verifiedKind: 'ORGANIZATION',
      });
      await http()
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: TEST_PASSWORD })
        .expect(400);
    });
  });
});
