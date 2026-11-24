import { INestApplication } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

interface RoleView {
  id: number;
  name: string;
  seats: number;
  seatsTaken: number;
  seatsLeft: number;
}

interface EventBody {
  id: number;
  kind: string;
  title: string;
  topics: { id: number }[];
  event: {
    status: string;
    capacity: number | null;
    acceptedCount: number;
    seatsLeft: number | null;
    autoClosedAt: string | null;
    applicationsOpen: boolean;
    isOrganizer: boolean;
    questions: { id: string; text: string; required: boolean }[];
    roles: RoleView[];
    startsAt: string;
    documentationDueAt: string;
  };
  myApplication: ApplicationBody | null;
}

interface ApplicationBody {
  id: number;
  status: string;
  role: { id: number; name: string } | null;
  roleChoices: { rank: number; id: number; name: string }[];
  answers: Record<string, string>;
}

type Person = Awaited<ReturnType<typeof createUserAndLogin>>;

describe('Events & applications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let sectionId: number;
  let topicId: number;
  let emailCounter = 0;

  async function seedSection() {
    const section = await prisma.section.create({
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
    sectionId = section.id;
    topicId = section.topics[0].id;
  }

  function person(data: Partial<Prisma.UserCreateInput> = {}): Promise<Person> {
    emailCounter += 1;
    return createUserAndLogin(app, prisma, {
      name: `User ${emailCounter}`,
      ...data,
      email: `user${emailCounter}@example.com`,
    });
  }

  const organizer = () =>
    person({
      name: 'Green Team',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });

  function eventBody(extra: Record<string, unknown> = {}) {
    return {
      sectionId,
      title: 'حملة تشجير',
      body: 'نزرع 300 شجرة',
      topicIds: [topicId],
      startsAt: inDays(30).toISOString(),
      endsAt: new Date(inDays(30).getTime() + 4 * 3600_000).toISOString(),
      volunteerHours: 4,
      governorate: 'DAMASCUS',
      city: 'دمشق',
      ...extra,
    };
  }

  async function createEvent(
    token: string,
    extra: Record<string, unknown> = {},
    status = 201,
  ) {
    const res = await http()
      .post('/api/v1/events')
      .set(bearer(token))
      .send(eventBody(extra))
      .expect(status);
    return res.body as EventBody;
  }

  async function getEvent(token: string, id: number) {
    const res = await http()
      .get(`/api/v1/events/${id}`)
      .set(bearer(token))
      .expect(200);
    return res.body as EventBody;
  }

  async function apply(
    token: string,
    eventId: number,
    body: Record<string, unknown> = {},
    status = 201,
  ) {
    const res = await http()
      .post(`/api/v1/events/${eventId}/applications`)
      .set(bearer(token))
      .send(body)
      .expect(status);
    return res.body as ApplicationBody;
  }

  async function act(
    token: string,
    applicationId: number,
    action: 'accept' | 'reject' | 'move' | 'withdraw',
    body: Record<string, unknown> = {},
    status = 200,
  ) {
    const res = await http()
      .post(`/api/v1/event-applications/${applicationId}/${action}`)
      .set(bearer(token))
      .send(body)
      .expect(status);
    return res.body as ApplicationBody;
  }

  const notificationsOf = (userId: number) =>
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { id: 'asc' },
    });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections RESTART IDENTITY CASCADE',
    );
    await seedSection();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  describe('creating', () => {
    it('creates an event with roles, questions and a capacity from the seats', async () => {
      const org = await organizer();
      const fan = await person();
      await prisma.userSectionInterest.create({
        data: { userId: fan.user.id, sectionId },
      });

      const event = await createEvent(org.token, {
        roles: [
          { name: 'تنظيم', seats: 2 },
          { name: 'تصوير', seats: 1 },
        ],
        questions: [
          { text: 'هل لديك خبرة؟', required: true },
          { text: 'ملاحظات' },
        ],
        minAge: 16,
      });

      expect(event.kind).toBe('EVENT');
      expect(event.event).toMatchObject({
        status: 'OPEN',
        capacity: 3,
        acceptedCount: 0,
        seatsLeft: 3,
        applicationsOpen: true,
        isOrganizer: true,
      });
      expect(event.event.roles.map((r) => [r.name, r.seatsLeft])).toEqual([
        ['تنظيم', 2],
        ['تصوير', 1],
      ]);
      expect(event.event.questions).toEqual([
        { id: 'q1', text: 'هل لديك خبرة؟', required: true },
        { id: 'q2', text: 'ملاحظات', required: false },
      ]);
      // Documentation is due 7 days after the end.
      expect(
        new Date(event.event.documentationDueAt).getTime() -
          new Date(event.event.startsAt).getTime(),
      ).toBe(7 * DAY + 4 * 3600_000);

      const notes = await notificationsOf(fan.user.id);
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({
        type: 'SECTION_NEW_POST',
        postId: event.id,
      });
    });

    it('refuses regular accounts, bad dates and capacity together with roles', async () => {
      const org = await organizer();
      const regular = await person();
      await createEvent(regular.token, {}, 403);
      await createEvent(
        org.token,
        { startsAt: inDays(-1).toISOString(), endsAt: null },
        400,
      );
      await createEvent(org.token, { endsAt: inDays(29).toISOString() }, 400);
      await createEvent(
        org.token,
        { applicationDeadline: inDays(31).toISOString() },
        400,
      );
      await createEvent(
        org.token,
        { capacity: 5, roles: [{ name: 'تنظيم', seats: 2 }] },
        400,
      );
      await createEvent(
        org.token,
        {
          roles: [
            { name: 'تنظيم', seats: 2 },
            { name: 'تنظيم', seats: 1 },
          ],
        },
        400,
      );
      await http().post('/api/v1/events').send(eventBody()).expect(401);
    });

    it('lists events and shows them in the feed; posts PATCH refuses events', async () => {
      const org = await organizer();
      const event = await createEvent(org.token, { capacity: 10 });
      const list = await http()
        .get(`/api/v1/events?sectionId=${sectionId}&status=OPEN`)
        .set(bearer(org.token))
        .expect(200);
      expect(
        (list.body as { data: EventBody[] }).data.map((e) => e.id),
      ).toEqual([event.id]);
      const feed = await http()
        .get(`/api/v1/posts?sectionId=${sectionId}`)
        .set(bearer(org.token))
        .expect(200);
      expect((feed.body as { data: EventBody[] }).data[0].event).toMatchObject({
        capacity: 10,
        acceptedCount: 0,
        seatsLeft: 10,
      });
      await http()
        .patch(`/api/v1/posts/${event.id}`)
        .set(bearer(org.token))
        .send({ title: 'جديد' })
        .expect(400);
    });
  });

  describe('applying', () => {
    it('refuses organizations: volunteering is for people', async () => {
      const org = await organizer();
      const otherOrg = await organizer();
      const individual = await person({
        verifiedKind: 'INDIVIDUAL',
        verifiedAt: new Date(),
      });
      const event = await createEvent(org.token);
      await apply(otherOrg.token, event.id, {}, 403);
      // A verified individual is still a person and may volunteer.
      await apply(individual.token, event.id, {});
    });

    it('checks roles, answers, the organizer and duplicates, and tells the organizer', async () => {
      const org = await organizer();
      const volunteer = await person();
      const event = await createEvent(org.token, {
        roles: [
          { name: 'تنظيم', seats: 2 },
          { name: 'تصوير', seats: 1 },
        ],
        questions: [{ text: 'هل لديك خبرة؟', required: true }],
      });
      const [organize, photo] = event.event.roles;

      await apply(
        org.token,
        event.id,
        { roleIds: [organize.id], answers: { q1: 'نعم' } },
        403,
      );
      await apply(volunteer.token, event.id, { answers: { q1: 'نعم' } }, 400);
      await apply(
        volunteer.token,
        event.id,
        { roleIds: [999], answers: { q1: 'نعم' } },
        400,
      );
      await apply(volunteer.token, event.id, { roleIds: [organize.id] }, 400);
      await apply(
        volunteer.token,
        event.id,
        { roleIds: [organize.id], answers: { q1: 'نعم', q9: 'x' } },
        400,
      );

      const application = await apply(volunteer.token, event.id, {
        roleIds: [photo.id, organize.id],
        answers: { q1: '  نعم  ' },
        message: 'متفرّغ',
      });
      expect(application.status).toBe('PENDING');
      expect(application.answers).toEqual({ q1: 'نعم' });
      expect(application.roleChoices.map((c) => [c.rank, c.id])).toEqual([
        [1, photo.id],
        [2, organize.id],
      ]);
      await apply(
        volunteer.token,
        event.id,
        { roleIds: [organize.id], answers: { q1: 'نعم' } },
        409,
      );

      const notes = await notificationsOf(org.user.id);
      expect(notes.map((n) => n.type)).toEqual(['EVENT_APPLICATION_RECEIVED']);

      const page = await getEvent(volunteer.token, event.id);
      expect(page.myApplication?.id).toBe(application.id);
      expect(page.event.isOrganizer).toBe(false);
    });

    it("checks the minimum age on the event's date, not today", async () => {
      const org = await organizer();
      const startsAt = inDays(30);
      const born = (offsetDays: number) => {
        const d = new Date(startsAt);
        d.setUTCFullYear(d.getUTCFullYear() - 18);
        return new Date(d.getTime() + offsetDays * DAY);
      };
      // 17 today, 18 on the event day.
      const turns18 = await person({ birthDate: born(-1) });
      // Still 17 on the event day.
      const tooYoung = await person({ birthDate: born(1) });
      const event = await createEvent(org.token, {
        startsAt: startsAt.toISOString(),
        endsAt: null,
        minAge: 18,
      });
      await apply(turns18.token, event.id);
      await apply(tooYoung.token, event.id, {}, 400);
    });

    it('lets an applicant withdraw and apply again, and lists their applications', async () => {
      const org = await organizer();
      const volunteer = await person();
      const event = await createEvent(org.token);
      const first = await apply(volunteer.token, event.id);
      const other = await person();
      await act(other.token, first.id, 'withdraw', {}, 403);
      const withdrawn = await act(volunteer.token, first.id, 'withdraw');
      expect(withdrawn.status).toBe('WITHDRAWN');
      await act(volunteer.token, first.id, 'withdraw', {}, 400);
      const orgNotes = await notificationsOf(org.user.id);
      expect(orgNotes.map((n) => n.type)).toEqual([
        'EVENT_APPLICATION_RECEIVED',
        'EVENT_APPLICATION_WITHDRAWN',
      ]);
      expect(orgNotes[1]).toMatchObject({
        actorId: volunteer.user.id,
        postId: event.id,
        data: { applicationId: first.id, wasAccepted: false },
      });
      const again = await apply(volunteer.token, event.id);
      expect(again).toMatchObject({ id: first.id, status: 'PENDING' });

      const mine = await http()
        .get('/api/v1/event-applications/me')
        .set(bearer(volunteer.token))
        .expect(200);
      const data = (
        mine.body as {
          data: { id: number; event: { id: number; title: string } }[];
        }
      ).data;
      expect(data).toHaveLength(1);
      expect(data[0].event).toMatchObject({
        id: event.id,
        title: 'حملة تشجير',
      });
    });
  });

  describe('withdrawing after the deadline', () => {
    it('refuses to withdraw once the application deadline has passed', async () => {
      const org = await organizer();
      const volunteer = await person();
      const event = await createEvent(org.token, {
        capacity: 1,
        applicationDeadline: inDays(10).toISOString(),
      });
      const application = await apply(volunteer.token, event.id);
      await act(org.token, application.id, 'accept');
      // The deadline passes (moved into the past directly in the database).
      await prisma.event.update({
        where: { postId: event.id },
        data: { applicationDeadline: inDays(-1) },
      });
      await act(volunteer.token, application.id, 'withdraw', {}, 400);
      const page = await getEvent(org.token, event.id);
      expect(page.event).toMatchObject({ status: 'CLOSED', acceptedCount: 1 });
    });
  });

  describe('deciding', () => {
    it('accepts into one role with a free seat, auto-closes when full and reopens on withdrawal', async () => {
      const org = await organizer();
      const [a, b, c] = [await person(), await person(), await person()];
      const event = await createEvent(org.token, {
        roles: [
          { name: 'تنظيم', seats: 1 },
          { name: 'تصوير', seats: 1 },
        ],
      });
      const [organize, photo] = event.event.roles;
      const appA = await apply(a.token, event.id, { roleIds: [organize.id] });
      const appB = await apply(b.token, event.id, { roleIds: [organize.id] });
      const appC = await apply(c.token, event.id, { roleIds: [photo.id] });

      await act(a.token, appA.id, 'accept', { roleId: organize.id }, 403);
      await act(org.token, appA.id, 'accept', {}, 400);
      const accepted = await act(org.token, appA.id, 'accept', {
        roleId: organize.id,
      });
      expect(accepted).toMatchObject({
        status: 'ACCEPTED',
        role: { id: organize.id },
      });
      await act(org.token, appA.id, 'accept', { roleId: organize.id }, 400);
      // The organize role is full now.
      await act(org.token, appB.id, 'accept', { roleId: organize.id }, 409);

      // Last seat → the event closes by itself.
      await act(org.token, appB.id, 'accept', { roleId: photo.id });
      let page = await getEvent(org.token, event.id);
      expect(page.event.status).toBe('CLOSED');
      expect(page.event.autoClosedAt).not.toBeNull();
      expect(page.event.seatsLeft).toBe(0);
      const late = await person();
      await apply(late.token, event.id, { roleIds: [photo.id] }, 400);
      await act(org.token, appC.id, 'accept', { roleId: photo.id }, 409);

      // A volunteer withdraws → seat free → the event reopens.
      await act(b.token, appB.id, 'withdraw');
      page = await getEvent(org.token, event.id);
      expect(page.event).toMatchObject({ status: 'OPEN', autoClosedAt: null });
      expect(page.event.roles.map((r) => r.seatsLeft)).toEqual([0, 1]);

      const decided = (await notificationsOf(a.user.id)).map((n) => n.data);
      expect(decided).toEqual([
        expect.objectContaining({ status: 'ACCEPTED', roleName: 'تنظيم' }),
      ]);
    });

    it("lists applications to all of the organizer's events in one inbox", async () => {
      const org = await organizer();
      const other = await organizer();
      const [a, b] = [await person(), await person()];
      const first = await createEvent(org.token, { volunteerHours: 6 });
      const second = await createEvent(org.token, {
        roles: [{ name: 'تنظيم', seats: 2 }],
      });
      const foreign = await createEvent(other.token);
      expect(first.event).toMatchObject({ volunteerHours: 6 });
      const appA = await apply(a.token, first.id);
      await apply(b.token, second.id, {
        roleIds: [second.event.roles[0].id],
      });
      await apply(a.token, foreign.id);

      const inbox = async (token: string, status = 'PENDING') =>
        (
          await http()
            .get(`/api/v1/event-applications/organizer?status=${status}`)
            .set(bearer(token))
            .expect(200)
        ).body as {
          data: {
            id: number;
            applicant: { id: number };
            event: { id: number; hasRoles: boolean };
          }[];
          meta: { total: number };
        };

      const pending = await inbox(org.token);
      expect(pending.meta.total).toBe(2);
      expect(pending.data.map((r) => [r.event.id, r.event.hasRoles])).toEqual([
        [first.id, false],
        [second.id, true],
      ]);
      expect(pending.data[0].applicant.id).toBe(a.user.id);

      await act(org.token, appA.id, 'accept');
      expect((await inbox(org.token)).meta.total).toBe(1);
      expect((await inbox(org.token, 'ACCEPTED')).data[0].id).toBe(appA.id);
      // Applicants never see other people's applications through it.
      expect((await inbox(a.token)).meta.total).toBe(0);
    });

    it('never reopens an event closed by hand', async () => {
      const org = await organizer();
      const [a, b] = [await person(), await person()];
      const event = await createEvent(org.token, { capacity: 1 });
      const appA = await apply(a.token, event.id);
      await apply(b.token, event.id);
      await act(org.token, appA.id, 'accept');
      expect((await getEvent(org.token, event.id)).event.status).toBe('CLOSED');

      // Closing by hand turns the auto-close into a manual one.
      await http()
        .post(`/api/v1/events/${event.id}/close`)
        .set(bearer(org.token))
        .expect(200);
      await act(a.token, appA.id, 'withdraw');
      const page = await getEvent(org.token, event.id);
      expect(page.event).toMatchObject({
        status: 'CLOSED',
        autoClosedAt: null,
      });
      await http()
        .post(`/api/v1/events/${event.id}/close`)
        .set(bearer(org.token))
        .expect(400);
    });

    it('rejects pending applicants and moves accepted volunteers between roles', async () => {
      const org = await organizer();
      const [a, b, c] = [await person(), await person(), await person()];
      const event = await createEvent(org.token, {
        roles: [
          { name: 'تنظيم', seats: 2 },
          { name: 'تصوير', seats: 1 },
        ],
      });
      const [organize, photo] = event.event.roles;
      const appA = await apply(a.token, event.id, { roleIds: [organize.id] });
      const appB = await apply(b.token, event.id, { roleIds: [photo.id] });
      const appC = await apply(c.token, event.id, { roleIds: [organize.id] });

      const rejected = await act(org.token, appC.id, 'reject');
      expect(rejected.status).toBe('REJECTED');
      await act(org.token, appC.id, 'reject', {}, 400);

      await act(org.token, appB.id, 'move', { roleId: organize.id }, 400);
      await act(org.token, appA.id, 'accept', { roleId: organize.id });
      await act(org.token, appB.id, 'accept', { roleId: photo.id });
      await act(org.token, appA.id, 'move', { roleId: organize.id }, 400);
      await act(org.token, appA.id, 'move', { roleId: photo.id }, 409);
      await act(org.token, appB.id, 'move', { roleId: organize.id });

      const page = await getEvent(org.token, event.id);
      expect(page.event.roles.map((r) => r.seatsTaken)).toEqual([2, 0]);
      const notes = await notificationsOf(b.user.id);
      expect(notes.map((n) => n.type)).toEqual([
        'EVENT_APPLICATION_DECIDED',
        'EVENT_ROLE_CHANGED',
      ]);
      expect(notes[1].data).toMatchObject({
        roleId: organize.id,
        previousRoleId: photo.id,
      });
    });

    it('shows applicants to the organizer only, respecting privacy and the under-18 rule', async () => {
      const org = await organizer();
      const adult = await person({
        governorate: 'HOMS',
        city: 'حمص',
        showAddress: true,
        showAge: true,
      });
      const minor = await person({
        birthDate: inDays(-15 * 365),
        governorate: 'HOMS',
        city: 'حمص',
        showAddress: true,
        showAge: true,
      });
      const event = await createEvent(org.token);
      await apply(adult.token, event.id);
      await apply(minor.token, event.id);

      await http()
        .get(`/api/v1/events/${event.id}/applications`)
        .set(bearer(adult.token))
        .expect(403);
      const res = await http()
        .get(`/api/v1/events/${event.id}/applications`)
        .set(bearer(org.token))
        .expect(200);
      const rows = (
        res.body as {
          data: {
            applicant: Record<string, unknown>;
          }[];
        }
      ).data;
      expect(rows).toHaveLength(2);
      expect(rows[0].applicant).toMatchObject({
        id: adult.user.id,
        address: { governorate: 'HOMS', city: 'حمص' },
      });
      expect(rows[0].applicant.age).toEqual(expect.any(Number));
      expect(rows[0].applicant).not.toHaveProperty('email');
      expect(rows[0].applicant).not.toHaveProperty('birthDate');
      expect(rows[1].applicant).toMatchObject({
        id: minor.user.id,
        address: null,
        age: null,
      });
    });
  });

  describe('cloning images', () => {
    const PNG = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2,
    ]);

    it('copies each image into its own file, so editing the copy keeps the original', async () => {
      const org = await organizer();
      const upload = await http()
        .post('/api/v1/uploads/images')
        .set(bearer(org.token))
        .attach('file', PNG, 'photo.png')
        .expect(201);
      const key = (upload.body as { key: string }).key;
      const source = await createEvent(org.token, { imageKeys: [key] });
      const sourceMedia = (source as unknown as { media: { url: string }[] })
        .media;

      const res = await http()
        .post(`/api/v1/events/${source.id}/clone`)
        .set(bearer(org.token))
        .send({ startsAt: inDays(60).toISOString() })
        .expect(201);
      const copyMedia = (res.body as { media: { url: string }[] }).media;
      expect(copyMedia).toHaveLength(1);
      expect(copyMedia[0].url).not.toBe(sourceMedia[0].url);
      await http().get(new URL(copyMedia[0].url).pathname).expect(200);

      // Removing the copy's image deletes only the copy's file.
      await http()
        .patch(`/api/v1/events/${(res.body as EventBody).id}`)
        .set(bearer(org.token))
        .send({ imageKeys: [] })
        .expect(200);
      await http().get(new URL(copyMedia[0].url).pathname).expect(404);
      await http().get(new URL(sourceMedia[0].url).pathname).expect(200);
    });
  });

  describe('editing, cancelling and cloning', () => {
    it('keeps edits consistent with applications', async () => {
      const org = await organizer();
      const [a, b] = [await person(), await person()];
      const event = await createEvent(org.token, {
        roles: [
          { name: 'تنظيم', seats: 1 },
          { name: 'تصوير', seats: 1 },
        ],
        questions: [{ text: 'سؤال' }],
      });
      const [organize, photo] = event.event.roles;
      const appA = await apply(a.token, event.id, { roleIds: [organize.id] });
      const appB = await apply(b.token, event.id, { roleIds: [photo.id] });
      await act(org.token, appA.id, 'accept', { roleId: organize.id });
      await act(org.token, appB.id, 'accept', { roleId: photo.id });
      expect((await getEvent(org.token, event.id)).event.status).toBe('CLOSED');

      const patch = (body: Record<string, unknown>, status = 200) =>
        http()
          .patch(`/api/v1/events/${event.id}`)
          .set(bearer(org.token))
          .send(body)
          .expect(status);

      await patch({ questions: [{ text: 'جديد' }] }, 400);
      await patch({ capacity: 10 }, 400);
      await patch(
        { roles: [{ id: organize.id, name: 'تنظيم', seats: 1 }] },
        409,
      );
      await patch(
        {
          roles: [
            { id: organize.id, name: 'تنظيم', seats: 0 },
            { id: photo.id, name: 'تصوير', seats: 1 },
          ],
        },
        400,
      );

      // More seats → the self-closed event reopens; names can be swapped.
      const res = await patch({
        title: 'حملة تشجير كبيرة',
        roles: [
          { id: organize.id, name: 'تصوير', seats: 3 },
          { id: photo.id, name: 'تنظيم', seats: 1 },
          { name: 'إسعاف', seats: 2 },
        ],
      });
      const updated = res.body as EventBody;
      expect(updated.title).toBe('حملة تشجير كبيرة');
      expect(updated.event).toMatchObject({ status: 'OPEN', capacity: 6 });
      expect(updated.event.roles.map((r) => [r.name, r.seatsTaken])).toEqual([
        ['تصوير', 1],
        ['تنظيم', 1],
        ['إسعاف', 0],
      ]);

      const other = await organizer();
      await http()
        .patch(`/api/v1/events/${event.id}`)
        .set(bearer(other.token))
        .send({ title: 'x x x' })
        .expect(403);
    });

    it('cancels from any state, notifies applicants and freezes the event', async () => {
      const org = await organizer();
      const [a, b] = [await person(), await person()];
      const event = await createEvent(org.token);
      const appA = await apply(a.token, event.id);
      await apply(b.token, event.id);
      await act(org.token, appA.id, 'accept');

      const res = await http()
        .post(`/api/v1/events/${event.id}/cancel`)
        .set(bearer(org.token))
        .expect(200);
      expect((res.body as EventBody).event.status).toBe('CANCELLED');
      for (const user of [a, b]) {
        const types = (await notificationsOf(user.user.id)).map((n) => n.type);
        expect(types).toContain('EVENT_CANCELLED');
      }
      await http()
        .post(`/api/v1/events/${event.id}/cancel`)
        .set(bearer(org.token))
        .expect(400);
      const late = await person();
      await apply(late.token, event.id, {}, 400);
      await act(a.token, appA.id, 'withdraw', {}, 400);
      await http()
        .patch(`/api/v1/events/${event.id}`)
        .set(bearer(org.token))
        .send({ title: 'عنوان جديد' })
        .expect(400);
    });

    it('clones details, roles, questions and topics with new dates only', async () => {
      const org = await organizer();
      const volunteer = await person();
      const source = await createEvent(org.token, {
        roles: [{ name: 'تنظيم', seats: 4 }],
        questions: [{ text: 'سؤال', required: true }],
        minAge: 16,
      });
      await apply(volunteer.token, source.id, {
        roleIds: [source.event.roles[0].id],
        answers: { q1: 'نعم' },
      });
      await http()
        .post(`/api/v1/events/${source.id}/cancel`)
        .set(bearer(org.token))
        .expect(200);

      const other = await organizer();
      const startsAt = inDays(60).toISOString();
      await http()
        .post(`/api/v1/events/${source.id}/clone`)
        .set(bearer(other.token))
        .send({ startsAt })
        .expect(403);
      await http()
        .post(`/api/v1/events/${source.id}/clone`)
        .set(bearer(org.token))
        .send({ startsAt: inDays(-2).toISOString() })
        .expect(400);

      const res = await http()
        .post(`/api/v1/events/${source.id}/clone`)
        .set(bearer(org.token))
        .send({ startsAt })
        .expect(201);
      const copy = res.body as EventBody;
      expect(copy.id).not.toBe(source.id);
      expect(copy.title).toBe(source.title);
      expect(copy.topics.map((t) => t.id)).toEqual([topicId]);
      expect(copy.event).toMatchObject({
        status: 'OPEN',
        capacity: 4,
        acceptedCount: 0,
        startsAt,
        questions: [{ id: 'q1', text: 'سؤال', required: true }],
      });
      expect(copy.event.roles.map((r) => [r.name, r.seats])).toEqual([
        ['تنظيم', 4],
      ]);
      expect(copy.event.roles[0].id).not.toBe(source.event.roles[0].id);
    });
  });
});
