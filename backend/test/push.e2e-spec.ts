import { INestApplication } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ExpoPushClient,
  type ExpoMessage,
  type ExpoTicket,
} from 'src/push/expo-push.client';
import { PushService } from 'src/push/push.service';
import {
  CapturingOtpSender,
  createTestApp,
  createUserAndLogin,
} from './utils/test-app';

/** Records what would go to Expo; can fail or report dead tokens. */
class FakeExpo {
  batches: ExpoMessage[][] = [];
  fail = false;
  dead = new Set<string>();

  send(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
    if (this.fail) return Promise.reject(new Error('Expo is down'));
    this.batches.push(messages);
    return Promise.resolve(
      messages.map((m) =>
        this.dead.has(m.to)
          ? {
              status: 'error' as const,
              message: 'gone',
              details: { error: 'DeviceNotRegistered' },
            }
          : { status: 'ok' as const, id: 'ticket' },
      ),
    );
  }

  get messages(): ExpoMessage[] {
    return this.batches.flat();
  }
}

type Person = Awaited<ReturnType<typeof createUserAndLogin>>;

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('Push notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let push: PushService;
  const expo = new FakeExpo();
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let counter = 0;
  let sectionId: number;

  function person(data: Partial<Prisma.UserCreateInput> = {}): Promise<Person> {
    counter += 1;
    return createUserAndLogin(app, prisma, {
      name: `User ${counter}`,
      ...data,
      email: `push${counter}@example.com`,
    });
  }

  const register = (token: string, pushToken: string, status = 200) =>
    http()
      .post('/api/v1/push-devices')
      .set(bearer(token))
      .send({ pushToken, platform: 'ANDROID' })
      .expect(status);

  /** An author's post with one comment from `commenter` (one notification to the author). */
  async function commentedPost(author: Person, commenter: Person) {
    const post = await http()
      .post('/api/v1/posts')
      .set(bearer(author.token))
      .send({ sectionId, title: 'حملة تشجير', body: 'نص' })
      .expect(201);
    const postId = (post.body as { id: number }).id;
    await http()
      .post(`/api/v1/posts/${postId}/comments`)
      .set(bearer(commenter.token))
      .send({ body: 'رائع' })
      .expect(201);
    return postId;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp(new CapturingOtpSender(), (b) =>
      b.overrideProvider(ExpoPushClient).useValue(expo),
    ));
    push = app.get(PushService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections RESTART IDENTITY CASCADE',
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
    expo.batches = [];
    expo.fail = false;
    expo.dead.clear();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE users, pending_signups, sections RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  it('registers Expo tokens, moves a token to the new account and removes it on logout', async () => {
    const [a, b] = [await person(), await person()];
    await register(a.token, 'not-a-token', 400);
    await http()
      .post('/api/v1/push-devices')
      .send({ pushToken: TOKEN_A, platform: 'IOS' })
      .expect(401);
    await register(a.token, TOKEN_A);
    await register(a.token, TOKEN_A);
    expect(await prisma.pushDevice.count()).toBe(1);

    // The same phone signs in to another account.
    await register(b.token, TOKEN_A);
    const device = await prisma.pushDevice.findUniqueOrThrow({
      where: { pushToken: TOKEN_A },
    });
    expect(device.userId).toBe(b.user.id);

    await http()
      .delete(`/api/v1/push-devices/${encodeURIComponent(TOKEN_A)}`)
      .set(bearer(a.token))
      .expect(204);
    expect(await prisma.pushDevice.count()).toBe(1);
    await http()
      .delete(`/api/v1/push-devices/${encodeURIComponent(TOKEN_A)}`)
      .set(bearer(b.token))
      .expect(204);
    expect(await prisma.pushDevice.count()).toBe(0);
  });

  it('pushes each new notification once, in Arabic, to every device of the recipient', async () => {
    const author = await person({
      name: 'Green Team',
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });
    const commenter = await person({ name: 'ريم' });
    await register(author.token, TOKEN_A);
    await register(author.token, TOKEN_B);
    const postId = await commentedPost(author, commenter);

    expect(await push.deliverPending()).toEqual({
      notifications: 1,
      messages: 2,
    });
    expect(expo.messages.map((m) => m.to).sort()).toEqual([TOKEN_A, TOKEN_B]);
    expect(expo.messages[0]).toMatchObject({
      title: 'تعليق جديد',
      body: 'ريم علّق على: حملة تشجير',
      data: { type: 'COMMENT_ON_POST', postId },
      sound: 'default',
    });
    const row = await prisma.notification.findFirstOrThrow();
    expect(row.pushedAt).not.toBeNull();

    // Nothing new: nothing sent.
    expect(await push.deliverPending()).toEqual({
      notifications: 0,
      messages: 0,
    });
    expect(expo.batches).toHaveLength(1);
  });

  it('marks notifications without devices, or older than a day, as handled without sending', async () => {
    const author = await person({
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });
    const commenter = await person();
    await commentedPost(author, commenter);
    expect(await push.deliverPending()).toEqual({
      notifications: 1,
      messages: 0,
    });

    await register(author.token, TOKEN_A);
    await commentedPost(author, commenter);
    await prisma.notification.updateMany({
      where: { pushedAt: null },
      data: { createdAt: new Date(Date.now() - 2 * 24 * 3600_000) },
    });
    expect(await push.deliverPending()).toEqual({
      notifications: 0,
      messages: 0,
    });
    expect(await prisma.notification.count({ where: { pushedAt: null } })).toBe(
      0,
    );
    expect(expo.messages).toHaveLength(0);
  });

  it('retries after an Expo failure and forgets unregistered phones', async () => {
    const author = await person({
      verifiedKind: 'ORGANIZATION',
      verifiedAt: new Date(),
    });
    const commenter = await person();
    await register(author.token, TOKEN_A);
    await register(author.token, TOKEN_B);
    await commentedPost(author, commenter);

    expo.fail = true;
    expect(await push.deliverPending()).toEqual({
      notifications: 0,
      messages: 0,
    });
    expect(await prisma.notification.count({ where: { pushedAt: null } })).toBe(
      1,
    );

    expo.fail = false;
    expo.dead.add(TOKEN_B);
    expect(await push.deliverPending()).toEqual({
      notifications: 1,
      messages: 1,
    });
    const devices = await prisma.pushDevice.findMany();
    expect(devices.map((d) => d.pushToken)).toEqual([TOKEN_A]);
  });
});
