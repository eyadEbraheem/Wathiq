import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Attribution,
  NotificationType,
  PostKind,
  PublishRequestStatus,
  type Prisma,
  UserRole,
} from '@prisma/client';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PostsService } from 'src/posts/posts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type {
  ApprovePublishRequestDto,
  CreatePublishRequestDto,
  FindPublishRequestsQueryDto,
  RejectPublishRequestDto,
} from 'src/publish-requests/dto/publish-request.dto';
import { StorageService } from 'src/storage/storage.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

const HUMANITARIAN = 'humanitarian';

const REQUEST_SELECT = {
  id: true,
  status: true,
  title: true,
  body: true,
  mediaKeys: true,
  caseContactPhone: true,
  casePaymentQrKey: true,
  casePaymentNote: true,
  requestedAttribution: true,
  attribution: true,
  rejectionReason: true,
  resultingPostId: true,
  decidedAt: true,
  createdAt: true,
  requester: { select: USER_CARD_SELECT },
  targetUser: { select: USER_CARD_SELECT },
  section: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
} satisfies Prisma.PublishRequestSelect;

type RequestRow = Prisma.PublishRequestGetPayload<{
  select: typeof REQUEST_SELECT;
}>;

/**
 * Regular users ask a verified account (or the platform) to publish a post for them, possibly a
 * humanitarian case. Rules: docs/CONVENTIONS.md → "Publishing".
 */
