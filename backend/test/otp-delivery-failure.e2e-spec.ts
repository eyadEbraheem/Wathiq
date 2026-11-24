import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { OtpSender } from 'src/auth/otp/otp-sender';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp, createUserAndLogin } from './utils/test-app';

/** Simulates the email provider being down. */
class FailingOtpSender extends OtpSender {
  send(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException(
        'We could not send the code right now. Please try again in a minute.',
      ),
    );
  }
}

describe('OTP delivery failure (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp(new FailingOtpSender() as never));
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  it('answers 503 on sign-up and keeps nothing, so the user can retry', async () => {
    const res = await http()
      .post('/api/v1/auth/signup')
      .send({
        name: 'Sara',
        birthDate: '2000-03-01',
        email: 'sara@example.com',
        password: 'correct horse battery',
      })
      .expect(503);
    expect(res.body).toMatchObject({ statusCode: 503 });
    expect(await prisma.pendingSignup.count()).toBe(0);
  });

  it('still answers 202 on forgot-password, revealing nothing', async () => {
    await createUserAndLogin(app, prisma, { email: 'a@example.com' });
    await http()
      .post('/api/v1/auth/password/forgot')
      .send({ identifier: 'a@example.com' })
      .expect(202);
    expect(await prisma.otpCode.count()).toBe(0);
  });
});
