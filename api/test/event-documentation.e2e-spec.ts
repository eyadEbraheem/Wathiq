import { INestApplication } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import request from 'supertest';
import { EventDocumentationService } from 'src/events/event-documentation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

interface EventBody {
  id: number;
  event: {
    status: string;
    documentation: string;
    documentedAt: string | null;
    impactMetrics: { label: string; value: number }[];
    documentationMedia: { url: string }[];
    roles: { id: number; name: string }[];
  };
}

interface BadgeBody {
  id: number;
  status: string;
  kind: string;
  description: string;
  isShownOnProfile: boolean;
  role: { name: string } | null;
  holder: { id: number };
  event: { id: number; title: string; organizer: { id: number } };
}

type Person = Awaited<ReturnType<typeof createUserAndLogin>>;

describe('Event documentation, impact & badges (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let sections: Record<'environment' | 'education', number>;
  let counter = 0;

  async function seedSections() {
    const mk = (slug: string, sortOrder: number) =>
      prisma.section.create({
        data: {
          slug,
          nameAr: slug,
          nameEn: slug,
          logoUrl: `https://cdn.example.com/${slug}.png`,
          sortOrder,
        },
      });
    sections = {
      environment: (await mk('environment', 0)).id,
      education: (await mk('education', 1)).id,
    };
  }

  function person(data: Partial<Prisma.UserCreateInput> = {}): Promise<Person> {
    counter += 1;
    return createUserAndLogin(app, prisma, {
      name: `User ${counter}`,
      ...data,
      email: `doc${counter}@example.com`,
    });
  }

  const organizer = () =>
    person({
      name: 'Green Team',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });

  async function upload(token: string): Promise<string> {
    const res = await http()
      .post('/api/v1/uploads/images')
      .set(bearer(token))
      .attach('file', PNG, 'photo.png')
      .expect(201);
    return (res.body as { key: string }).key;
  }

  /** An event with one accepted volunteer that has already started. */
  async function startedEvent(
    org: Person,
    volunteer: Person,
    extra: Record<string, unknown> = {},
  ) {
    const res = await http()
      .post('/api/v1/events')
      .set(bearer(org.token))
      .send({
        sectionId: sections.environment,
        title: 'حملة تشجير',
        body: 'نزرع 300 شجرة',
        startsAt: inDays(5).toISOString(),
        volunteerHours: 3,
        governorate: 'DAMASCUS',
        city: 'دمشق',
        roles: [{ name: 'تنظيم', seats: 5 }],
        ...extra,
      })
      .expect(201);
    const event = res.body as EventBody;
    const applied = await http()
      .post(`/api/v1/events/${event.id}/applications`)
      .set(bearer(volunteer.token))
      .send({ roleIds: [event.event.roles[0].id] })
      .expect(201);
    const applicationId = (applied.body as { id: number }).id;
    await http()
      .post(`/api/v1/event-applications/${applicationId}/accept`)
      .set(bearer(org.token))
      .send({ roleId: event.event.roles[0].id })
      .expect(200);
    // The event day has come (moved directly in the database).
    await prisma.event.update({
      where: { postId: event.id },
      data: { startsAt: inDays(-1), documentationDueAt: inDays(6) },
    });
    return { eventId: event.id, applicationId };
  }

  async function documentEvent(
    token: string,
    eventId: number,
    body: Record<string, unknown>,
    status = 200,
  ) {
    const res = await http()
      .post(`/api/v1/events/${eventId}/documentation`)
      .set(bearer(token))
      .send(body)
      .expect(status);
    return res.body as EventBody;
  }

  async function requestBadge(
    token: string,
    applicationId: number,
    status = 201,
  ) {
    const res = await http()
      .post('/api/v1/badges')
      .set(bearer(token))
      .send({ applicationId })
      .expect(status);
    return res.body as BadgeBody;
  }

  const notificationTypes = async (userId: number) =>
    (
      await prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { id: 'asc' },
      })
    ).map((n) => n.type);

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

  describe('documentation', () => {
    it('completes a started event with text, photos and metrics, and tells the volunteers', async () => {
      const org = await organizer();
      const volunteer = await person();
      const { eventId } = await startedEvent(org, volunteer);
      const key = await upload(org.token);

      await documentEvent(
        volunteer.token,
        eventId,
        { documentation: 'نص التوثيق هنا', imageKeys: [key] },
        403,
      );
      await documentEvent(
        org.token,
        eventId,
        { documentation: 'نص التوثيق هنا', imageKeys: [] },
        400,
      );
      await documentEvent(
        org.token,
        eventId,
        {
          documentation: 'نص التوثيق هنا',
          imageKeys: [key],
          metrics: [
            { label: 'أشجار مزروعة', value: 300 },
            { label: 'اشجار مزروعه', value: 5 },
          ],
        },
        400,
      );

      const done = await documentEvent(org.token, eventId, {
        documentation: 'زرعنا 300 شجرة مع المتطوعين',
        imageKeys: [key],
        metrics: [
          { label: 'أشجار مزروعة', value: 300 },
          { label: 'أكياس نفايات', value: 40 },
        ],
      });
      expect(done.event).toMatchObject({
        status: 'COMPLETED',
        documentation: 'زرعنا 300 شجرة مع المتطوعين',
        impactMetrics: [
          { label: 'أشجار مزروعة', value: 300 },
          { label: 'أكياس نفايات', value: 40 },
        ],
      });
      expect(done.event.documentedAt).not.toBeNull();
      expect(done.event.documentationMedia).toHaveLength(1);
      expect(await notificationTypes(volunteer.user.id)).toContain(
        'EVENT_DOCUMENTED',
      );

      // Documenting twice is refused; editing works and keeps documentedAt.
      await documentEvent(
        org.token,
        eventId,
        { documentation: 'مرة ثانية هنا', imageKeys: [key] },
        400,
      );
      const edited = await http()
        .patch(`/api/v1/events/${eventId}/documentation`)
        .set(bearer(org.token))
        .send({ metrics: [{ label: 'أشجار مزروعة', value: 320 }] })
        .expect(200);
      const body = edited.body as EventBody;
      expect(body.event.impactMetrics).toEqual([
        { label: 'أشجار مزروعة', value: 320 },
      ]);
      expect(body.event.documentedAt).toBe(done.event.documentedAt);
      expect(body.event.documentation).toBe('زرعنا 300 شجرة مع المتطوعين');
    });

    it('refuses events that have not started, are cancelled, or are not documented yet (edit)', async () => {
      const org = await organizer();
      const volunteer = await person();
      const key = await upload(org.token);
      const future = await http()
        .post('/api/v1/events')
        .set(bearer(org.token))
        .send({
          sectionId: sections.environment,
          title: 'فعالية قادمة',
          body: 'نص',
          startsAt: inDays(5).toISOString(),
          volunteerHours: 3,
          governorate: 'DAMASCUS',
          city: 'دمشق',
        })
        .expect(201);
      const futureId = (future.body as EventBody).id;
      await documentEvent(
        org.token,
        futureId,
        { documentation: 'نص التوثيق هنا', imageKeys: [key] },
        400,
      );
      await http()
        .patch(`/api/v1/events/${futureId}/documentation`)
        .set(bearer(org.token))
        .send({ documentation: 'نص التوثيق هنا' })
        .expect(400);

      const { eventId } = await startedEvent(org, volunteer);
      await http()
        .post(`/api/v1/events/${eventId}/cancel`)
        .set(bearer(org.token))
        .expect(200);
      await documentEvent(
        org.token,
        eventId,
        { documentation: 'نص التوثيق هنا', imageKeys: [key] },
        400,
      );
    });

    it("suggests the organizer's own past labels, most used first", async () => {
      const org = await organizer();
      const other = await organizer();
      const volunteer = await person();
      const key = await upload(org.token);
      for (const metrics of [
        [
          { label: 'أشجار مزروعة', value: 10 },
          { label: 'متطوعون', value: 3 },
        ],
        [{ label: 'اشجار مزروعه', value: 20 }],
      ]) {
        const { eventId } = await startedEvent(org, volunteer);
        await documentEvent(org.token, eventId, {
          documentation: 'نص التوثيق هنا',
          imageKeys: [key],
          metrics,
        });
      }

      const all = await http()
        .get('/api/v1/impact-labels')
        .set(bearer(org.token))
        .expect(200);
      expect((all.body as { data: unknown[] }).data).toEqual([
        { label: 'اشجار مزروعه', uses: 2 },
        { label: 'متطوعون', uses: 1 },
      ]);
      const filtered = await http()
        .get(`/api/v1/impact-labels?q=${encodeURIComponent('أشجار')}`)
        .set(bearer(org.token))
        .expect(200);
      expect(
        (filtered.body as { data: { label: string }[] }).data,
      ).toHaveLength(1);
      const none = await http()
        .get('/api/v1/impact-labels')
        .set(bearer(other.token))
        .expect(200);
      expect((none.body as { data: unknown[] }).data).toEqual([]);
    });
  });

  describe('badges', () => {
    it('lets an accepted volunteer request a badge after completion, and the organizer decide', async () => {
      const org = await organizer();
      const volunteer = await person();
      const stranger = await person();
      const { eventId, applicationId } = await startedEvent(org, volunteer);
      const key = await upload(org.token);

      // Not completed yet.
      await requestBadge(volunteer.token, applicationId, 400);
      await documentEvent(org.token, eventId, {
        documentation: 'نص التوثيق هنا',
        imageKeys: [key],
      });
      await requestBadge(stranger.token, applicationId, 403);

      const requested = await requestBadge(volunteer.token, applicationId);
      expect(requested).toMatchObject({
        status: 'REQUESTED',
        kind: 'BADGE',
        role: { name: 'تنظيم' },
        holder: { id: volunteer.user.id },
        event: {
          id: eventId,
          title: 'حملة تشجير',
          organizer: { id: org.user.id },
        },
      });
      await requestBadge(volunteer.token, applicationId, 409);
      expect(await notificationTypes(org.user.id)).toContain('BADGE_REQUESTED');

      const queue = await http()
        .get(`/api/v1/badges/event/${eventId}?status=REQUESTED`)
        .set(bearer(org.token))
        .expect(200);
      expect((queue.body as { data: unknown[] }).data).toHaveLength(1);
      await http()
        .get(`/api/v1/badges/event/${eventId}`)
        .set(bearer(volunteer.token))
        .expect(403);

      // Rejected → may request again (same row) → approved.
      await http()
        .post(`/api/v1/badges/${requested.id}/approve`)
        .set(bearer(volunteer.token))
        .expect(403);
      await http()
        .post(`/api/v1/badges/${requested.id}/reject`)
        .set(bearer(org.token))
        .expect(200);
      const again = await requestBadge(volunteer.token, applicationId);
      expect(again).toMatchObject({ id: requested.id, status: 'REQUESTED' });
      const approved = await http()
        .post(`/api/v1/badges/${requested.id}/approve`)
        .set(bearer(org.token))
        .send({ description: 'شكراً لجهودك' })
        .expect(200);
      expect(approved.body).toMatchObject({
        status: 'APPROVED',
        description: 'شكراً لجهودك',
      });
      await http()
        .post(`/api/v1/badges/${requested.id}/approve`)
        .set(bearer(org.token))
        .expect(400);
      const types = await notificationTypes(volunteer.user.id);
      expect(types.filter((t) => t === 'BADGE_DECIDED')).toHaveLength(2);

      // Public profile list; the holder can hide it.
      const publicList = async () =>
        (
          (
            await http()
              .get(`/api/v1/badges/user/${volunteer.user.id}`)
              .set(bearer(stranger.token))
              .expect(200)
          ).body as { data: BadgeBody[] }
        ).data;
      expect(await publicList()).toHaveLength(1);
      await http()
        .patch(`/api/v1/badges/${requested.id}`)
        .set(bearer(org.token))
        .send({ isShownOnProfile: false })
        .expect(403);
      await http()
        .patch(`/api/v1/badges/${requested.id}`)
        .set(bearer(volunteer.token))
        .send({ isShownOnProfile: false })
        .expect(200);
      expect(await publicList()).toHaveLength(0);
      const mine = await http()
        .get('/api/v1/badges/me')
        .set(bearer(volunteer.token))
        .expect(200);
      expect((mine.body as { data: unknown[] }).data).toHaveLength(1);

      // Cancelling the completed event keeps the approved badge.
      await http()
        .post(`/api/v1/events/${eventId}/cancel`)
        .set(bearer(org.token))
        .expect(200);
      const kept = await prisma.badge.findUniqueOrThrow({
        where: { id: requested.id },
      });
      expect(kept.status).toBe('APPROVED');
    });

    it('shows a badge of the education section as an attendance certificate', async () => {
      const org = await organizer();
      const volunteer = await person();
      const { eventId, applicationId } = await startedEvent(org, volunteer, {
        sectionId: sections.education,
        title: 'ورشة برمجة',
      });
      const key = await upload(org.token);
      await documentEvent(org.token, eventId, {
        documentation: 'نص التوثيق هنا',
        imageKeys: [key],
      });
      const badge = await requestBadge(volunteer.token, applicationId);
      expect(badge).toMatchObject({ kind: 'CERTIFICATE' });
    });
  });

  describe('overdue documentation', () => {
    it('notifies every admin once per overdue event', async () => {
      const org = await organizer();
      const volunteer = await person();
      const admin = await person({ role: 'ADMIN' });
      const { eventId } = await startedEvent(org, volunteer);
      const { eventId: onTime } = await startedEvent(org, volunteer);
      await prisma.event.update({
        where: { postId: eventId },
        data: { documentationDueAt: inDays(-1) },
      });
      const service = app.get(EventDocumentationService);

      expect(await service.notifyOverdue()).toBe(1);
      expect(await service.notifyOverdue()).toBe(0);
      const notes = await prisma.notification.findMany({
        where: { recipientId: admin.user.id },
      });
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({
        type: 'EVENT_DOCUMENTATION_OVERDUE',
        postId: eventId,
        actorId: org.user.id,
      });
      const stamped = await prisma.event.findUniqueOrThrow({
        where: { postId: onTime },
      });
      expect(stamped.overdueNotifiedAt).toBeNull();
    });
  });
});
