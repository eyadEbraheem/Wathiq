import { Injectable, Logger } from '@nestjs/common';
import type { DevicePlatform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  EXPO_MAX_BATCH,
  ExpoPushClient,
  type ExpoMessage,
} from 'src/push/expo-push.client';
import { pushText } from 'src/push/push-text';

/** Notifications older than this are never pushed (e.g. after the job was off). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ROWS_PER_ROUND = 200;
const MAX_ROUNDS = 10;

/**
 * Push notifications: devices register their Expo token, and a background job sends every
 * new in-app notification to the recipient's devices. Each notification is handled once
 * (`pushedAt`); tokens Expo reports as unregistered are removed.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expo: ExpoPushClient,
  ) {}

  /** Registers this phone for the caller. A token that moved to another account moves too. */
  async register(userId: number, pushToken: string, platform: DevicePlatform) {
    const device = await this.prisma.pushDevice.upsert({
      where: { pushToken },
      create: { userId, pushToken, platform },
      update: { userId, platform, lastSeenAt: new Date() },
      select: { id: true, platform: true, lastSeenAt: true },
    });
    this.logger.log(`Push device ${device.id} registered for user ${userId}.`);
    return device;
  }

  /** Called on logout: this phone stops receiving the caller's notifications. */
  async unregister(userId: number, pushToken: string): Promise<void> {
    const { count } = await this.prisma.pushDevice.deleteMany({
      where: { userId, pushToken },
    });
    if (count > 0) {
      this.logger.log(`Push device removed for user ${userId}.`);
    }
  }

  /**
   * Sends the notifications not pushed yet. Returns how many notifications were handled and
   * how many messages were sent. If Expo cannot be reached, the batch is released and retried
   * by the next run.
   */
  async deliverPending(
    now: Date = new Date(),
  ): Promise<{ notifications: number; messages: number }> {
    // Too old to be useful as a push: mark as handled without sending.
    await this.prisma.notification.updateMany({
      where: {
        pushedAt: null,
        createdAt: { lt: new Date(now.getTime() - MAX_AGE_MS) },
      },
      data: { pushedAt: now },
    });

    let handled = 0;
    let sent = 0;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const rows = await this.prisma.notification.findMany({
        where: { pushedAt: null },
        orderBy: { id: 'asc' },
        take: ROWS_PER_ROUND,
        select: {
          id: true,
          type: true,
          data: true,
          postId: true,
          actor: { select: { name: true } },
          post: { select: { title: true } },
          recipient: {
            select: {
              deletedAt: true,
              devices: { select: { pushToken: true } },
            },
          },
        },
      });
      if (rows.length === 0) break;
      const ids = rows.map((r) => r.id);
      // Claim the rows first so a second run never sends them again.
      await this.prisma.notification.updateMany({
        where: { id: { in: ids }, pushedAt: null },
        data: { pushedAt: now },
      });

      const messages: ExpoMessage[] = [];
      for (const row of rows) {
        if (row.recipient.deletedAt) continue;
        const text = pushText({
          type: row.type,
          data: row.data,
          actorName: row.actor?.name ?? null,
          postTitle: row.post?.title ?? null,
        });
        for (const device of row.recipient.devices) {
          messages.push({
            to: device.pushToken,
            title: text.title,
            body: text.body,
            data: {
              notificationId: row.id,
              type: row.type,
              postId: row.postId,
            },
            sound: 'default',
          });
        }
      }

      try {
        sent += await this.send(messages);
      } catch (error) {
        await this.prisma.notification.updateMany({
          where: { id: { in: ids } },
          data: { pushedAt: null },
        });
        this.logger.error(
          'Sending push notifications failed; they will be retried.',
          error instanceof Error ? error.stack : String(error),
        );
        break;
      }
      handled += rows.length;
    }
    if (handled > 0) {
      this.logger.log(
        `Push: handled ${handled} notifications, sent ${sent} messages.`,
      );
    }
    return { notifications: handled, messages: sent };
  }

  /** Sends in chunks of 100 and forgets tokens Expo no longer knows. */
  private async send(messages: ExpoMessage[]): Promise<number> {
    let sent = 0;
    const dead = new Set<string>();
    for (let i = 0; i < messages.length; i += EXPO_MAX_BATCH) {
      const chunk = messages.slice(i, i + EXPO_MAX_BATCH);
      const tickets = await this.expo.send(chunk);
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') sent += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') {
          dead.add(chunk[index].to);
        }
      });
    }
    if (dead.size > 0) {
      await this.prisma.pushDevice.deleteMany({
        where: { pushToken: { in: [...dead] } },
      });
      this.logger.log(`Removed ${dead.size} unregistered push devices.`);
    }
    return sent;
  }
}
