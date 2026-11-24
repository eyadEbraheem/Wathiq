import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

/** Collects the raw response body (supertest does not buffer application/pdf by itself). */
const binary = (
  res: request.Response,
  done: (err: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

describe('CV PDF download (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

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

  it('needs sign-in', async () => {
    await http().get('/api/v1/users/me/cv/pdf').expect(401);
  });

  it('returns a PDF file to save, named after the person', async () => {
    const { token } = await createUserAndLogin(app, prisma, {
      email: 'reem@example.com',
      name: 'ريم <b>',
    });
    const res = await http()
      .get('/api/v1/users/me/cv/pdf')
      .set(bearer(token))
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const disposition = res.headers['content-disposition'] as string;
    expect(disposition).toContain('attachment;');
    expect(disposition).toContain('filename="wathiq-cv.pdf"');
    expect(disposition).toContain(
      `filename*=UTF-8''${encodeURIComponent('ريم <b> - سيرة تطوعية.pdf')}`,
    );
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(1000);
  }, 60_000);

  it('refuses organizations, which have no volunteer CV', async () => {
    const { token } = await createUserAndLogin(app, prisma, {
      email: 'org@example.com',
      verifiedKind: 'ORGANIZATION',
    });
    await http().get('/api/v1/users/me/cv/pdf').set(bearer(token)).expect(403);
  });
});
