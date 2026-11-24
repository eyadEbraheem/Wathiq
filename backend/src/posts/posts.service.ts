import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  BadgeStatus,
  NotificationType,
  PostKind,
  PostStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import {
  NotificationsService,
  type NewNotification,
} from 'src/notifications/notifications.service';
import type { CreatePostDto } from 'src/posts/dto/create-post.dto';
import type { FindMyPostsQueryDto } from 'src/posts/dto/find-my-posts-query.dto';
import type { FindPostsQueryDto } from 'src/posts/dto/find-posts-query.dto';
import type {
  CaseDetailsDto,
  OpportunityDetailsDto,
} from 'src/posts/dto/post-details.dto';
import type { UpdatePostDto } from 'src/posts/dto/update-post.dto';
import { postSelect, toPostView } from 'src/posts/post-view';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';

const HUMANITARIAN = 'humanitarian';
const EDUCATION = 'education';

export type StoredImage = Awaited<
  ReturnType<StorageService['requirePublicImage']>
>;

/**
 * Posts of verified accounts: normal posts, humanitarian cases (CaseDetails) and external
 * opportunities (OpportunityDetails). Events are posts too but are created and edited through
 * the events endpoints. Upvotes keep Post.upvoteCount in the same transaction.
 */
@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Read ─────────────────────────────────────────────────────────────────

  async findAll(viewerId: number, query: FindPostsQueryDto) {
    const where: Prisma.PostWhereInput = { status: PostStatus.PUBLISHED };

    if (query.authorId !== undefined) where.authorId = query.authorId;
    if (query.sectionId !== undefined) {
      where.sectionId = query.sectionId;
    } else if (query.authorId === undefined) {
      where.sectionId = await this.homeSectionId(viewerId);
    }
    if (query.topicId !== undefined) {
      where.topics = { some: { topicId: query.topicId } };
    }
    if (query.cases !== undefined) {
      where.caseDetails = query.cases ? { isNot: null } : { is: null };
    }
    if (query.openOpportunities) {
      where.opportunity = {
        is: { OR: [{ deadline: null }, { deadline: { gt: new Date() } }] },
      };
    }

    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      query.sort === 'top'
        ? [{ upvoteCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy,
        ...pageArgs(query),
        select: postSelect(viewerId),
      }),
    ]);
    const now = new Date();
    return paginated(
      rows.map((row) => toPostView(row, now)),
      total,
      query,
    );
  }

  /**
   * A verified account's own posts and events, to find and manage them: everything except
   * deleted, including what the admins hid. Filters by kind, event status, hidden and title.
   * `counts` gives the size of each tab (with the title search applied), and each event
   * carries what waits for the organizer (applications and badge requests).
   */
  async findMine(userId: number, query: FindMyPostsQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedKind: true },
    });
    if (!user?.verifiedKind) {
      throw new ForbiddenException('Only verified accounts publish posts.');
    }
    const base: Prisma.PostWhereInput = {
      authorId: userId,
      status: { not: PostStatus.DELETED },
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const where: Prisma.PostWhereInput = {
      ...base,
      ...(query.eventStatus
        ? { kind: PostKind.EVENT, event: { status: query.eventStatus } }
        : query.kind
          ? { kind: query.kind }
          : {}),
      ...(query.hidden ? { status: PostStatus.HIDDEN } : {}),
    };
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      query.sort === 'top'
        ? [{ upvoteCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];

    const [total, rows, all, posts, events, hidden] =
      await this.prisma.$transaction([
        this.prisma.post.count({ where }),
        this.prisma.post.findMany({
          where,
          orderBy,
          ...pageArgs(query),
          select: postSelect(userId),
        }),
        this.prisma.post.count({ where: base }),
        this.prisma.post.count({ where: { ...base, kind: PostKind.POST } }),
        this.prisma.post.count({ where: { ...base, kind: PostKind.EVENT } }),
        this.prisma.post.count({
          where: { ...base, status: PostStatus.HIDDEN },
        }),
      ]);

    // What waits for the organizer on each event of this page.
    const eventIds = rows
      .filter((r) => r.kind === PostKind.EVENT)
      .map((r) => r.id);
    const [applications, badges] = eventIds.length
      ? await Promise.all([
          this.prisma.eventApplication.groupBy({
            by: ['eventId'],
            where: {
              eventId: { in: eventIds },
              status: ApplicationStatus.PENDING,
            },
            _count: { _all: true },
          }),
          this.prisma.badge.groupBy({
            by: ['eventId'],
            where: { eventId: { in: eventIds }, status: BadgeStatus.REQUESTED },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const pendingApps = new Map(
      applications.map((a) => [a.eventId, a._count._all]),
    );
    const pendingBadges = new Map(
      badges.map((b) => [b.eventId, b._count._all]),
    );
    const now = new Date();
    return {
      ...paginated(
        rows.map((row) => ({
          ...toPostView(row, now),
          waiting:
            row.kind === PostKind.EVENT
              ? {
                  applications: pendingApps.get(row.id) ?? 0,
                  badges: pendingBadges.get(row.id) ?? 0,
                }
              : null,
        })),
        total,
        query,
      ),
      counts: { all, posts, events, hidden },
    };
  }

  /** A published post, or the viewer's own post whatever its status (except deleted). */
  async findOne(viewerId: number, id: number) {
    const row = await this.prisma.post.findFirst({
      where: {
        id,
        OR: [
          { status: PostStatus.PUBLISHED },
          { authorId: viewerId, status: { not: PostStatus.DELETED } },
        ],
      },
      select: postSelect(viewerId),
    });
    if (!row) throw new NotFoundException(`No post found with id ${id}.`);
    return toPostView(row);
  }

  // ── Write ────────────────────────────────────────────────────────────────

  async create(userId: number, dto: CreatePostDto) {
    await this.assertCanPublish(userId);
    const section = await this.prisma.section.findUnique({
      where: { id: dto.sectionId },
      select: { id: true, slug: true },
    });
    if (!section) {
      throw new NotFoundException(`No section found with id ${dto.sectionId}.`);
    }
    const topicIds = dto.topicIds ?? [];
    await this.assertTopicsInSection(section.id, topicIds);
    this.assertDetailsAllowed(section.slug, dto.caseDetails, dto.opportunity);
    if (dto.opportunity) this.assertOpportunity(dto.opportunity, true);

    const images = await this.resolveImages(dto.imageKeys ?? []);
    const qr = await this.resolveQr(dto.caseDetails);

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId: userId,
          sectionId: section.id,
          kind: PostKind.POST,
          title: dto.title,
          body: dto.body,
          media: { create: this.mediaRows(images) },
          topics: { create: topicIds.map((topicId) => ({ topicId })) },
          ...(dto.caseDetails
            ? { caseDetails: { create: this.caseRow(dto.caseDetails, qr) } }
            : {}),
          ...(dto.opportunity
            ? { opportunity: { create: this.opportunityRow(dto.opportunity) } }
            : {}),
        },
        select: { id: true },
      });
      await this.notifyNewPost(tx, {
        id: created.id,
        authorId: userId,
        sectionId: section.id,
        topicIds,
      });
      return created;
    });
    this.logger.log(`Post ${post.id} created by user ${userId}.`);
    return this.findOne(userId, post.id);
  }

  async update(userId: number, id: number, dto: UpdatePostDto) {
    const post = await this.findEditable(userId, id);
    if (dto.topicIds !== undefined) {
      await this.assertTopicsInSection(post.sectionId, dto.topicIds);
    }
    this.assertDetailsAllowed(
      post.section.slug,
      dto.caseDetails,
      dto.opportunity,
    );
    if (dto.opportunity) this.assertOpportunity(dto.opportunity, false);

    const images =
      dto.imageKeys !== undefined
        ? await this.resolveImages(dto.imageKeys)
        : undefined;
    const qr = await this.resolveQr(dto.caseDetails);

    const removedKeys = await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.body !== undefined ? { body: dto.body } : {}),
        },
      });

      if (dto.topicIds !== undefined) {
        await tx.postTopic.deleteMany({ where: { postId: id } });
        await tx.postTopic.createMany({
          data: dto.topicIds.map((topicId) => ({ postId: id, topicId })),
        });
      }

      let removed: string[] = [];
      if (images !== undefined) {
        const old = await tx.postMedia.findMany({
          where: { postId: id, phase: 'MAIN' },
          select: { storageKey: true },
        });
        const kept = new Set(images.map((i) => i.key));
        removed = old.map((m) => m.storageKey).filter((k) => !kept.has(k));
        await tx.postMedia.deleteMany({ where: { postId: id, phase: 'MAIN' } });
        await tx.postMedia.createMany({
          data: this.mediaRows(images).map((m) => ({ ...m, postId: id })),
        });
      }

      if (dto.caseDetails === null) {
        await tx.caseDetails.deleteMany({ where: { postId: id } });
      } else if (dto.caseDetails) {
        const row = this.caseRow(dto.caseDetails, qr);
        await tx.caseDetails.upsert({
          where: { postId: id },
          create: { postId: id, ...row },
          update: row,
        });
      }

      if (dto.opportunity === null) {
        await tx.opportunityDetails.deleteMany({ where: { postId: id } });
      } else if (dto.opportunity) {
        const row = this.opportunityRow(dto.opportunity);
        await tx.opportunityDetails.upsert({
          where: { postId: id },
          create: { postId: id, ...row },
          update: row,
        });
      }
      return removed;
    });

    // Files are removed only once the database no longer points at them.
    await Promise.all(removedKeys.map((key) => this.storage.delete(key)));
    this.logger.log(`Post ${id} updated by user ${userId}.`);
    return this.findOne(userId, id);
  }

  /** Soft delete by the author or an admin. Comments, upvotes and files stay for admins. */
  async remove(userId: number, id: number): Promise<void> {
    const [post, user] = await Promise.all([
      this.prisma.post.findUnique({
        where: { id },
        select: { authorId: true, status: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
    ]);
    if (!post || post.status === PostStatus.DELETED) {
      throw new NotFoundException(`No post found with id ${id}.`);
    }
    if (post.authorId !== userId && user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own posts.');
    }
    await this.prisma.post.update({
      where: { id },
      data: { status: PostStatus.DELETED },
    });
    this.logger.log(`Post ${id} deleted by user ${userId}.`);
  }

  // ── Upvotes ──────────────────────────────────────────────────────────────

  /** Idempotent: upvoting twice keeps one upvote. */
  async upvote(userId: number, postId: number) {
    await this.assertPublished(postId);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.upvote.createMany({
        data: [{ userId, postId }],
        skipDuplicates: true,
      });
      const post = await tx.post.update({
        where: { id: postId },
        data: count === 1 ? { upvoteCount: { increment: 1 } } : {},
        select: { upvoteCount: true },
      });
      if (count === 1) {
        this.logger.log(`User ${userId} upvoted post ${postId}.`);
      }
      return { upvoteCount: post.upvoteCount, upvotedByMe: true };
    });
  }

  /** Idempotent: removing a missing upvote changes nothing. */
  async removeUpvote(userId: number, postId: number) {
    await this.assertPublished(postId);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.upvote.deleteMany({
        where: { userId, postId },
      });
      const post = await tx.post.update({
        where: { id: postId },
        data: count === 1 ? { upvoteCount: { decrement: 1 } } : {},
        select: { upvoteCount: true },
      });
      if (count === 1) {
        this.logger.log(`User ${userId} removed the upvote on post ${postId}.`);
      }
      return { upvoteCount: post.upvoteCount, upvotedByMe: false };
    });
  }

  // ── New-post notifications ───────────────────────────────────────────────

  /**
   * Tells followers of the author, and users interested in the post's topics or section, about
   * a new post (events too). One notification per user: following beats topic beats section.
   * Runs inside the transaction that created the post.
   */
  async notifyNewPost(
    tx: Prisma.TransactionClient,
    post: {
      id: number;
      authorId: number;
      sectionId: number;
      topicIds: number[];
    },
  ): Promise<void> {
    const alive = { deletedAt: null };
    const [followers, topicFans, sectionFans] = await Promise.all([
      tx.follow.findMany({
        where: { followingId: post.authorId, follower: alive },
        select: { followerId: true },
      }),
      post.topicIds.length > 0
        ? tx.userTopicInterest.findMany({
            where: { topicId: { in: post.topicIds }, user: alive },
            select: { userId: true },
          })
        : Promise.resolve([]),
      tx.userSectionInterest.findMany({
        where: { sectionId: post.sectionId, user: alive },
        select: { userId: true },
      }),
    ]);

    const recipients = new Map<number, NotificationType>();
    const add = (ids: number[], type: NotificationType) => {
      for (const id of ids) {
        if (id !== post.authorId && !recipients.has(id))
          recipients.set(id, type);
      }
    };
    add(
      followers.map((f) => f.followerId),
      NotificationType.FOLLOWED_ACCOUNT_POSTED,
    );
    add(
      topicFans.map((t) => t.userId),
      NotificationType.TOPIC_NEW_POST,
    );
    add(
      sectionFans.map((s) => s.userId),
      NotificationType.SECTION_NEW_POST,
    );

    const rows: NewNotification[] = [...recipients].map(
      ([recipientId, type]) => ({
        recipientId,
        actorId: post.authorId,
        type,
        postId: post.id,
      }),
    );
    await this.notifications.createMany(rows, tx);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async homeSectionId(viewerId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { primarySectionId: true },
    });
    if (user?.primarySectionId) return user.primarySectionId;
    const humanitarian = await this.prisma.section.findUnique({
      where: { slug: HUMANITARIAN },
      select: { id: true },
    });
    if (!humanitarian) {
      throw new NotFoundException('The humanitarian section is missing.');
    }
    return humanitarian.id;
  }

  /** Verified, not suspended, not deleted (also used by events). */
  async assertCanPublish(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedKind: true, isSuspended: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${userId}.`);
    }
    if (!user.verifiedKind) {
      throw new ForbiddenException('Only verified accounts can publish posts.');
    }
    if (user.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
  }

  private async findEditable(userId: number, id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: {
        authorId: true,
        status: true,
        kind: true,
        sectionId: true,
        section: { select: { slug: true } },
        author: { select: { isSuspended: true } },
      },
    });
    if (!post || post.status === PostStatus.DELETED) {
      throw new NotFoundException(`No post found with id ${id}.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own posts.');
    }
    if (post.author.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
    if (post.kind === PostKind.EVENT) {
      throw new BadRequestException(
        'Edit events through the events endpoints.',
      );
    }
    return post;
  }

  private async assertPublished(postId: number): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { status: true },
    });
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException(`No post found with id ${postId}.`);
    }
  }

  async assertTopicsInSection(
    sectionId: number,
    topicIds: number[],
  ): Promise<void> {
    if (topicIds.length === 0) return;
    const count = await this.prisma.topic.count({
      where: { id: { in: topicIds }, sectionId, isActive: true },
    });
    if (count !== topicIds.length) {
      throw new BadRequestException(
        "Every topic must be an active topic of the post's section.",
      );
    }
  }

  private assertDetailsAllowed(
    sectionSlug: string,
    caseDetails: CaseDetailsDto | null | undefined,
    opportunity: OpportunityDetailsDto | null | undefined,
  ): void {
    if (caseDetails && sectionSlug !== HUMANITARIAN) {
      throw new BadRequestException(
        'Humanitarian case details are only allowed in the humanitarian section.',
      );
    }
    if (opportunity && sectionSlug !== EDUCATION) {
      throw new BadRequestException(
        'Opportunity details are only allowed in the education section.',
      );
    }
  }

  private assertOpportunity(dto: OpportunityDetailsDto, isNew: boolean): void {
    if (dto.minAge != null && dto.maxAge != null && dto.minAge > dto.maxAge) {
      throw new BadRequestException('minAge cannot be greater than maxAge.');
    }
    if (isNew && dto.deadline && new Date(dto.deadline) <= new Date()) {
      throw new BadRequestException('The deadline must be in the future.');
    }
  }

  async resolveImages(keys: string[]): Promise<StoredImage[]> {
    return Promise.all(keys.map((key) => this.storage.requirePublicImage(key)));
  }

  private async resolveQr(
    caseDetails: CaseDetailsDto | null | undefined,
  ): Promise<StoredImage | null> {
    return caseDetails?.paymentQrKey
      ? this.storage.requirePublicImage(caseDetails.paymentQrKey)
      : null;
  }

  mediaRows(images: StoredImage[]) {
    return images.map((image, index) => ({
      storageKey: image.key,
      url: image.url,
      mimeType: image.mimeType,
      sortOrder: index,
    }));
  }

  private caseRow(dto: CaseDetailsDto, qr: StoredImage | null) {
    return {
      contactPhone: dto.contactPhone,
      paymentQrUrl: qr?.url ?? '',
      paymentNote: dto.paymentNote ?? '',
    };
  }

  private opportunityRow(dto: OpportunityDetailsDto) {
    return {
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      applyUrl: dto.applyUrl,
      mode: dto.mode,
      location: dto.location ?? '',
      eligibility: dto.eligibility ?? '',
      minAge: dto.minAge ?? null,
      maxAge: dto.maxAge ?? null,
      educationLevel: dto.educationLevel ?? null,
      field: dto.field ?? '',
    };
  }
}
