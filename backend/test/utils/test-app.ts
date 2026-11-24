import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { OtpMessage, OtpSender } from 'src/auth/otp/otp-sender';
import { normalizeArabic } from 'src/common/utils/arabic';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { PrismaService } from 'src/prisma/prisma.service';

/** Captures codes instead of sending them. */
export class CapturingOtpSender extends OtpSender {
  readonly sent: OtpMessage[] = [];
  send(message: OtpMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

/**
 * The app as main.ts configures it, with codes captured instead of sent. `override` replaces
 * more providers (e.g. the Expo push client).
 */
export async function createTestApp(
  otp = new CapturingOtpSender(),
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
) {
  const moduleRef = await override(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OtpSender)
      .useValue(otp),
  ).compile();

  const app: INestApplication = moduleRef.createNestApplication();
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
  return { app, prisma: app.get(PrismaService), otp };
}

export const TEST_PASSWORD = 'correct horse battery';

/** Inserts a user directly and logs in. Returns the user and an access token. */
export async function createUserAndLogin(
  app: INestApplication,
  prisma: PrismaService,
  data: Partial<Prisma.UserCreateInput> & { email: string },
) {
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      birthDate: new Date('1995-06-15'),
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      ...data,
      // Like sign-up: the normalized name is what name search matches.
      searchName: normalizeArabic(data.name ?? 'Test User'),
    },
  });
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ identifier: data.email, password: TEST_PASSWORD })
    .expect(200);
  const token = (res.body as { tokens: { accessToken: string } }).tokens
    .accessToken;
  return { user, token };
}
