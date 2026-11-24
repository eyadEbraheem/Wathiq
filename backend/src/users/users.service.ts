import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { TokensService } from 'src/auth/tokens.service';
import { normalizeArabic } from 'src/common/utils/arabic';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import type { DeleteAccountDto } from 'src/users/dto/delete-account.dto';
import type { SetInterestsDto } from 'src/users/dto/interests.dto';
import type { UpdatePrivacyDto } from 'src/users/dto/update-privacy.dto';
import type { UpdateProfileDto } from 'src/users/dto/update-profile.dto';
import { toPublicProfile, type PublicProfile } from 'src/users/public-profile';
import { toSafeUser, type SafeUser } from 'src/users/safe-user';

/** Stored instead of the name of a deleted account; clients show a translated label. */
export const DELETED_ACCOUNT_NAME = 'Deleted account';

export interface Interests {
  sectionIds: number[];
  topicIds: number[];
  primarySectionId: number | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly storage: StorageService,
  ) {}

  /** An active (not deleted) user, or 404. */
  async findOne(id: number): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${id}.`);
    }
    return user;
  }

  /** The public profile; verified accounts also show their specialties. */
  async getPublicProfile(
    id: number,
  ): Promise<PublicProfile & { specialties: { id: number; name: string }[] }> {
    const user = await this.findOne(id);
    const specialties = user.verifiedKind
      ? await this.prisma.specialty.findMany({
          where: { users: { some: { userId: id } } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        })
      : [];
    return { ...toPublicProfile(user), specialties };
  }

  // ── Own profile ───────────────────────────────────────────────────────────

  /** Sets (or removes, with null) the profile photo; the previous photo file is deleted. */
  async updateAvatar(
    userId: number,
    imageKey: string | null,
  ): Promise<SafeUser> {
    const current = await this.findOne(userId);
    if (current.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
    const image = imageKey
      ? await this.storage.requirePublicImage(imageKey)
      : null;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: image?.url ?? '' },
    });
    const oldName = /\/files\/public\/([^/?#]+)$/.exec(current.avatarUrl)?.[1];
    if (oldName && `public/${oldName}` !== imageKey) {
      await this.storage.delete(`public/${oldName}`).catch(() => undefined);
    }
    this.logger.log(
      `User ${userId} ${image ? 'changed' : 'removed'} their profile photo.`,
    );
    return toSafeUser(user);
  }

  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    await this.findOne(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined
          ? { name: dto.name, searchName: normalizeArabic(dto.name) }
          : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.governorate !== undefined
          ? { governorate: dto.governorate }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.neighborhood !== undefined
          ? { neighborhood: dto.neighborhood }
          : {}),
        ...(dto.educationLevel !== undefined
          ? { educationLevel: dto.educationLevel }
          : {}),
        ...(dto.fieldOfStudy !== undefined
          ? { fieldOfStudy: dto.fieldOfStudy }
          : {}),
        ...(dto.workField !== undefined ? { workField: dto.workField } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
      },
    });
    this.logger.log(`User ${userId} updated their profile.`);
    return toSafeUser(user);
  }

  async updatePrivacy(
    userId: number,
    dto: UpdatePrivacyDto,
  ): Promise<SafeUser> {
    await this.findOne(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.showAddress !== undefined
          ? { showAddress: dto.showAddress }
          : {}),
        ...(dto.showAge !== undefined ? { showAge: dto.showAge } : {}),
        ...(dto.showEducation !== undefined
          ? { showEducation: dto.showEducation }
          : {}),
        ...(dto.showWorkField !== undefined
          ? { showWorkField: dto.showWorkField }
          : {}),
        ...(dto.showTeams !== undefined ? { showTeams: dto.showTeams } : {}),
        ...(dto.showInSearch !== undefined
          ? { showInSearch: dto.showInSearch }
          : {}),
        ...(dto.hideRating !== undefined ? { hideRating: dto.hideRating } : {}),
        ...(dto.acceptsPublishRequests !== undefined
          ? { acceptsPublishRequests: dto.acceptsPublishRequests }
          : {}),
      },
    });
    this.logger.log(`User ${userId} updated their privacy settings.`);
    return toSafeUser(user);
  }

  // ── Interests & onboarding ────────────────────────────────────────────────

  async getInterests(userId: number): Promise<Interests> {
    const user = await this.findOne(userId);
    const [sections, topics] = await Promise.all([
      this.prisma.userSectionInterest.findMany({
        where: { userId },
        select: { sectionId: true },
        orderBy: { sectionId: 'asc' },
      }),
      this.prisma.userTopicInterest.findMany({
        where: { userId },
        select: { topicId: true },
        orderBy: { topicId: 'asc' },
      }),
    ]);
    return {
      sectionIds: sections.map((s) => s.sectionId),
      topicIds: topics.map((t) => t.topicId),
      primarySectionId: user.primarySectionId,
    };
  }

  /** Replaces all section and topic interests in one transaction. */
  async setInterests(userId: number, dto: SetInterestsDto): Promise<Interests> {
    const user = await this.findOne(userId);

    const sectionCount = await this.prisma.section.count({
      where: { id: { in: dto.sectionIds } },
    });
    if (sectionCount !== dto.sectionIds.length) {
      throw new BadRequestException('One or more sections do not exist.');
    }

    const topics = await this.prisma.topic.findMany({
      where: { id: { in: dto.topicIds }, isActive: true },
      select: { id: true, sectionId: true },
    });
    if (topics.length !== dto.topicIds.length) {
      throw new BadRequestException('One or more topics do not exist.');
    }
    if (topics.some((t) => !dto.sectionIds.includes(t.sectionId))) {
      throw new BadRequestException(
        'Every topic must belong to one of the chosen sections.',
      );
    }

    let primarySectionId: number | null;
    if (dto.primarySectionId !== undefined) {
      if (
        dto.primarySectionId !== null &&
        !dto.sectionIds.includes(dto.primarySectionId)
      ) {
        throw new BadRequestException(
          'The primary section must be one of your section interests.',
        );
      }
      primarySectionId = dto.primarySectionId;
    } else {
      // Keep the current home section only if it is still among the interests.
      primarySectionId =
        user.primarySectionId !== null &&
        dto.sectionIds.includes(user.primarySectionId)
          ? user.primarySectionId
          : null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userSectionInterest.deleteMany({ where: { userId } });
      await tx.userTopicInterest.deleteMany({ where: { userId } });
      await tx.userSectionInterest.createMany({
        data: dto.sectionIds.map((sectionId) => ({ userId, sectionId })),
      });
      await tx.userTopicInterest.createMany({
        data: dto.topicIds.map((topicId) => ({ userId, topicId })),
      });
      await tx.user.update({
        where: { id: userId },
        data: { primarySectionId },
      });
    });

    this.logger.log(`User ${userId} updated their interests.`);
    return this.getInterests(userId);
  }

  async setPrimarySection(
    userId: number,
    sectionId: number | null,
  ): Promise<SafeUser> {
    await this.findOne(userId);
    if (sectionId !== null) {
      const interest = await this.prisma.userSectionInterest.findUnique({
        where: { userId_sectionId: { userId, sectionId } },
      });
      if (!interest) {
        throw new BadRequestException(
          'The primary section must be one of your section interests.',
        );
      }
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { primarySectionId: sectionId },
    });
    this.logger.log(
      `User ${userId} set primary section ${sectionId ?? 'none'}.`,
    );
    return toSafeUser(user);
  }

  /** Ends the onboarding wizard. Interests are the only required step. */
  async completeOnboarding(userId: number): Promise<SafeUser> {
    const user = await this.findOne(userId);
    if (user.onboardingCompletedAt) return toSafeUser(user);

    const [sections, topics] = await Promise.all([
      this.prisma.userSectionInterest.count({ where: { userId } }),
      this.prisma.userTopicInterest.count({ where: { userId } }),
    ]);
    if (sections === 0 || topics === 0) {
      throw new BadRequestException(
        'Choose at least one section and one topic before finishing onboarding.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    });
    this.logger.log(`User ${userId} completed onboarding.`);
    return toSafeUser(updated);
  }

  // ── Account deletion ──────────────────────────────────────────────────────

  /**
   * Soft delete + anonymize (app-store requirement). Content stays and is shown under
   * "deleted account". Users are never hard-deleted.
   */
  async deleteAccount(userId: number, dto: DeleteAccountDto): Promise<void> {
    const user = await this.findOne(userId);
    if (user.isOfficial) {
      throw new BadRequestException('The official account cannot be deleted.');
    }
    const passwordOk =
      user.passwordHash !== '' &&
      (await bcrypt.compare(dto.password, user.passwordHash));
    if (!passwordOk) {
      throw new BadRequestException('Incorrect password.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          name: DELETED_ACCOUNT_NAME,
          searchName: '',
          email: null,
          phone: null,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          passwordHash: '',
          avatarUrl: '',
          bio: '',
          birthDate: new Date('1900-01-01'),
          governorate: null,
          city: '',
          neighborhood: '',
          educationLevel: null,
          fieldOfStudy: '',
          workField: '',
          primarySectionId: null,
          showAddress: false,
          showAge: false,
          showEducation: false,
          showWorkField: false,
          showTeams: false,
          showInSearch: false,
          acceptsPublishRequests: false,
          cvShareToken: null,
        },
      });
      await this.tokens.revokeAllForUser(userId, tx);
      await tx.pushDevice.deleteMany({ where: { userId } });
      await tx.otpCode.deleteMany({ where: { userId } });
      await tx.userSectionInterest.deleteMany({ where: { userId } });
      await tx.userTopicInterest.deleteMany({ where: { userId } });
      await tx.follow.deleteMany({ where: { followerId: userId } });
      await tx.userSpecialty.deleteMany({ where: { userId } });
    });
    this.logger.log(`User ${userId} deleted their account.`);
  }
}
