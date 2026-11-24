import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { OtpMessage, OtpSender } from 'src/auth/otp/otp-sender';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { PrismaService } from 'src/prisma/prisma.service';

/** Captures codes instead of sending them. */
class CapturingOtpSender extends OtpSender {
  readonly sent: OtpMessage[] = [];
  send(message: OtpMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
  lastCodeFor(target: string): string {
    const message = [...this.sent].reverse().find((m) => m.target === target);
    if (!message) throw new Error(`No code sent to ${target}`);
    return message.code;
  }
}

interface AuthBody {
  user: { id: number; email: string; passwordHash?: unknown };
  tokens: { accessToken: string; refreshToken: string };
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const otp = new CapturingOtpSender();
  const http = () => request(app.getHttpServer());

  const email = 'sara.e2e@example.com';
  const password = 'correct horse battery';

  async function resetDb(): Promise<void> {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups RESTART IDENTITY CASCADE',
    );
  }

  async function signUpAndVerify(address = email): Promise<AuthBody> {
    const signup = await http()
      .post('/api/v1/auth/signup')
      .send({ name: 'Sara', birthDate: '2000-03-01', email: address, password })
      .expect(201);
    const verify = await http()
      .post('/api/v1/auth/signup/verify')
      .send({
        signupId: (signup.body as { signupId: number }).signupId,
        code: otp.lastCodeFor(address),
      })
      .expect(201);
    return verify.body as AuthBody;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OtpSender)
      .useValue(otp)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    otp.sent.length = 0;
    await resetDb();
  });

  afterAll(async () => {
    await resetDb();
    await app.close();
  });

  describe('sign-up', () => {
    it('creates no user until the code is confirmed, then signs in', async () => {
      const res = await http()
        .post('/api/v1/auth/signup')
        .send({
          name: '  Sara  ',
          birthDate: '2000-03-01',
          email: ' Sara.E2E@Example.com ',
          password,
        })
        .expect(201);

      expect(res.body).toMatchObject({ channel: 'EMAIL' });
      expect(await prisma.user.count()).toBe(0);
      expect(otp.sent).toHaveLength(1);
      expect(otp.sent[0].target).toBe(email);

      const verify = await http()
        .post('/api/v1/auth/signup/verify')
        .send({
          signupId: (res.body as { signupId: number }).signupId,
          code: otp.lastCodeFor(email),
        })
        .expect(201);

      const body = verify.body as AuthBody;
      expect(body.user).toMatchObject({ email, name: 'Sara' });
      expect(body.user.passwordHash).toBeUndefined();
      expect(body.tokens.accessToken).toBeTruthy();
      expect(await prisma.pendingSignup.count()).toBe(0);

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.emailVerifiedAt).not.toBeNull();
    });

    it('lets a pending sign-up for the same email not block the real owner', async () => {
      await http()
        .post('/api/v1/auth/signup')
        .send({ name: 'Squatter', birthDate: '2000-03-01', email, password })
        .expect(201);
      // The real owner signs up too and confirms first; the squatter's row is removed.
      await signUpAndVerify();
      expect(await prisma.pendingSignup.count()).toBe(0);
      expect(await prisma.user.count()).toBe(1);
    });

    it('signs up an organization: founding date, no age rule, frozen until verified', async () => {
      const address = 'org.e2e@example.com';
      const signup = await http()
        .post('/api/v1/auth/signup')
        .send({
          name: 'جمعية الأمل',
          birthDate: '2022-06-01',
          email: address,
          password,
          organization: true,
        })
        .expect(201);
      const verify = await http()
        .post('/api/v1/auth/signup/verify')
        .send({
          signupId: (signup.body as { signupId: number }).signupId,
          code: otp.lastCodeFor(address),
        })
        .expect(201);
      expect((verify.body as { user: unknown }).user).toMatchObject({
        name: 'جمعية الأمل',
        pendingOrganization: true,
        verifiedKind: null,
      });

      // A founding date in the future is refused.
      await http()
        .post('/api/v1/auth/signup')
        .send({
          name: 'جمعية',
          birthDate: '2999-01-01',
          email: 'later@example.com',
          password,
          organization: true,
        })
        .expect(400);
    });

    it('refuses under-13s', async () => {
      const birthDate = new Date();
      birthDate.setUTCFullYear(birthDate.getUTCFullYear() - 12);
      const res = await http()
        .post('/api/v1/auth/signup')
        .send({
          name: 'Kid',
          birthDate: birthDate.toISOString().slice(0, 10),
          email,
          password,
        })
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });

    it('refuses phone sign-up while SMS is disabled', async () => {
      await http()
        .post('/api/v1/auth/signup')
        .send({
          name: 'Sara',
          birthDate: '2000-03-01',
          phone: '+963912345678',
          password,
        })
        .expect(400);
    });

    it('returns 409 when the email already has an account', async () => {
      await signUpAndVerify();
      await http()
        .post('/api/v1/auth/signup')
        .send({ name: 'Sara', birthDate: '2000-03-01', email, password })
        .expect(409);
    });

    it('rejects a wrong code and locks after the max attempts', async () => {
      const res = await http()
        .post('/api/v1/auth/signup')
        .send({ name: 'Sara', birthDate: '2000-03-01', email, password })
        .expect(201);
      const signupId = (res.body as { signupId: number }).signupId;
      const good = otp.lastCodeFor(email);
      const bad = good === '000000' ? '111111' : '000000';

      for (let i = 0; i < 5; i++) {
        await http()
          .post('/api/v1/auth/signup/verify')
          .send({ signupId, code: bad })
          .expect(400);
      }
      // Even the right code is refused now.
      await http()
        .post('/api/v1/auth/signup/verify')
        .send({ signupId, code: good })
        .expect(400);
    });

    it('enforces the resend cooldown', async () => {
      const res = await http()
        .post('/api/v1/auth/signup')
        .send({ name: 'Sara', birthDate: '2000-03-01', email, password })
        .expect(201);
      await http()
        .post('/api/v1/auth/signup/resend')
        .send({ signupId: (res.body as { signupId: number }).signupId })
        .expect(429);
    });

    it('rejects unknown fields', async () => {
      await http()
        .post('/api/v1/auth/signup')
        .send({
          name: 'Sara',
          birthDate: '2000-03-01',
          email,
          password,
          role: 'ADMIN',
        })
        .expect(400);
    });
  });

  describe('sessions', () => {
    it('logs in with email (case-insensitive) and reads /auth/me', async () => {
      await signUpAndVerify();
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: 'SARA.E2E@example.com', password })
        .expect(200);
      const { tokens } = login.body as AuthBody;

      const me = await http()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
      expect(me.body).toMatchObject({ email });
    });

    it('gives the same error for a wrong password and an unknown user', async () => {
      await signUpAndVerify();
      const wrongPassword = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: email, password: 'nope nope nope' })
        .expect(401);
      const unknown = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: 'nobody@example.com', password })
        .expect(401);
      expect(wrongPassword.body).toEqual(unknown.body);
    });

    it('requires a valid bearer token for /auth/me', async () => {
      await http().get('/api/v1/auth/me').expect(401);
      await http()
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer garbage')
        .expect(401);
    });

    it('rotates refresh tokens and revokes everything on reuse', async () => {
      const { tokens } = await signUpAndVerify();

      const first = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
      const rotated = first.body as AuthBody['tokens'];
      expect(rotated.refreshToken).not.toBe(tokens.refreshToken);

      // Reusing the old token is treated as theft...
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
      // ...so the newer token is revoked too.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.refreshToken })
        .expect(401);
    });

    it('logout revokes the refresh token', async () => {
      const { tokens } = await signUpAndVerify();
      await http()
        .post('/api/v1/auth/logout')
        .send({ refreshToken: tokens.refreshToken })
        .expect(204);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });
  });

  describe('password reset', () => {
    it('does not reveal whether an account exists', async () => {
      const res = await http()
        .post('/api/v1/auth/password/forgot')
        .send({ identifier: 'nobody@example.com' })
        .expect(202);
      expect(res.body).toHaveProperty('message');
      expect(otp.sent).toHaveLength(0);
    });

    it('resets the password and signs out every device', async () => {
      const { tokens } = await signUpAndVerify();
      await http()
        .post('/api/v1/auth/password/forgot')
        .send({ identifier: email })
        .expect(202);

      const newPassword = 'a brand new password';
      await http()
        .post('/api/v1/auth/password/reset')
        .send({ identifier: email, code: otp.lastCodeFor(email), newPassword })
        .expect(204);

      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ identifier: email, password })
        .expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ identifier: email, password: newPassword })
        .expect(200);
    });

    it('rejects a wrong reset code', async () => {
      await signUpAndVerify();
      await http()
        .post('/api/v1/auth/password/forgot')
        .send({ identifier: email })
        .expect(202);
      const good = otp.lastCodeFor(email);
      await http()
        .post('/api/v1/auth/password/reset')
        .send({
          identifier: email,
          code: good === '000000' ? '111111' : '000000',
          newPassword: 'whatever123',
        })
        .expect(400);
    });
  });

  describe('password change', () => {
    it('changes the password, keeps this device and signs out the others', async () => {
      const { tokens } = await signUpAndVerify();
      const newPassword = 'another long password';

      const res = await http()
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ currentPassword: password, newPassword, deviceInfo: 'web' })
        .expect(200);
      const fresh = res.body as AuthBody['tokens'];

      // The old session is gone, the new pair works.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: fresh.refreshToken })
        .expect(200);

      await http()
        .post('/api/v1/auth/login')
        .send({ identifier: email, password })
        .expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ identifier: email, password: newPassword })
        .expect(200);
    });

    it('rejects a wrong current password with 400, not 401', async () => {
      const { tokens } = await signUpAndVerify();
      const res = await http()
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ currentPassword: 'wrong wrong', newPassword: 'whatever123' })
        .expect(400);
      expect((res.body as { message: string }).message).toBe(
        'Current password is incorrect.',
      );
      // Nothing changed: the old refresh token still works.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
    });

    it('rejects the same password and requires a token', async () => {
      const { tokens } = await signUpAndVerify();
      await http()
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ currentPassword: password, newPassword: password })
        .expect(400);
      await http()
        .post('/api/v1/auth/password/change')
        .send({ currentPassword: password, newPassword: 'whatever123' })
        .expect(401);
    });
  });
});
