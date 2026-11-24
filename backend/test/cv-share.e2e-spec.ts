import { INestApplication } from '@nestjs/common';
import { createPublicKey, verify } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  createTestApp,
  createUserAndLogin,
  TEST_PASSWORD,
} from './utils/test-app';

interface ShareBody {
  enabled: boolean;
  token: string | null;
  offline: string | null;
}

/** SPKI DER header of an Ed25519 public key; the raw 32-byte key follows it. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

describe('Public CV link (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function share(token: string): Promise<string> {
    const res = await http()
      .post('/api/v1/users/me/cv/share')
      .set(bearer(token))
      .expect(201);
    const body = res.body as ShareBody;
    expect(body.enabled).toBe(true);
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    return body.token as string;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('is off by default', async () => {
    const { token } = await createUserAndLogin(app, prisma, {
      email: 'reem@example.com',
    });
    const res = await http()
      .get('/api/v1/users/me/cv/share')
      .set(bearer(token))
      .expect(200);
    expect(res.body).toEqual({ enabled: false, token: null, offline: null });
  });

  it('needs sign-in to manage the link', async () => {
    await http().get('/api/v1/users/me/cv/share').expect(401);
    await http().post('/api/v1/users/me/cv/share').expect(401);
    await http().delete('/api/v1/users/me/cv/share').expect(401);
  });

  it('opens the full CV without sign-in, with the current data', async () => {
    const { user, token } = await createUserAndLogin(app, prisma, {
      email: 'reem@example.com',
      name: 'ريم',
      city: 'حمص',
      workField: 'تصميم',
      // The public link shows personal fields only when the owner shows them.
      showAddress: true,
      showWorkField: true,
    });
    const link = await share(token);

    const first = await http().get(`/api/v1/cv/public/${link}`).expect(200);
    expect(first.body).toMatchObject({
      person: { id: user.id, name: 'ريم', city: 'حمص', workField: 'تصميم' },
      stats: { completedEvents: 0, volunteerHours: 0, approvedBadges: 0 },
      badges: [],
      teams: [],
      impact: [],
    });
    expect(first.body).not.toHaveProperty('person.email');
    expect(first.body).not.toHaveProperty('person.birthDate');

    // Not a snapshot: a later profile change shows on the same link.
    await prisma.user.update({
      where: { id: user.id },
      data: { bio: 'متطوعة منذ ٢٠٢٠' },
    });
    const second = await http().get(`/api/v1/cv/public/${link}`).expect(200);
    expect(second.body).toMatchObject({ person: { bio: 'متطوعة منذ ٢٠٢٠' } });
  });

  it('a new link replaces the old one', async () => {
    const { token } = await createUserAndLogin(app, prisma, {
      email: 'reem@example.com',
    });
    const oldLink = await share(token);
    const newLink = await share(token);
    expect(newLink).not.toBe(oldLink);

    await http().get(`/api/v1/cv/public/${oldLink}`).expect(404);
    await http().get(`/api/v1/cv/public/${newLink}`).expect(200);
  });

  it('stops working when sharing is switched off', async () => {
    const { token } = await createUserAndLogin(app, prisma, {
      email: 'reem@example.com',
    });
    const link = await share(token);

    await http()
      .delete('/api/v1/users/me/cv/share')
      .set(bearer(token))
      .expect(204);
    await http().get(`/api/v1/cv/public/${link}`).expect(404);
    const res = await http()
      .get('/api/v1/users/me/cv/share')
      .set(bearer(token))
      .expect(200);
    expect(res.body).toEqual({ enabled: false, token: null, offline: null });
  });

  it('answers 404 for unknown or malformed links', async () => {
    await http()
      .get(`/api/v1/cv/public/${'a'.repeat(32)}`)
      .expect(404);
    const res = await http().get('/api/v1/cv/public/not-a-token').expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      message: 'This CV link is not valid or is no longer shared.',
    });
  });

  it('stops working for suspended accounts', async () => {
    const { user, token } = await createUserAndLogin(app, prisma, {
      email: 'reem@example.com',
    });
    const link = await share(token);
    await prisma.user.update({
      where: { id: user.id },
      data: { isSuspended: true },
    });
    await http().get(`/api/v1/cv/public/${link}`).expect(404);
  });

  it('is removed when the account is deleted', async () => {
    const { user, token } = await createUserAndLogin(app, prisma, {
      email: 'reem@example.com',
    });
    const link = await share(token);
    await http()
      .delete('/api/v1/users/me')
      .set(bearer(token))
      .send({ password: TEST_PASSWORD })
      .expect(204);

    await http().get(`/api/v1/cv/public/${link}`).expect(404);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(row.cvShareToken).toBeNull();
  });

  it('follows the privacy settings and hides personal fields under 18', async () => {
    const personal = {
      governorate: 'HAMA' as const,
      city: 'السلمية',
      educationLevel: 'BACHELOR' as const,
      fieldOfStudy: 'هندسة مدنية',
      workField: 'تصميم',
    };
    const adult = await createUserAndLogin(app, prisma, {
      email: 'adult@example.com',
      birthDate: new Date('1995-01-01'),
      ...personal,
      showAddress: false,
      showEducation: true,
      showWorkField: false,
    });
    const adultCv = await http()
      .get(`/api/v1/cv/public/${await share(adult.token)}`)
      .expect(200);
    expect(adultCv.body).toMatchObject({
      person: {
        governorate: null,
        city: '',
        educationLevel: 'BACHELOR',
        fieldOfStudy: 'هندسة مدنية',
        workField: '',
      },
    });
    // The owner's own CV still shows everything.
    const own = await http()
      .get('/api/v1/users/me/cv')
      .set(bearer(adult.token))
      .expect(200);
    expect(own.body).toMatchObject({ person: { city: 'السلمية' } });

    const minor = await createUserAndLogin(app, prisma, {
      email: 'minor@example.com',
      birthDate: new Date(new Date().getUTCFullYear() - 15, 0, 1),
      ...personal,
      showAddress: true,
      showEducation: true,
      showWorkField: true,
      showTeams: true,
    });
    const minorCv = await http()
      .get(`/api/v1/cv/public/${await share(minor.token)}`)
      .expect(200);
    expect(minorCv.body).toMatchObject({
      person: {
        governorate: null,
        city: '',
        educationLevel: null,
        fieldOfStudy: '',
        workField: '',
      },
      teams: [],
    });
  });

  it('refuses organizations: they have no volunteer CV', async () => {
    const org = await createUserAndLogin(app, prisma, {
      email: 'org@example.com',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });
    await http()
      .post('/api/v1/users/me/cv/share')
      .set(bearer(org.token))
      .expect(403);
  });

  describe('offline copy in the QR', () => {
    async function publicKey() {
      const res = await http().get('/api/v1/cv/signing-key').expect(200);
      const body = res.body as { algorithm: string; publicKey: string };
      expect(body.algorithm).toBe('Ed25519');
      return createPublicKey({
        key: Buffer.concat([
          ED25519_SPKI_PREFIX,
          Buffer.from(body.publicKey, 'base64'),
        ]),
        format: 'der',
        type: 'spki',
      });
    }

    function read(offline: string) {
      const [payload, signature] = offline.split('.');
      return {
        payload: Buffer.from(payload, 'base64url'),
        signature: Buffer.from(signature, 'base64url'),
      };
    }

    it('is signed, checks with the public key, and a changed copy fails', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'reem@example.com',
        name: 'ريم',
        workField: 'تصميم',
        showWorkField: true,
      });
      await share(token);
      const res = await http()
        .get('/api/v1/users/me/cv/share')
        .set(bearer(token))
        .expect(200);
      const offline = (res.body as ShareBody).offline as string;
      expect(offline.length).toBeLessThanOrEqual(1500);

      const key = await publicKey();
      const { payload, signature } = read(offline);
      expect(verify(null, payload, key, signature)).toBe(true);
      const copy = JSON.parse(inflateRawSync(payload).toString()) as {
        v: number;
        t: string;
        p: { n: string; w: string };
        s: { h: number };
      };
      expect(copy).toMatchObject({
        v: 1,
        t: (res.body as ShareBody).token,
        p: { n: 'ريم', w: 'تصميم' },
        s: { h: 0 },
      });

      // Someone edits the copy (more hours): the signature no longer matches.
      const forged = Buffer.from(
        JSON.stringify({ ...copy, s: { ...copy.s, h: 500 } }),
      );
      expect(verify(null, forged, key, signature)).toBe(false);
    });

    it('follows the privacy settings like the public link', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'minor@example.com',
        birthDate: new Date(new Date().getUTCFullYear() - 15, 0, 1),
        city: 'حمص',
        workField: 'تصميم',
        showAddress: true,
        showWorkField: true,
      });
      await share(token);
      const res = await http()
        .get('/api/v1/users/me/cv/share')
        .set(bearer(token))
        .expect(200);
      const { payload } = read((res.body as ShareBody).offline as string);
      const copy = JSON.parse(inflateRawSync(payload).toString()) as {
        p: { c: string; w: string };
      };
      expect(copy.p).toMatchObject({ c: '', w: '' });
    });

    it('is absent while the CV is not shared', async () => {
      const { token } = await createUserAndLogin(app, prisma, {
        email: 'reem@example.com',
      });
      const res = await http()
        .get('/api/v1/users/me/cv/share')
        .set(bearer(token))
        .expect(200);
      expect(res.body).toEqual({ enabled: false, token: null, offline: null });
    });
  });
});
