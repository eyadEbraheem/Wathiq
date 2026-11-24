import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentStatus,
  NotificationType,
  PostStatus,
  Prisma,
  ReportStatus,
  ReportTarget,
  UserRole,
} from '@prisma/client';
import { normalizeArabic } from 'src/common/utils/arabic';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import type {
  CreateReportDto,
  FindBannedWordsQueryDto,
  FindReportsQueryDto,
  ResolveReportDto,
} from 'src/moderation/dto/moderation.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

const REPORT_SELECT = {
  id: true,
  target: true,
  reason: true,
  details: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  reporter: { select: USER_CARD_SELECT },
  resolvedBy: { select: USER_CARD_SELECT },
  post: {
    select: {
      id: true,
      title: true,
      status: true,
      kind: true,
      author: { select: USER_CARD_SELECT },
    },
  },
  comment: {
    select: {
      id: true,
      body: true,
      status: true,
      postId: true,
      author: { select: USER_CARD_SELECT },
    },
  },
  reportedUser: { select: { ...USER_CARD_SELECT, isSuspended: true } },
} satisfies Prisma.ReportSelect;

/**
 * Reports (any user) and the admin basics: the reports queue, hiding content, suspending
 * accounts and the banned-words list.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Reports ──────────────────────────────────────────────────────────────

  async report(userId: number, dto: CreateReportDto) {
    const fk = await this.targetKey(dto.target, dto.targetId);
    if (dto.target === ReportTarget.USER && dto.targetId === userId) {
      throw new BadRequestException('You cannot report yourself.');
    }
    const open = await this.prisma.report.findFirst({
      where: { reporterId: userId, status: ReportStatus.OPEN, ...fk },
      select: { id: true },
    });
    if (open) {
      throw new ConflictException('You already reported this.');
    }
    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        target: dto.target,
        reason: dto.reason,
        details: dto.details ?? '',
        ...fk,
      },
      select: { id: true },
    });
    this.logger.log(
      `User ${userId} reported ${dto.target} ${dto.targetId} (report ${report.id}).`,
    );
    return { id: report.id, status: ReportStatus.OPEN };
  }

  /** Admins: the queue, oldest first. */
  async findReports(query: FindReportsQueryDto) {
    const where: Prisma.ReportWhereInput = {
      status: query.status,
      ...(query.target ? { target: query.target } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: REPORT_SELECT,
      }),
    ]);
    return paginated(rows, total, query);
  }

  /**
   * Resolves the report and every other open report on the same target, optionally hiding
   * the content and / or suspending the responsible user (who is notified).
   */
  async resolve(adminId: number, id: number, dto: ResolveReportDto) {
    const report = await this.findOpenReport(id);
    if (dto.hideContent && report.target === ReportTarget.USER) {
      throw new BadRequestException(
        'A user report has no content to hide: suspend the user instead.',
      );
    }
    const fk = this.fkOf(report);
    const ownerId = await this.ownerOf(report);

    await this.prisma.$transaction(async (tx) => {
      await tx.report.updateMany({
        where: { status: ReportStatus.OPEN, target: report.target, ...fk },
        data: {
          status: ReportStatus.RESOLVED,
          resolvedById: adminId,
          resolvedAt: new Date(),
        },
      });
      if (dto.hideContent && report.postId) {
        await this.setPostHidden(tx, report.postId, true, false);
      }
      if (dto.hideContent && report.commentId) {
        await this.setCommentHidden(tx, report.commentId, true, false);
      }
      if (dto.suspendUser) {
        await this.assertSuspendable(tx, adminId, ownerId);
        await tx.user.update({
          where: { id: ownerId },
          data: { isSuspended: true },
        });
      }
      if (dto.hideContent || dto.suspendUser) {
        await this.notifications.create(
          {
            recipientId: ownerId,
            actorId: null,
            type: NotificationType.CONTENT_MODERATED,
            postId: report.postId ?? report.comment?.postId ?? null,
            data: {
              reportId: id,
              target: report.target,
              contentHidden: dto.hideContent ?? false,
              suspended: dto.suspendUser ?? false,
            },
          },
          tx,
        );
      }
    });
    this.logger.log(
      `Report ${id} resolved by admin ${adminId} (hide: ${dto.hideContent ?? false}, suspend: ${dto.suspendUser ?? false}).`,
    );
    return this.findReport(id);
  }

  async dismiss(adminId: number, id: number) {
    await this.findOpenReport(id);
    await this.prisma.report.update({
      where: { id },
      data: {
        status: ReportStatus.DISMISSED,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
    });
    this.logger.log(`Report ${id} dismissed by admin ${adminId}.`);
    return this.findReport(id);
  }

  // ── Content and accounts ─────────────────────────────────────────────────

  async hidePost(adminId: number, id: number, hidden: boolean) {
    await this.prisma.$transaction((tx) => this.setPostHidden(tx, id, hidden));
    this.logger.log(
      `Post ${id} ${hidden ? 'hidden' : 'restored'} by admin ${adminId}.`,
    );
    return { id, status: hidden ? PostStatus.HIDDEN : PostStatus.PUBLISHED };
  }

  async hideComment(adminId: number, id: number, hidden: boolean) {
    await this.prisma.$transaction((tx) =>
      this.setCommentHidden(tx, id, hidden),
    );
    this.logger.log(
      `Comment ${id} ${hidden ? 'hidden' : 'restored'} by admin ${adminId}.`,
    );
    return {
      id,
      status: hidden ? CommentStatus.HIDDEN : CommentStatus.VISIBLE,
    };
  }

  async setSuspended(adminId: number, userId: number, suspended: boolean) {
    await this.prisma.$transaction(async (tx) => {
      await this.assertSuspendable(tx, adminId, userId);
      await tx.user.update({
        where: { id: userId },
        data: { isSuspended: suspended },
      });
      await this.notifications.create(
        {
          recipientId: userId,
          type: NotificationType.CONTENT_MODERATED,
          data: { suspended },
        },
        tx,
      );
    });
    this.logger.log(
      `User ${userId} ${suspended ? 'suspended' : 'unsuspended'} by admin ${adminId}.`,
    );
    return { id: userId, isSuspended: suspended };
  }

  // ── Banned words ─────────────────────────────────────────────────────────

  async findBannedWords(query: FindBannedWordsQueryDto) {
    const where: Prisma.BannedWordWhereInput = query.q
      ? { normalized: { contains: normalizeArabic(query.q) } }
      : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.bannedWord.count({ where }),
      this.prisma.bannedWord.findMany({
        where,
        orderBy: [{ word: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: { id: true, word: true, normalized: true, createdAt: true },
      }),
    ]);
    return paginated(rows, total, query);
  }

  async addBannedWord(adminId: number, word: string) {
    const normalized = normalizeArabic(word);
    if (!normalized) {
      throw new BadRequestException('The word is empty after normalization.');
    }
    try {
      const row = await this.prisma.bannedWord.create({
        data: { word, normalized, createdById: adminId },
        select: { id: true, word: true, normalized: true, createdAt: true },
      });
      this.logger.log(`Banned word ${row.id} added by admin ${adminId}.`);
      return row;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This word is already banned.');
      }
      throw error;
    }
  }

  async removeBannedWord(adminId: number, id: number): Promise<void> {
    const { count } = await this.prisma.bannedWord.deleteMany({
      where: { id },
    });
    if (count === 0) {
      throw new NotFoundException(`No banned word found with id ${id}.`);
    }
    this.logger.log(`Banned word ${id} removed by admin ${adminId}.`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** The report's foreign key, after checking the target exists. */
  private async targetKey(
    target: ReportTarget,
    id: number,
  ): Promise<
    { postId: number } | { commentId: number } | { reportedUserId: number }
  > {
    if (target === ReportTarget.POST) {
      const post = await this.prisma.post.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!post || post.status === PostStatus.DELETED) {
        throw new NotFoundException(`No post found with id ${id}.`);
      }
      return { postId: id };
    }
    if (target === ReportTarget.COMMENT) {
      const comment = await this.prisma.comment.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!comment || comment.status === CommentStatus.DELETED) {
        throw new NotFoundException(`No comment found with id ${id}.`);
      }
      return { commentId: id };
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${id}.`);
    }
    return { reportedUserId: id };
  }

  private fkOf(report: {
    postId: number | null;
    commentId: number | null;
    reportedUserId: number | null;
  }) {
    if (report.postId) return { postId: report.postId };
    if (report.commentId) return { commentId: report.commentId };
    return { reportedUserId: report.reportedUserId as number };
  }

  /** The user responsible for the reported thing. */
  private async ownerOf(report: {
    postId: number | null;
    commentId: number | null;
    reportedUserId: number | null;
  }): Promise<number> {
    if (report.postId) {
      const post = await this.prisma.post.findUniqueOrThrow({
        where: { id: report.postId },
        select: { authorId: true },
      });
      return post.authorId;
    }
    if (report.commentId) {
      const comment = await this.prisma.comment.findUniqueOrThrow({
        where: { id: report.commentId },
        select: { authorId: true },
      });
      return comment.authorId;
    }
    return report.reportedUserId as number;
  }

  private async findOpenReport(id: number) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        target: true,
        status: true,
        postId: true,
        commentId: true,
        reportedUserId: true,
        comment: { select: { postId: true } },
      },
    });
    if (!report) throw new NotFoundException(`No report found with id ${id}.`);
    if (report.status !== ReportStatus.OPEN) {
      throw new BadRequestException('This report was already handled.');
    }
    return report;
  }

  private findReport(id: number) {
    return this.prisma.report.findUniqueOrThrow({
      where: { id },
      select: REPORT_SELECT,
    });
  }

  private async assertSuspendable(
    tx: Prisma.TransactionClient,
    adminId: number,
    userId: number,
  ): Promise<void> {
    if (userId === adminId) {
      throw new BadRequestException('You cannot suspend yourself.');
    }
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true, isOfficial: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${userId}.`);
    }
    if (user.role === UserRole.ADMIN || user.isOfficial) {
      throw new BadRequestException(
        'Admins and the official account cannot be suspended.',
      );
    }
  }

  /** Hides or restores a post (`strict` = false skips one already in that state). */
  private async setPostHidden(
    tx: Prisma.TransactionClient,
    id: number,
    hidden: boolean,
    strict = true,
  ): Promise<void> {
    const post = await tx.post.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!post || post.status === PostStatus.DELETED) {
      throw new NotFoundException(`No post found with id ${id}.`);
    }
    const from = hidden ? PostStatus.PUBLISHED : PostStatus.HIDDEN;
    if (post.status !== from) {
      if (!strict) return;
      throw new BadRequestException(
        hidden ? 'The post is already hidden.' : 'The post is not hidden.',
      );
    }
    await tx.post.update({
      where: { id },
      data: { status: hidden ? PostStatus.HIDDEN : PostStatus.PUBLISHED },
    });
  }

  /**
   * Hides or restores a comment (`strict` = false skips one already in that state). Post.commentCount counts visible comments and their visible
   * replies, so it moves by the comment plus its visible replies.
   */
  private async setCommentHidden(
    tx: Prisma.TransactionClient,
    id: number,
    hidden: boolean,
    strict = true,
  ): Promise<void> {
    const comment = await tx.comment.findUnique({
      where: { id },
      select: { status: true, postId: true, parentId: true },
    });
    if (!comment || comment.status === CommentStatus.DELETED) {
      throw new NotFoundException(`No comment found with id ${id}.`);
    }
    const from = hidden ? CommentStatus.VISIBLE : CommentStatus.HIDDEN;
    if (comment.status !== from) {
      if (!strict) return;
      throw new BadRequestException(
        hidden
          ? 'The comment is already hidden.'
          : 'The comment is not hidden.',
      );
    }
    const replies =
      comment.parentId === null
        ? await tx.comment.count({
            where: { parentId: id, status: CommentStatus.VISIBLE },
          })
        : 0;
    await tx.comment.update({
      where: { id },
      data: { status: hidden ? CommentStatus.HIDDEN : CommentStatus.VISIBLE },
    });
    const delta = 1 + replies;
    await tx.post.update({
      where: { id: comment.postId },
      data: {
        commentCount: hidden ? { decrement: delta } : { increment: delta },
      },
    });
  }
}
