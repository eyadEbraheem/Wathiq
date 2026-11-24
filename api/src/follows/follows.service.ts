import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

/** Users follow verified accounts only (users follow sections/topics through interests). */
@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async follow(followerId: number, followingId: number): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { verifiedKind: true, deletedAt: true },
    });
    if (!target || target.deletedAt) {
      throw new NotFoundException(`No user found with id ${followingId}.`);
    }
    if (!target.verifiedKind) {
      throw new BadRequestException('Only verified accounts can be followed.');
    }

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) {
      throw new ConflictException('You already follow this account.');
    }
    try {
      await this.prisma.follow.create({ data: { followerId, followingId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You already follow this account.');
      }
      throw error;
    }
    this.logger.log(`User ${followerId} followed ${followingId}.`);
  }

  async unfollow(followerId: number, followingId: number): Promise<void> {
    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    if (count === 0) {
      throw new NotFoundException('You do not follow this account.');
    }
    this.logger.log(`User ${followerId} unfollowed ${followingId}.`);
  }

  /** Followers of a verified account (deleted accounts are left out). */
  async followers(userId: number, query: PaginationQueryDto) {
    await this.assertActiveUser(userId);
    const where: Prisma.FollowWhereInput = {
      followingId: userId,
      follower: { deletedAt: null },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where,
        select: { createdAt: true, follower: { select: USER_CARD_SELECT } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.follow.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({ ...r.follower, followedAt: r.createdAt })),
      total,
      query,
    );
  }

  /** Accounts the caller follows. */
  async following(userId: number, query: PaginationQueryDto) {
    const where: Prisma.FollowWhereInput = {
      followerId: userId,
      following: { deletedAt: null },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where,
        select: { createdAt: true, following: { select: USER_CARD_SELECT } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.follow.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({ ...r.following, followedAt: r.createdAt })),
      total,
      query,
    );
  }

  private async assertActiveUser(id: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${id}.`);
    }
  }
}
