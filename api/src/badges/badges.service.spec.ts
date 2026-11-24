import { NotFoundException } from '@nestjs/common';
import { BadgeStatus, PostStatus } from '@prisma/client';
import { BadgesService } from 'src/badges/badges.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';

describe('BadgesService.verifyPublic', () => {
  it('only looks up approved, visible badges on non-deleted posts', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { badge: { findFirst } } as unknown as PrismaService;
    const service = new BadgesService(prisma, {} as NotificationsService);

    await expect(service.verifyPublic(42)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 42,
          status: BadgeStatus.APPROVED,
          isShownOnProfile: true,
          event: { post: { status: { not: PostStatus.DELETED } } },
        },
      }),
    );
  });
});
