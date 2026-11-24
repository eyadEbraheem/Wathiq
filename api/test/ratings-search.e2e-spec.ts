import { INestApplication } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

type Person = Awaited<ReturnType<typeof createUserAndLogin>>;

interface Rating {
  hidden: boolean;
  enoughRatings: boolean;
  average: number | null;
  count: number | null;
}

describe('Ratings, specialties, search & CV (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let sectionId: number;
  let educationId: number;
  let counter = 0;

  function person(data: Partial<Prisma.UserCreateInput> = {}): Promise<Person> {
    counter += 1;
    return createUserAndLogin(app, prisma, {
      name: `User ${counter}`,
      ...data,
      email: `rs${counter}@example.com`,
    });
  }

  const organizer = (data: Partial<Prisma.UserCreateInput> = {}) =>
    person({
      name: 'Green Team',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
      ...data,
    });

  /**
   * A COMPLETED event of `org` with these volunteers accepted (documented through the API).
   * Returns the event id and each volunteer's application id.
   */
  async function completedEvent(
    org: Person,
    volunteers: Person[],
    metrics: { label: string; value: number }[] = [],
    extra: Record<string, unknown> = {},
  ) {
    const created = await http()
      .post('/api/v1/events')
      .set(bearer(org.token))
      .send({
        sectionId,
        title: 'حملة تشجير',
        body: 'نزرع الأشجار',
        startsAt: inDays(3).toISOString(),
        volunteerHours: 3,
        governorate: 'DAMASCUS',
        city: 'دمشق',
        roles: [{ name: 'تنظيم', seats: 10 }],
        ...extra,
      })
      .expect(201);
    const event = created.body as {
      id: number;
      event: { roles: { id: number }[] };
    };
    const roleId = event.event.roles[0].id;
    const applications: number[] = [];
    for (const v of volunteers) {
      const applied = await http()
        .post(`/api/v1/events/${event.id}/applications`)
        .set(bearer(v.token))
        .send({ roleIds: [roleId] })
        .expect(201);
      const id = (applied.body as { id: number }).id;
      await http()
        .post(`/api/v1/event-applications/${id}/accept`)
        .set(bearer(org.token))
        .send({ roleId })
        .expect(200);
      applications.push(id);
    }
    await prisma.event.update({
      where: { postId: event.id },
      data: { startsAt: inDays(-1) },
    });
    const upload = await http()
      .post('/api/v1/uploads/images')
      .set(bearer(org.token))
      .attach('file', PNG, 'photo.png')
      .expect(201);
    await http()
      .post(`/api/v1/events/${event.id}/documentation`)
      .set(bearer(org.token))
      .send({
        documentation: 'وثّقنا الفعالية بالصور',
        imageKeys: [(upload.body as { key: string }).key],
        metrics,
      })
      .expect(200);
    return { eventId: event.id, applications };
  }

  const rate = (
    token: string,
    applicationId: number,
    stars: number,
    status = 200,
  ) =>
    http()
      .put('/api/v1/ratings')
      .set(bearer(token))
      .send({ applicationId, stars })
      .expect(status);

  async function stats(token: string, organizerId: number) {
    const res = await http()
      .get(`/api/v1/users/${organizerId}/organizer-stats`)
      .set(bearer(token))
      .expect(200);
    return res.body as {
      completedEvents: number;
      acceptedVolunteers: number;
      impact: { label: string; total: number }[];
      rating: Rating;
    };
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections, specialties RESTART IDENTITY CASCADE',
    );
    const section = await prisma.section.create({
      data: {
        slug: 'environment',
        nameAr: 'بيئي',
        nameEn: 'Environment',
        logoUrl: '',
      },
    });
    sectionId = section.id;
    const education = await prisma.section.create({
      data: {
        slug: 'education',
        nameAr: 'تعليمي',
        nameEn: 'Education',
        logoUrl: '',
        topics: {
          create: [
            {
              slug: 'education--trainings',
              nameAr: 'تدريبات',
              nameEn: 'Trainings',
            },
          ],
        },
      },
    });
    educationId = education.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections, specialties RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  describe('ratings', () => {
    it('lets accepted volunteers of a completed event rate, and edit within 30 days', async () => {
      const org = await organizer();
      const volunteer = await person();
      const stranger = await person();
      const { eventId, applications } = await completedEvent(org, [volunteer]);

      await rate(stranger.token, applications[0], 5, 403);
      await rate(volunteer.token, applications[0], 6, 400);
      const first = await rate(volunteer.token, applications[0], 4);
      expect(first.body).toMatchObject({
        stars: 4,
        applicationId: applications[0],
      });
      const edited = await rate(volunteer.token, applications[0], 5);
      expect((edited.body as { id: number }).id).toBe(
        (first.body as { id: number }).id,
      );

      const page = await http()
        .get(`/api/v1/events/${eventId}`)
        .set(bearer(volunteer.token))
        .expect(200);
      expect(page.body).toMatchObject({
        myApplication: { rating: { stars: 5 } },
      });

      // 31 days after the documentation the rating is locked.
      await prisma.event.update({
        where: { postId: eventId },
        data: { documentedAt: inDays(-31) },
      });
      await rate(volunteer.token, applications[0], 3, 400);
    });

    it('refuses ratings before the event is completed', async () => {
      const org = await organizer();
      const volunteer = await person();
      const created = await http()
        .post('/api/v1/events')
        .set(bearer(org.token))
        .send({
          sectionId,
          title: 'فعالية قادمة',
          body: 'نص',
          startsAt: inDays(3).toISOString(),
          volunteerHours: 3,
          governorate: 'DAMASCUS',
          city: 'دمشق',
        })
        .expect(201);
      const applied = await http()
        .post(
          `/api/v1/events/${(created.body as { id: number }).id}/applications`,
        )
        .set(bearer(volunteer.token))
        .send({})
        .expect(201);
      await rate(volunteer.token, (applied.body as { id: number }).id, 5, 400);
    });

    it('shows the average from 3 ratings, can be hidden, and drops cancelled events', async () => {
      const org = await organizer();
      const [a, b, c] = [await person(), await person(), await person()];
      const viewer = await person();
      const { eventId, applications } = await completedEvent(org, [a, b, c]);
      await rate(a.token, applications[0], 5);
      await rate(b.token, applications[1], 4);

      expect((await stats(viewer.token, org.user.id)).rating).toEqual({
        hidden: false,
        enoughRatings: false,
        average: null,
        count: null,
      });
      // The organizer always sees its own numbers.
      expect((await stats(org.token, org.user.id)).rating).toMatchObject({
        average: 4.5,
        count: 2,
      });

      await rate(c.token, applications[2], 3);
      expect((await stats(viewer.token, org.user.id)).rating).toEqual({
        hidden: false,
        enoughRatings: true,
        average: 4,
        count: 3,
      });

      const received = await http()
        .get('/api/v1/ratings/received')
        .set(bearer(org.token))
        .expect(200);
      const rows = (received.body as { data: { rater: { id: number } }[] })
        .data;
      expect(rows.map((r) => r.rater.id).sort()).toEqual(
        [a.user.id, b.user.id, c.user.id].sort(),
      );

      await http()
        .patch('/api/v1/users/me/privacy')
        .set(bearer(org.token))
        .send({ hideRating: true })
        .expect(200);
      expect((await stats(viewer.token, org.user.id)).rating).toEqual({
        hidden: true,
        enoughRatings: false,
        average: null,
        count: null,
      });
      expect((await stats(org.token, org.user.id)).rating).toMatchObject({
        hidden: true,
        count: 3,
      });

      await http()
        .post(`/api/v1/events/${eventId}/cancel`)
        .set(bearer(org.token))
        .expect(200);
      expect((await stats(org.token, org.user.id)).rating).toMatchObject({
        count: 0,
        average: null,
      });
    });
  });

  describe('organizer stats & specialties', () => {
    it('sums impact per normalized label over completed events', async () => {
      const org = await organizer();
      const [a, b] = [await person(), await person()];
      await completedEvent(
        org,
        [a, b],
        [
          { label: 'أشجار مزروعة', value: 100 },
          { label: 'أكياس', value: 5 },
        ],
      );
      await completedEvent(org, [a], [{ label: 'اشجار مزروعه', value: 50 }]);
      const result = await stats(a.token, org.user.id);
      expect(result).toMatchObject({
        completedEvents: 2,
        acceptedVolunteers: 3,
        impact: [
          { label: 'اشجار مزروعه', total: 150 },
          { label: 'أكياس', total: 5 },
        ],
      });
      await http()
        .get(`/api/v1/users/${a.user.id}/organizer-stats`)
        .set(bearer(a.token))
        .expect(400);
    });

    it('stores specialties once after normalization and suggests them', async () => {
      const org = await organizer();
      const other = await organizer({ name: 'Hope Team' });
      const regular = await person();
      await http()
        .put('/api/v1/users/me/specialties')
        .set(bearer(regular.token))
        .send({ names: ['شيء'] })
        .expect(403);

      const mine = await http()
        .put('/api/v1/users/me/specialties')
        .set(bearer(org.token))
        .send({ names: ['تسرّب الأطفال', 'تسرب الاطفال', 'العنف ضد النساء'] })
        .expect(200);
      expect((mine.body as { data: unknown[] }).data).toHaveLength(2);
      await http()
        .put('/api/v1/users/me/specialties')
        .set(bearer(other.token))
        .send({ names: ['تسرب الأطفال'] })
        .expect(200);
      expect(await prisma.specialty.count()).toBe(2);

      const suggestions = await http()
        .get(`/api/v1/specialties?q=${encodeURIComponent('تسرب')}`)
        .set(bearer(regular.token))
        .expect(200);
      expect((suggestions.body as { data: unknown[] }).data).toEqual([
        expect.objectContaining({ name: 'تسرّب الأطفال', accounts: 2 }),
      ]);

      const profile = await http()
        .get(`/api/v1/users/${org.user.id}`)
        .set(bearer(regular.token))
        .expect(200);
      expect(
        (profile.body as { specialties: { name: string }[] }).specialties.map(
          (s) => s.name,
        ),
      ).toEqual(['العنف ضد النساء', 'تسرّب الأطفال']);
    });
  });

  describe('search', () => {
    it('finds verified accounts by name, region and specialty', async () => {
      const org = await organizer({
        name: 'جمعية الأمل',
        governorate: 'HOMS',
        city: 'حمص',
      });
      // A verified individual who hides the address cannot be found by region.
      await person({
        name: 'أمل محمد',
        verifiedKind: 'INDIVIDUAL',
        verifiedAt: new Date(),
        governorate: 'HOMS',
        city: 'حمص',
      });
      await person({ name: 'أمل غير موثقة' });
      const viewer = await person();
      await http()
        .put('/api/v1/users/me/specialties')
        .set(bearer(org.token))
        .send({ names: ['الصحة النفسية'] })
        .expect(200);

      const search = async (query: string) =>
        (
          (
            await http()
              .get(`/api/v1/search/accounts${query}`)
              .set(bearer(viewer.token))
              .expect(200)
          ).body as { data: { id: number; name: string; region: unknown }[] }
        ).data;

      const byName = await search(`?q=${encodeURIComponent('امل')}`);
      expect(byName.map((r) => r.name)).toEqual(['أمل محمد', 'جمعية الأمل']);
      const byRegion = await search('?governorate=HOMS');
      expect(byRegion.map((r) => r.id)).toEqual([org.user.id]);
      expect(byRegion[0].region).toEqual({ governorate: 'HOMS', city: 'حمص' });
      const specialty = await prisma.specialty.findFirstOrThrow();
      expect(
        (await search(`?specialtyId=${specialty.id}`)).map((r) => r.id),
      ).toEqual([org.user.id]);

      const regions = await http()
        .get('/api/v1/search/accounts/regions')
        .set(bearer(viewer.token))
        .expect(200);
      expect((regions.body as { data: unknown[] }).data).toEqual([
        {
          governorate: 'HOMS',
          accounts: 1,
          cities: [{ city: 'حمص', accounts: 1 }],
        },
      ]);
    });

    it('lists verified accounts by section, best public rating first', async () => {
      const low = await organizer({ name: 'فريق أ' });
      const high = await organizer({ name: 'فريق ب' });
      const hidden = await organizer({ name: 'فريق ج', hideRating: true });
      const fresh = await organizer({ name: 'فريق د' });
      await prisma.userSectionInterest.createMany({
        data: [low, high, hidden].map((o) => ({
          userId: o.user.id,
          sectionId,
        })),
      });
      const rateAll = async (org: Person, stars: number[]) => {
        const vs = await Promise.all(stars.map(() => person()));
        const { applications } = await completedEvent(org, vs);
        for (const [i, v] of vs.entries()) {
          await rate(v.token, applications[i], stars[i]);
        }
      };
      await rateAll(low, [3, 3, 3]);
      await rateAll(high, [5, 5, 4]);
      await rateAll(hidden, [5, 5, 5]);
      const viewer = await person();

      const directory = async (query = '') =>
        (
          await http()
            .get(`/api/v1/search/directory${query}`)
            .set(bearer(viewer.token))
            .expect(200)
        ).body as {
          data: {
            id: number;
            rating: { hidden: boolean; average: number | null };
            completedEvents: number;
          }[];
          meta: { total: number };
        };

      const all = await directory();
      // Rated accounts first (best average first); a hidden average never moves an account up.
      expect(all.data.map((a) => a.id).slice(0, 2)).toEqual([
        high.user.id,
        low.user.id,
      ]);
      expect(all.data[0].rating).toMatchObject({ average: 4.7 });
      const hiddenRow = all.data.find((a) => a.id === hidden.user.id);
      expect(hiddenRow?.rating).toEqual({
        hidden: true,
        average: null,
        count: null,
      });
      expect(hiddenRow?.completedEvents).toBe(1);

      // In the section: by interest or by having published there (all three made events in it).
      const inSection = await directory(`?sectionId=${sectionId}`);
      expect(inSection.data.map((a) => a.id)).not.toContain(fresh.user.id);
      expect(inSection.meta.total).toBe(3);
      expect((await directory(`?sectionId=${educationId}`)).meta.total).toBe(0);
    });

    it('lets verified accounts search people by visible fields only', async () => {
      const org = await organizer();
      const visible = await person({
        name: 'سامر',
        governorate: 'HOMS',
        city: 'حمص',
        showAddress: true,
        workField: 'تصميم غرافيك',
        showWorkField: true,
      });
      // Same data, but hidden fields.
      await person({
        name: 'سامي',
        governorate: 'HOMS',
        city: 'حمص',
        workField: 'تصميم',
      });
      const minor = await person({
        name: 'سما',
        birthDate: inDays(-15 * 365),
        governorate: 'HOMS',
        showAddress: true,
      });
      await person({ name: 'سمير', showInSearch: false });
      await prisma.userSectionInterest.create({
        data: { userId: minor.user.id, sectionId: educationId },
      });

      const search = async (token: string, query: string, status = 200) =>
        (
          (
            await http()
              .get(`/api/v1/search/people${query}`)
              .set(bearer(token))
              .expect(status)
          ).body as { data: { id: number; name: string; address: unknown }[] }
        ).data;

      await search(visible.token, '', 403);
      const byName = await search(org.token, `?q=${encodeURIComponent('س')}`);
      expect(byName.map((r) => r.name).sort()).toEqual(
        ['سامر', 'سامي', 'سما'].sort(),
      );
      expect(byName.find((r) => r.name === 'سما')?.address).toBeNull();

      expect(
        (await search(org.token, '?governorate=HOMS')).map((r) => r.id),
      ).toEqual([visible.user.id]);
      expect(
        (
          await search(org.token, `?workField=${encodeURIComponent('تصميم')}`)
        ).map((r) => r.id),
      ).toEqual([visible.user.id]);
      expect(
        (await search(org.token, `?sectionId=${educationId}`)).map((r) => r.id),
      ).toEqual([minor.user.id]);

      // Previous volunteer work = accepted in a completed event.
      await completedEvent(org, [visible]);
      const volunteers = await search(org.token, '?hasVolunteered=true');
      expect(volunteers.map((r) => r.id)).toEqual([visible.user.id]);
      expect(volunteers[0]).toMatchObject({ completedVolunteering: 1 });
    });
  });

  describe('volunteer CV', () => {
    it('returns approved badges, approved teams and impact of the events taken part in', async () => {
      const org = await organizer();
      const volunteer = await person({ name: 'ريم' });
      const { applications } = await completedEvent(
        org,
        [volunteer],
        [{ label: 'أشجار مزروعة', value: 120 }],
        { sectionId: educationId, title: 'ورشة تصميم' },
      );
      const badge = await http()
        .post('/api/v1/badges')
        .set(bearer(volunteer.token))
        .send({ applicationId: applications[0] })
        .expect(201);
      await http()
        .post(`/api/v1/badges/${(badge.body as { id: number }).id}/approve`)
        .set(bearer(org.token))
        .send({})
        .expect(200);
      await prisma.teamMembership.create({
        data: {
          userId: volunteer.user.id,
          teamId: org.user.id,
          status: 'APPROVED',
          role: 'متطوعة',
          startYear: 2024,
        },
      });

      const res = await http()
        .get('/api/v1/users/me/cv')
        .set(bearer(volunteer.token))
        .expect(200);
      expect(res.body).toMatchObject({
        person: { name: 'ريم' },
        stats: { completedEvents: 1, approvedBadges: 1 },
        badges: [
          {
            kind: 'CERTIFICATE',
            role: 'تنظيم',
            event: { title: 'ورشة تصميم', organizer: { id: org.user.id } },
          },
        ],
        teams: [{ role: 'متطوعة', startYear: 2024, team: { id: org.user.id } }],
        impact: [{ label: 'أشجار مزروعة', total: 120 }],
      });
      expect(res.body).not.toHaveProperty('person.email');
    });
  });
});