@Injectable()
export class PublishRequestsService {
  private readonly logger = new Logger(PublishRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: number, dto: CreatePublishRequestDto) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedKind: true, isSuspended: true, deletedAt: true },
    });
    if (!requester || requester.deletedAt) {
      throw new NotFoundException(`No user found with id ${userId}.`);
    }
    if (requester.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
    if (requester.verifiedKind) {
      throw new BadRequestException(
        'Verified accounts publish directly instead of sending requests.',
      );
    }

    const toPlatform = dto.targetUserId === undefined;
    if (toPlatform && !dto.requestedAttribution) {
      throw new BadRequestException(
        'Choose how the platform publishes it: requestedAttribution REQUESTER or PUBLISHER.',
      );
    }
    if (!toPlatform && dto.requestedAttribution) {
      throw new BadRequestException(
        'The account you ask decides the attribution: do not send requestedAttribution.',
      );
    }
    if (dto.targetUserId !== undefined) {
      await this.assertAcceptsRequests(userId, dto.targetUserId);
    }
    const section = await this.prisma.section.findUnique({
      where: { id: dto.sectionId },
      select: { slug: true },
    });
    if (!section) {
      throw new NotFoundException(`No section found with id ${dto.sectionId}.`);
    }
    if (dto.caseDetails && section.slug !== HUMANITARIAN) {
      throw new BadRequestException(
        'Humanitarian case requests must target the humanitarian section.',
      );
    }
    const images = await this.posts.resolveImages(dto.imageKeys ?? []);
    if (dto.caseDetails?.paymentQrKey) {
      await this.storage.requirePublicImage(dto.caseDetails.paymentQrKey);
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.publishRequest.create({
        data: {
          requesterId: userId,
          targetUserId: dto.targetUserId ?? null,
          sectionId: dto.sectionId,
          title: dto.title,
          body: dto.body,
          mediaKeys: images.map((i) => i.key),
          caseContactPhone: dto.caseDetails?.contactPhone ?? null,
          casePaymentQrKey: dto.caseDetails?.paymentQrKey ?? '',
          casePaymentNote: dto.caseDetails?.paymentNote ?? '',
          requestedAttribution: dto.requestedAttribution ?? null,
        },
        select: { id: true },
      });
      const recipients = toPlatform
        ? await this.adminIds(tx)
        : [dto.targetUserId as number];
      await this.notifications.createMany(
        recipients.map((recipientId) => ({
          recipientId,
          actorId: userId,
          type: NotificationType.PUBLISH_REQUEST_RECEIVED,
          // toPlatform: admins decide it on the admin page, an account on its requests page.
          data: { publishRequestId: created.id, toPlatform },
        })),
        tx,
      );
      return created.id;
    });
    this.logger.log(
      `Publish request ${id} created by user ${userId} (${toPlatform ? 'platform' : `account ${dto.targetUserId}`}).`,
    );
    return this.findView(id);
  }

  findMine(userId: number, query: FindPublishRequestsQueryDto) {
    return this.list({ requesterId: userId }, query);
  }

  /** Requests sent to the caller's verified account. */
  findIncoming(userId: number, query: FindPublishRequestsQueryDto) {
    return this.list({ targetUserId: userId }, query);
  }

  /** Admins: requests sent to the platform. */
  findForPlatform(query: FindPublishRequestsQueryDto) {
    return this.list({ targetUserId: null }, query);
  }

  /** The requester, the target account, or an admin for platform requests. */
  async findOne(userId: number, id: number) {
    const request = await this.findRow(id);
    const isAdmin = await this.isAdmin(userId);
    const allowed =
      request.requesterId === userId ||
      request.targetUserId === userId ||
      (request.targetUserId === null && isAdmin);
    if (!allowed) {
      throw new ForbiddenException('You cannot see this publish request.');
    }
    return this.findView(id);
  }

  /** Publishes the request as a post, in the target's name (or the official account's). */
  async approve(userId: number, id: number, dto: ApprovePublishRequestDto) {
    const request = await this.findDecidable(userId, id);
    const toPlatform = request.targetUserId === null;
    let attribution: Attribution;
    if (toPlatform) {
      if (dto.attribution) {
        throw new BadRequestException(
          'Platform requests use the attribution the requester chose.',
        );
      }
      attribution = request.requestedAttribution ?? Attribution.REQUESTER;
    } else {
      if (!dto.attribution) {
        throw new BadRequestException(
          'Choose the attribution: PUBLISHER (your name) or REQUESTER (credit the requester).',
        );
      }
      attribution = dto.attribution;
    }
    const authorId = toPlatform
      ? await this.officialAccountId()
      : (request.targetUserId as number);
    const topicIds = dto.topicIds ?? [];
    await this.posts.assertTopicsInSection(request.sectionId, topicIds);
    // The files must still exist when the post is created.
    const images = await this.posts.resolveImages(request.mediaKeys);
    const qr = request.casePaymentQrKey
      ? await this.storage.requirePublicImage(request.casePaymentQrKey)
      : null;

    const postId = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.publishRequest.updateMany({
        where: { id, status: PublishRequestStatus.PENDING },
        data: {
          status: PublishRequestStatus.APPROVED,
          attribution,
          decidedAt: new Date(),
        },
      });
      if (count === 0) {
        throw new ConflictException('This request was already decided.');
      }
      const post = await tx.post.create({
        data: {
          authorId,
          sectionId: request.sectionId,
          kind: PostKind.POST,
          title: request.title,
          body: request.body,
          creditedUserId:
            attribution === Attribution.REQUESTER ? request.requesterId : null,
          media: { create: this.posts.mediaRows(images) },
          topics: { create: topicIds.map((topicId) => ({ topicId })) },
          ...(request.caseContactPhone
            ? {
                caseDetails: {
                  create: {
                    contactPhone: request.caseContactPhone,
                    paymentQrUrl: qr?.url ?? '',
                    paymentNote: request.casePaymentNote,
                  },
                },
              }
            : {}),
        },
        select: { id: true },
      });
      await tx.publishRequest.update({
        where: { id },
        data: { resultingPostId: post.id },
      });
      await this.notifications.create(
        {
          recipientId: request.requesterId,
          actorId: userId,
          type: NotificationType.PUBLISH_REQUEST_DECIDED,
          postId: post.id,
          data: { publishRequestId: id, status: PublishRequestStatus.APPROVED },
        },
        tx,
      );
      await this.posts.notifyNewPost(tx, {
        id: post.id,
        authorId,
        sectionId: request.sectionId,
        topicIds,
      });
      return post.id;
    });
    this.logger.log(
      `Publish request ${id} approved by user ${userId} as post ${postId}.`,
    );
    return this.findView(id);
  }

  async reject(userId: number, id: number, dto: RejectPublishRequestDto) {
    const request = await this.findDecidable(userId, id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.publishRequest.updateMany({
        where: { id, status: PublishRequestStatus.PENDING },
        data: {
          status: PublishRequestStatus.REJECTED,
          rejectionReason: dto.reason ?? '',
          decidedAt: new Date(),
        },
      });
      if (count === 0) {
        throw new ConflictException('This request was already decided.');
      }
      await this.notifications.create(
        {
          recipientId: request.requesterId,
          actorId: userId,
          type: NotificationType.PUBLISH_REQUEST_DECIDED,
          data: { publishRequestId: id, status: PublishRequestStatus.REJECTED },
        },
        tx,
      );
    });
    this.logger.log(`Publish request ${id} rejected by user ${userId}.`);
    return this.findView(id);
  }

  /** The requester withdraws a pending request. */
  async cancel(userId: number, id: number) {
    const request = await this.findRow(id);
    if (request.requesterId !== userId) {
      throw new ForbiddenException('You can only cancel your own requests.');
    }
    const { count } = await this.prisma.publishRequest.updateMany({
      where: { id, status: PublishRequestStatus.PENDING },
      data: { status: PublishRequestStatus.CANCELLED, decidedAt: new Date() },
    });
    if (count === 0) {
      throw new BadRequestException('Only pending requests can be cancelled.');
    }
    this.logger.log(`Publish request ${id} cancelled by user ${userId}.`);
    return this.findView(id);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async list(
    where: Prisma.PublishRequestWhereInput,
    query: FindPublishRequestsQueryDto,
  ) {
    const scoped = {
      ...where,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.publishRequest.count({ where: scoped }),
      this.prisma.publishRequest.findMany({
        where: scoped,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: REQUEST_SELECT,
      }),
    ]);
    return paginated(
      rows.map((row) => this.toView(row)),
      total,
      query,
    );
  }

  private async findView(id: number) {
    const row = await this.prisma.publishRequest.findUniqueOrThrow({
      where: { id },
      select: REQUEST_SELECT,
    });
    return this.toView(row);
  }

  /** Storage keys become URLs; the keys themselves stay server-side. */
  private toView(row: RequestRow) {
    const {
      mediaKeys,
      casePaymentQrKey,
      caseContactPhone,
      casePaymentNote,
      ...rest
    } = row;
    return {
      ...rest,
      toPlatform: row.targetUser === null,
      images: mediaKeys.map((key) => this.storage.publicUrl(key)),
      caseDetails: caseContactPhone
        ? {
            contactPhone: caseContactPhone,
            paymentQrUrl: casePaymentQrKey
              ? this.storage.publicUrl(casePaymentQrKey)
              : '',
            paymentNote: casePaymentNote,
          }
        : null,
    };
  }

  private async findRow(id: number) {
    const request = await this.prisma.publishRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException(`No publish request found with id ${id}.`);
    }
    return request;
  }

  /** A PENDING request the caller may decide: its target account, or an admin (platform). */
  private async findDecidable(userId: number, id: number) {
    const request = await this.findRow(id);
    if (request.targetUserId === null) {
      if (!(await this.isAdmin(userId))) {
        throw new ForbiddenException(
          'Only admins decide requests sent to the platform.',
        );
      }
    } else {
      if (request.targetUserId !== userId) {
        throw new ForbiddenException(
          'Only the account asked can decide this request.',
        );
      }
      const target = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { verifiedKind: true, isSuspended: true },
      });
      if (!target.verifiedKind || target.isSuspended) {
        throw new ForbiddenException(
          'Only active verified accounts can publish.',
        );
      }
    }
    if (request.status !== PublishRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be decided.');
    }
    return request;
  }

  private async assertAcceptsRequests(
    requesterId: number,
    targetId: number,
  ): Promise<void> {
    if (targetId === requesterId) {
      throw new BadRequestException('You cannot send a request to yourself.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        verifiedKind: true,
        isSuspended: true,
        deletedAt: true,
        acceptsPublishRequests: true,
      },
    });
    if (!target || target.deletedAt || !target.verifiedKind) {
      throw new NotFoundException(
        `No verified account found with id ${targetId}.`,
      );
    }
    if (target.isSuspended || !target.acceptsPublishRequests) {
      throw new BadRequestException(
        'This account does not accept publish requests.',
      );
    }
  }

  private async isAdmin(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === UserRole.ADMIN;
  }

  private async adminIds(tx: Prisma.TransactionClient): Promise<number[]> {
    const admins = await tx.user.findMany({
      where: { role: UserRole.ADMIN, deletedAt: null },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  private async officialAccountId(): Promise<number> {
    const official = await this.prisma.user.findFirst({
      where: { isOfficial: true, deletedAt: null },
      select: { id: true },
    });
    if (!official) {
      throw new NotFoundException(
        'The official account is missing (run the seed).',
      );
    }
    return official.id;
  }
}
