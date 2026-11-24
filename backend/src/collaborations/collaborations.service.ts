import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CollaborationStatus,
  NotificationType,
  PostStatus,
  type Prisma,
} from '@prisma/client';
import type { FindCollaborationsQueryDto } from 'src/collaborations/dto/collaboration.dto';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

const COLLAB_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  inviter: { select: USER_CARD_SELECT },
  invitee: { select: USER_CARD_SELECT },
  post: { select: { id: true, title: true, kind: true } },
} satisfies Prisma.CollaborationSelect;

/** Types a user may already have received for a post (no second "new post" notice). */
const NEW_POST_TYPES: NotificationType[] = [
  NotificationType.FOLLOWED_ACCOUNT_POSTED,
  NotificationType.TOPIC_NEW_POST,
  NotificationType.SECTION_NEW_POST,
];

/**
 * The post author invites any account to collaborate. On acceptance the invitee is shown on
 * the post and the invitee's followers are notified.
 */
@Injectable()
export class CollaborationsService {
  private readonly logger = new Logger(CollaborationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async invite(userId: number, postId: number, inviteeId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, status: true },
    });
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException(`No post found with id ${postId}.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the post author can invite collaborators.',
      );
    }
    if (inviteeId === userId) {
      throw new BadRequestException('You cannot invite yourself.');
    }
    const invitee = await this.prisma.user.findUnique({
      where: { id: inviteeId },
      select: { deletedAt: true },
    });
    if (!invitee || invitee.deletedAt) {
      throw new NotFoundException(`No user found with id ${inviteeId}.`);
    }

    const existing = await this.prisma.collaboration.findUnique({
      where: { postId_inviteeId: { postId, inviteeId } },
      select: { id: true, status: true },
    });
    if (
      existing &&
      (existing.status === CollaborationStatus.PENDING ||
        existing.status === CollaborationStatus.ACCEPTED)
    ) {
      throw new ConflictException('This account is already invited.');
    }

    const id = await this.prisma.$transaction(async (tx) => {
      // After a decline or a cancellation the same row is invited again.
      const row = existing
        ? await tx.collaboration.update({
            where: { id: existing.id },
            data: {
              status: CollaborationStatus.PENDING,
              inviterId: userId,
              respondedAt: null,
            },
            select: { id: true },
          })
        : await tx.collaboration.create({
            data: { postId, inviterId: userId, inviteeId },
            select: { id: true },
          });
      await this.notifications.create(
        {
          recipientId: inviteeId,
          actorId: userId,
          type: NotificationType.COLLAB_INVITED,
          postId,
          data: { collaborationId: row.id },
        },
        tx,
      );
      return row.id;
    });
    this.logger.log(
      `User ${userId} invited user ${inviteeId} to collaborate on post ${postId}.`,
    );
    return this.findView(id);
  }

  async accept(userId: number, id: number) {
    const collab = await this.findPendingForInvitee(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.collaboration.update({
        where: { id },
        data: { status: CollaborationStatus.ACCEPTED, respondedAt: new Date() },
      });
      await this.notifications.create(
        {
          recipientId: collab.inviterId,
          actorId: userId,
          type: NotificationType.COLLAB_ACCEPTED,
          postId: collab.postId,
          data: { collaborationId: id },
        },
        tx,
      );
      // The invitee's followers hear about the post, unless they already did.
      const [followers, alreadyTold] = await Promise.all([
        tx.follow.findMany({
          where: { followingId: userId, follower: { deletedAt: null } },
          select: { followerId: true },
        }),
        tx.notification.findMany({
          where: { postId: collab.postId, type: { in: NEW_POST_TYPES } },
          select: { recipientId: true },
        }),
      ]);
      const skip = new Set([
        ...alreadyTold.map((n) => n.recipientId),
        collab.post.authorId,
        userId,
      ]);
      await this.notifications.createMany(
        followers
          .filter((f) => !skip.has(f.followerId))
          .map((f) => ({
            recipientId: f.followerId,
            actorId: userId,
            type: NotificationType.FOLLOWED_ACCOUNT_POSTED,
            postId: collab.postId,
            data: { collaborationId: id },
          })),
        tx,
      );
    });
    this.logger.log(`User ${userId} accepted collaboration ${id}.`);
    return this.findView(id);
  }

  async decline(userId: number, id: number) {
    await this.findPendingForInvitee(userId, id);
    await this.prisma.collaboration.update({
      where: { id },
      data: { status: CollaborationStatus.DECLINED, respondedAt: new Date() },
    });
    this.logger.log(`User ${userId} declined collaboration ${id}.`);
    return this.findView(id);
  }

  /**
   * Ends a collaboration: the inviter cancels a pending or accepted one, or the invitee leaves
   * an accepted one.
   */
  async cancel(userId: number, id: number) {
    const collab = await this.findRow(id);
    const isInviter = collab.post.authorId === userId;
    const isInvitee = collab.inviteeId === userId;
    if (!isInviter && !isInvitee) {
      throw new ForbiddenException('This collaboration is not yours.');
    }
    const allowed: CollaborationStatus[] = isInviter
      ? [CollaborationStatus.PENDING, CollaborationStatus.ACCEPTED]
      : [CollaborationStatus.ACCEPTED];
    if (!allowed.includes(collab.status)) {
      throw new BadRequestException('This collaboration cannot be cancelled.');
    }
    await this.prisma.collaboration.update({
      where: { id },
      data: { status: CollaborationStatus.CANCELLED, respondedAt: new Date() },
    });
    this.logger.log(`User ${userId} cancelled collaboration ${id}.`);
    return this.findView(id);
  }

  /** Invitations the caller received. */
  findIncoming(userId: number, query: FindCollaborationsQueryDto) {
    return this.list({ inviteeId: userId }, query);
  }

  /** The collaborations of one of the caller's posts. */
  async findForPost(
    userId: number,
    postId: number,
    query: FindCollaborationsQueryDto,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, status: true },
    });
    if (!post || post.status === PostStatus.DELETED) {
      throw new NotFoundException(`No post found with id ${postId}.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException(
        "Only the post author sees the post's invitations.",
      );
    }
    return this.list({ postId }, query);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async list(
    where: Prisma.CollaborationWhereInput,
    query: FindCollaborationsQueryDto,
  ) {
    const scoped: Prisma.CollaborationWhereInput = {
      ...where,
      ...(query.status ? { status: query.status } : {}),
      post: { status: { not: PostStatus.DELETED } },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.collaboration.count({ where: scoped }),
      this.prisma.collaboration.findMany({
        where: scoped,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: COLLAB_SELECT,
      }),
    ]);
    return paginated(rows, total, query);
  }

  private findView(id: number) {
    return this.prisma.collaboration.findUniqueOrThrow({
      where: { id },
      select: COLLAB_SELECT,
    });
  }

  private async findRow(id: number) {
    const collab = await this.prisma.collaboration.findUnique({
      where: { id },
      select: {
        status: true,
        inviterId: true,
        inviteeId: true,
        postId: true,
        post: { select: { authorId: true, status: true } },
      },
    });
    if (!collab || collab.post.status === PostStatus.DELETED) {
      throw new NotFoundException(`No collaboration found with id ${id}.`);
    }
    return collab;
  }

  private async findPendingForInvitee(userId: number, id: number) {
    const collab = await this.findRow(id);
    if (collab.inviteeId !== userId) {
      throw new ForbiddenException('This invitation is not yours.');
    }
    if (collab.status !== CollaborationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending invitations can be answered.',
      );
    }
    return collab;
  }
}
