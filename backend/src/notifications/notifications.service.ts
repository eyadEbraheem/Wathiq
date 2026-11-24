import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import type { FindNotificationsQueryDto } from 'src/notifications/dto/find-notifications-query.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

export interface NewNotification {
  recipientId: number;
  actorId?: number | null;
  type: NotificationType;
  postId?: number | null;
  data?: Prisma.InputJsonObject;
}

const NOTIFICATION_FIELDS = {
  id: true,
  type: true,
  data: true,
  readAt: true,
  createdAt: true,
  actor: { select: USER_CARD_SELECT },
  post: { select: { id: true, kind: true, title: true, sectionId: true } },
} satisfies Prisma.NotificationSelect;

/**
 * Creates in-app notification rows. Pass the caller's `tx` so the notification is saved in
 * the same transaction as the event it describes. Push delivery (Expo, background queue) will
 * read these rows (B7).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  create(input: NewNotification, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    return db.notification.create({ data: this.row(input) });
  }

  /** Many notifications in one statement (e.g. a new post for every follower). */
  async createMany(
    inputs: NewNotification[],
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (inputs.length === 0) return 0;
    const db = tx ?? this.prisma;
    const { count } = await db.notification.createMany({
      data: inputs.map((input) => this.row(input)),
    });
    return count;
  }

  // ── The recipient's inbox ────────────────────────────────────────────────

  async findMine(userId: number, query: FindNotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: NOTIFICATION_FIELDS,
      }),
    ]);
    return paginated(rows, total, query);
  }

  async unreadCount(userId: number): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: number, id: number): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { readAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException(`No notification found with id ${id}.`);
    }
  }

  async markAllRead(userId: number): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    this.logger.log(`User ${userId} marked ${count} notifications as read.`);
    return { updated: count };
  }

  private row(input: NewNotification) {
    return {
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      postId: input.postId ?? null,
      data: input.data ?? {},
    };
  }
}
