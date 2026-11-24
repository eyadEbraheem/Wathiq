import { INestApplication } from '@nestjs/common';
import { readdir, rm } from 'node:fs/promises';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const PDF = Buffer.from('%PDF-1.7\n%test\n');
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);

interface RequestDetail {
  id: number;
  status: string;
  user: { id: number };
  documents: {
    type: string;
    slot: number | null;
    url: string | null;
    purgedAt: string | null;
  }[];
}

describe('Verification requests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const storageDir = () => process.env.STORAGE_LOCAL_DIR ?? './storage-test';

  const pathOf = (url: string) => new URL(url).pathname + new URL(url).search;

  async function privateFileCount(): Promise<number> {
    try {
      return (await readdir(`${storageDir()}/private`)).length;
    } catch {
      return 0;
    }
  }

  /** An ORGANIZATION request with `papers` of the 3 organization papers (all by default). */
  function submit(token: string, papers = 3) {
    let req = http()
      .post('/api/v1/verification-requests')
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'ORGANIZATION')
      .field('contactPhone', '+963912345678')
      .field('foundedAt', '2019-04-01')
      .field('details', 'فريق تطوعي في السلمية')
      .field('links', 'https://example.org/our-work')
      .field('idDocumentType', 'ID_CARD')
      .attach('idDocument', PNG, 'هوية.png')
      .attach('supporting', PDF, 'letter.pdf');
    for (let i = 0; i < papers; i++) {
      req = req.attach('papers', PDF, `paper-${i + 1}.pdf`);
    }
    return req;
  }

  async function setup() {
    const applicant = await createUserAndLogin(app, prisma, {
      email: 'team@example.com',
    });
    const admin = await createUserAndLogin(app, prisma, {
      email: 'admin@example.com',
      role: 'ADMIN',
    });
    return { applicant, admin };
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
    await rm(storageDir(), { recursive: true, force: true });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
    await rm(storageDir(), { recursive: true, force: true });
    await app.close();
  });

  it('accepts a request with documents stored privately', async () => {
    const { applicant } = await setup();
    const res = await submit(applicant.token).expect(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      kind: 'ORGANIZATION',
      links: ['https://example.org/our-work'],
    });
    expect(res.body).not.toHaveProperty('documents');
    expect(await privateFileCount()).toBe(5);

    const mine = await http()
      .get('/api/v1/verification-requests/me')
      .set('Authorization', `Bearer ${applicant.token}`)
      .expect(200);
    expect(mine.body).toMatchObject({ meta: { total: 1 } });
  });

  it('allows only one pending request', async () => {
    const { applicant } = await setup();
    await submit(applicant.token).expect(201);
    await submit(applicant.token).expect(409);
    expect(await privateFileCount()).toBe(5);
  });

  it('requires a founding date for organizations only', async () => {
    const { applicant } = await setup();
    const base = () =>
      http()
        .post('/api/v1/verification-requests')
        .set('Authorization', `Bearer ${applicant.token}`)
        .field('contactPhone', '+963912345678')
        .field('idDocumentType', 'ID_CARD')
        .attach('idDocument', PNG, 'id.png');

    await base().field('kind', 'ORGANIZATION').expect(400);
    await base()
      .field('kind', 'ORGANIZATION')
      .field('foundedAt', '2999-01-01')
      .expect(400);
    await base()
      .field('kind', 'INDIVIDUAL')
      .field('foundedAt', '2019-04-01')
      .expect(400);
    expect(await privateFileCount()).toBe(0);
  });

  it('requires every organization paper, and none for individuals', async () => {
    const { applicant } = await setup();
    await submit(applicant.token, 2).expect(400);
    await http()
      .post('/api/v1/verification-requests')
      .set('Authorization', `Bearer ${applicant.token}`)
      .field('kind', 'INDIVIDUAL')
      .field('contactPhone', '+963912345678')
      .field('idDocumentType', 'ID_CARD')
      .attach('idDocument', PNG, 'id.png')
      .attach('papers', PDF, 'paper.pdf')
      .expect(400);
    expect(await privateFileCount()).toBe(0);
  });

  it('requires an ID document of an allowed type', async () => {
    const { applicant } = await setup();
    const auth = { Authorization: `Bearer ${applicant.token}` };

    await http()
      .post('/api/v1/verification-requests')
      .set(auth)
      .field('kind', 'INDIVIDUAL')
      .field('contactPhone', '+963912345678')
      .field('idDocumentType', 'PASSPORT')
      .expect(400);

    await http()
      .post('/api/v1/verification-requests')
      .set(auth)
      .field('kind', 'INDIVIDUAL')
      .field('contactPhone', '+963912345678')
      .field('idDocumentType', 'PASSPORT')
      .attach('idDocument', EXE, 'passport.png')
      .expect(400);

    expect(await privateFileCount()).toBe(0);
    expect(await prisma.verificationRequest.count()).toBe(0);
  });

  it('keeps the review endpoints for admins only', async () => {
    const { applicant } = await setup();
    await submit(applicant.token).expect(201);
    await http()
      .get('/api/v1/verification-requests')
      .set('Authorization', `Bearer ${applicant.token}`)
      .expect(403);
    await http()
      .post('/api/v1/verification-requests/1/approve')
      .set('Authorization', `Bearer ${applicant.token}`)
      .expect(403);
  });

  it('lets an admin view documents, approve, and purges the files', async () => {
    const { applicant, admin } = await setup();
    const created = await submit(applicant.token).expect(201);
    const id = (created.body as { id: number }).id;
    const adminAuth = { Authorization: `Bearer ${admin.token}` };

    const queue = await http()
      .get('/api/v1/verification-requests?status=PENDING')
      .set(adminAuth)
      .expect(200);
    expect(queue.body).toMatchObject({ data: [{ id }], meta: { total: 1 } });

    const detail = await http()
      .get(`/api/v1/verification-requests/${id}`)
      .set(adminAuth)
      .expect(200);
    const docs = (detail.body as RequestDetail).documents;
    expect(docs.map((d) => d.type)).toEqual([
      'ID_CARD',
      'SUPPORTING',
      'ORGANIZATION_PAPER',
      'ORGANIZATION_PAPER',
      'ORGANIZATION_PAPER',
    ]);
    expect(docs.map((d) => d.slot)).toEqual([null, null, 0, 1, 2]);
    const idUrl = docs[0].url as string;
    await http().get(pathOf(idUrl)).expect(200);

    const approved = await http()
      .post(`/api/v1/verification-requests/${id}/approve`)
      .set(adminAuth)
      .expect(200);
    const body = approved.body as RequestDetail;
    expect(body.status).toBe('APPROVED');
    expect(body.documents.every((d) => d.url === null && d.purgedAt)).toBe(
      true,
    );

    // Files are gone, even through the old signed link.
    await http().get(pathOf(idUrl)).expect(404);
    expect(await privateFileCount()).toBe(0);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: applicant.user.id },
    });
    expect(user.verifiedKind).toBe('ORGANIZATION');
    // The organization's founding date replaces the birth date...
    expect(user.birthDate.toISOString().slice(0, 10)).toBe('2019-04-01');
    // ...and its public profile shows the founding year, no age, no under-18 hiding.
    await prisma.user.update({
      where: { id: user.id },
      data: { showAddress: true, city: 'Salamiyah' },
    });
    const profile = await http().get(`/api/v1/users/${user.id}`).expect(200);
    expect(profile.body).toMatchObject({
      foundedYear: 2019,
      age: null,
      address: { city: 'Salamiyah' },
    });
    expect(user.verifiedAt).not.toBeNull();
    expect(
      await prisma.notification.count({
        where: { recipientId: applicant.user.id, type: 'VERIFICATION_DECIDED' },
      }),
    ).toBe(1);

    // Decided once only; a verified account cannot apply again.
    await http()
      .post(`/api/v1/verification-requests/${id}/reject`)
      .set(adminAuth)
      .send({ reason: 'too late' })
      .expect(400);
    await submit(applicant.token).expect(400);
  });

  it('rejects with a reason and lets the user apply again', async () => {
    const { applicant, admin } = await setup();
    const created = await submit(applicant.token).expect(201);
    const id = (created.body as { id: number }).id;

    await http()
      .post(`/api/v1/verification-requests/${id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'صورة الهوية غير واضحة' })
      .expect(200);
    expect(await privateFileCount()).toBe(0);

    const mine = await http()
      .get('/api/v1/verification-requests/me')
      .set('Authorization', `Bearer ${applicant.token}`)
      .expect(200);
    expect(mine.body).toMatchObject({
      data: [{ status: 'REJECTED', rejectionReason: 'صورة الهوية غير واضحة' }],
    });

    await submit(applicant.token).expect(201);
  });

  describe('an organization that signed up and waits for verification', () => {
    async function pendingOrg() {
      return createUserAndLogin(app, prisma, {
        email: 'new-org@example.com',
        name: 'جمعية جديدة',
        birthDate: new Date('2015-01-01'),
        pendingOrganization: true,
      });
    }

    it('can only browse and edit its own account until approved', async () => {
      const org = await pendingOrg();
      const { admin } = await setup();
      const auth = { Authorization: `Bearer ${org.token}` };

      // Reading works; writing outside its own account is refused.
      await http().get('/api/v1/auth/me').set(auth).expect(200);
      const blocked = await http()
        .post('/api/v1/posts')
        .set(auth)
        .send({})
        .expect(403);
      expect((blocked.body as { message: string }).message).toMatch(
        /waiting for verification/,
      );
      await http()
        .post(`/api/v1/users/${admin.user.id}/follow`)
        .set(auth)
        .expect(403);
      await http()
        .patch('/api/v1/users/me/profile')
        .set(auth)
        .send({ bio: 'جمعية في حماة' })
        .expect(200);

      // It can only ask to be verified as an organization.
      await http()
        .post('/api/v1/verification-requests')
        .set(auth)
        .field('kind', 'INDIVIDUAL')
        .field('contactPhone', '+963912345678')
        .field('idDocumentType', 'ID_CARD')
        .attach('idDocument', PNG, 'id.png')
        .expect(400);
      const created = await submit(org.token).expect(201);

      // Approval unfreezes it.
      await http()
        .post(
          `/api/v1/verification-requests/${(created.body as { id: number }).id}/approve`,
        )
        .set({ Authorization: `Bearer ${admin.token}` })
        .expect(200);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: org.user.id },
      });
      expect(user).toMatchObject({
        pendingOrganization: false,
        verifiedKind: 'ORGANIZATION',
      });
      await http()
        .post(`/api/v1/users/${admin.user.id}/follow`)
        .set(auth)
        .expect((res) => expect(res.status).not.toBe(403));
    });

    it('stays frozen after a rejection and may send a new request', async () => {
      const org = await pendingOrg();
      const { admin } = await setup();
      const created = await submit(org.token).expect(201);
      await http()
        .post(
          `/api/v1/verification-requests/${(created.body as { id: number }).id}/reject`,
        )
        .set({ Authorization: `Bearer ${admin.token}` })
        .send({ reason: 'الورقة الثانية غير واضحة' })
        .expect(200);
      await http()
        .post('/api/v1/posts')
        .set({ Authorization: `Bearer ${org.token}` })
        .send({})
        .expect(403);
      await submit(org.token).expect(201);
    });
  });
});
