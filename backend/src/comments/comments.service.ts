import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentStatus,
  NotificationType,
  PostStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { CreateCommentDto } from 'src/comments/dto/create-comment.dto';
import type { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { containsBannedWord } from 'src/common/utils/banned-words';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import {
  NotificationsService,
  type NewNotification,
} from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

const COMMENT_FIELDS = {
  id: true,
  postId: true,
  parentId: true,
  body: true,
  createdAt: true,
  author: { select: USER_CARD_SELECT },
} satisfies Prisma.CommentSelect;

/**
 * Comments with one level of replies. Comments containing a banned word (after Arabic
 * normalization) are refused. Post.commentCount counts visible comments and replies and is
 * updated in the same transaction.
 */
@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Top-level comments, oldest first, each with its visible replies. */
  async findForPost(postId: number, query: PaginationQueryDto) {
    await this.findPublishedPost(postId);
    const where: Prisma.CommentWhereInput = {
      postId,
      parentId: null,
      status: CommentStatus.VISIBLE,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: {
          ...COMMENT_FIELDS,
          replies: {
            where: { status: CommentStatus.VISIBLE },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: COMMENT_FIELDS,
          },
        },
      }),
    ]);
    return paginated(rows, total, query);
  }

  async create(userId: number, postId: number, dto: CreateCommentDto) {
    const post = await this.findPublishedPost(postId);
    await this.assertCanComment(userId);

    let parentAuthorId: number | null = null;
    if (dto.parentId !== undefined) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { postId: true, parentId: true, status: true, authorId: true },
      });
      if (
        !parent ||
        parent.postId !== postId ||
        parent.status !== CommentStatus.VISIBLE
      ) {
        throw new BadRequestException(
          'The comment you reply to does not exist on this post.',
        );
      }
      if (parent.parentId !== null) {
        throw new BadRequestException('You cannot reply to a reply.');
      }
      parentAuthorId = parent.authorId;
    }

    const banned = await this.prisma.bannedWord.findMany({
      select: { normalized: true },
    });
    if (
      containsBannedWord(
        dto.body,
        banned.map((b) => b.normalized),
      )
    ) {
      throw new BadRequestException(
        'Your comment contains words that are not allowed.',
      );
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          postId,
          authorId: userId,
          parentId: dto.parentId ?? null,
          body: dto.body,
        },
        select: COMMENT_FIELDS,
      });
      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      const notify: NewNotification[] = [];
      if (post.authorId !== userId) {
        notify.push({
          recipientId: post.authorId,
          actorId: userId,
          type: NotificationType.COMMENT_ON_POST,
          postId,
          data: { commentId: created.id },
        });
      }
      if (
        parentAuthorId !== null &&
        parentAuthorId !== userId &&
        parentAuthorId !== post.authorId
      ) {
        notify.push({
          recipientId: parentAuthorId,
          actorId: userId,
          type: NotificationType.COMMENT_REPLY,
          postId,
          data: { commentId: created.id, parentId: dto.parentId ?? null },
        });
      }
      await this.notifications.createMany(notify, tx);
      return created;
    });

    this.logger.log(
      `Comment ${comment.id} on post ${postId} created by user ${userId}.`,
    );
    return { ...comment, replies: [] };
  }

  /**
   * By the comment's author, the post's author or an admin. Deleting a top-level comment also
   * hides its replies.
   */
  async remove(userId: number, id: number): Promise<void> {
    const [comment, user] = await Promise.all([
      this.prisma.comment.findUnique({
        where: { id },
        select: {
          authorId: true,
          postId: true,
          parentId: true,
          status: true,
          post: { select: { authorId: true } },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
    ]);
    if (!comment || comment.status !== CommentStatus.VISIBLE) {
      throw new NotFoundException(`No comment found with id ${id}.`);
    }
    if (
      comment.authorId !== userId &&
      comment.post.authorId !== userId &&
      user?.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You cannot delete this comment.');
    }

    await this.prisma.$transaction(async (tx) => {
      const { count: replies } =
        comment.parentId === null
          ? await tx.comment.updateMany({
              where: { parentId: id, status: CommentStatus.VISIBLE },
              data: { status: CommentStatus.DELETED },
            })
          : { count: 0 };
      await tx.comment.update({
        where: { id },
        data: { status: CommentStatus.DELETED },
      });
      await tx.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 + replies } },
      });
    });
    this.logger.log(`Comment ${id} deleted by user ${userId}.`);
  }

  private async findPublishedPost(postId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, status: true },
    });
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException(`No post found with id ${postId}.`);
    }
    return post;
  }

  private async assertCanComment(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${userId}.`);
    }
    if (user.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
  }
}
