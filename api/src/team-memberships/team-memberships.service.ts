import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  NotificationType,
  Prisma,
  type TeamMembership,
  VerifiedKind,
} from '@prisma/client';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { CreateTeamMembershipDto } from 'src/team-memberships/dto/create-team-membership.dto';
import type { FindTeamMembershipsQueryDto } from 'src/team-memberships/dto/find-team-memberships-query.dto';
import type { UpdateTeamMembershipDto } from 'src/team-memberships/dto/update-team-membership.dto';
import { USER_CARD_SELECT } from 'src/users/user-card';

const ADULT_AGE = 18;

const MEMBERSHIP_FIELDS = {
  id: true,
  status: true,
  role: true,
  description: true,
  startYear: true,
  endYear: true,
  decidedAt: true,
  createdAt: true,
} satisfies Prisma.TeamMembershipSelect;

/**
 * A user asks to be listed as a (current or past) member of a verified team. It shows on
 * their profile only after the team approves, and the team can remove it later.
 */
@Injectable()
export class TeamMembershipsService {
  private readonly logger = new Logger(TeamMembershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Member side ───────────────────────────────────────────────────────────

  async create(userId: number, dto: CreateTeamMembershipDto) {
    if (dto.teamId === userId) {
      throw new BadRequestException('You cannot join your own account.');
    }
    // Members are people; an organization has members, it is not one.
    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedKind: true },
    });
    if (member?.verifiedKind === VerifiedKind.ORGANIZATION) {
      throw new ForbiddenException('Organizations cannot join teams.');
    }
    const team = await this.prisma.user.findUnique({
      where: { id: dto.teamId },
      select: { verifiedKind: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException(`No user found with id ${dto.teamId}.`);
    }
    if (!team.verifiedKind) {
      throw new BadRequestException('Only verified accounts can be teams.');
    }
    this.assertYears(dto.startYear ?? null, dto.endYear ?? null);

    const active = await this.prisma.teamMembership.findFirst({
      where: {
        userId,
        teamId: dto.teamId,
        status: { in: [MembershipStatus.PENDING, MembershipStatus.APPROVED] },
      },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException(
        'You already have a pending or approved membership with this team.',
      );
    }

    try {
      const membership = await this.prisma.$transaction(async (tx) => {
        const created = await tx.teamMembership.create({
          data: {
            userId,
            teamId: dto.teamId,
            role: dto.role ?? '',
            description: dto.description ?? '',
            startYear: dto.startYear ?? null,
            endYear: dto.endYear ?? null,
          },
          select: MEMBERSHIP_FIELDS,
        });
        await this.notifications.create(
          {
            recipientId: dto.teamId,
            actorId: userId,
            type: NotificationType.TEAM_MEMBERSHIP_REQUESTED,
            data: { membershipId: created.id },
          },
          tx,
        );
        return created;
      });
      this.logger.log(
        `Membership ${membership.id} requested: user ${userId} -> team ${dto.teamId}.`,
      );
      return membership;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You already have a pending or approved membership with this team.',
        );
      }
      throw error;
    }
  }

  async findMine(userId: number, query: FindTeamMembershipsQueryDto) {
    const where: Prisma.TeamMembershipWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.teamMembership.findMany({
        where,
        select: { ...MEMBERSHIP_FIELDS, team: { select: USER_CARD_SELECT } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.teamMembership.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  /** The member edits role, description and years while pending or approved. */
  async update(userId: number, id: number, dto: UpdateTeamMembershipDto) {
    const membership = await this.findOne(id);
    if (membership.userId !== userId) {
      throw new ForbiddenException('This is not your membership.');
    }
    this.assertEditable(membership);
    this.assertYears(
      dto.startYear !== undefined ? dto.startYear : membership.startYear,
      dto.endYear !== undefined ? dto.endYear : membership.endYear,
    );

    const updated = await this.prisma.teamMembership.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.startYear !== undefined ? { startYear: dto.startYear } : {}),
        ...(dto.endYear !== undefined ? { endYear: dto.endYear } : {}),
      },
      select: MEMBERSHIP_FIELDS,
    });
    this.logger.log(`Membership ${id} updated by user ${userId}.`);
    return updated;
  }

  /** The member withdraws a request that the team has not answered yet. */
  async cancel(userId: number, id: number): Promise<void> {
    const membership = await this.findOne(id);
    if (membership.userId !== userId) {
      throw new ForbiddenException('This is not your membership.');
    }
    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled.');
    }
    await this.prisma.teamMembership.delete({ where: { id } });
    this.logger.log(`Membership ${id} cancelled by user ${userId}.`);
  }

  // ── Team side ─────────────────────────────────────────────────────────────

  async findIncoming(teamId: number, query: FindTeamMembershipsQueryDto) {
    const where: Prisma.TeamMembershipWhereInput = {
      teamId,
      user: { deletedAt: null },
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.teamMembership.findMany({
        where,
        select: { ...MEMBERSHIP_FIELDS, user: { select: USER_CARD_SELECT } },
        orderBy: { createdAt: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.teamMembership.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  approve(teamId: number, id: number) {
    return this.decide(
      teamId,
      id,
      MembershipStatus.PENDING,
      MembershipStatus.APPROVED,
    );
  }

  reject(teamId: number, id: number) {
    return this.decide(
      teamId,
      id,
      MembershipStatus.PENDING,
      MembershipStatus.REJECTED,
    );
  }

  /** The team takes an approved membership off the member's profile. */
  remove(teamId: number, id: number) {
    return this.decide(
      teamId,
      id,
      MembershipStatus.APPROVED,
      MembershipStatus.REMOVED,
    );
  }

  // ── Public lists ──────────────────────────────────────────────────────────

  /** Approved teams on a user's profile; hidden when switched off or under 18. */
  async teamsOf(userId: number, query: FindTeamMembershipsQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true, showTeams: true, birthDate: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${userId}.`);
    }
    if (!user.showTeams || user.birthDate > this.adultCutoff()) {
      return paginated([], 0, query);
    }

    const where: Prisma.TeamMembershipWhereInput = {
      userId,
      status: MembershipStatus.APPROVED,
      team: { deletedAt: null },
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.teamMembership.findMany({
        where,
        select: {
          id: true,
          role: true,
          description: true,
          startYear: true,
          endYear: true,
          team: { select: USER_CARD_SELECT },
        },
        orderBy: [
          { endYear: { sort: 'desc', nulls: 'first' } },
          { id: 'desc' },
        ],
        ...pageArgs(query),
      }),
      this.prisma.teamMembership.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  /** Approved members of a team, limited to adults who show their teams. */
  async membersOf(teamId: number, query: FindTeamMembershipsQueryDto) {
    const team = await this.prisma.user.findUnique({
      where: { id: teamId },
      select: { deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException(`No user found with id ${teamId}.`);
    }

    const where: Prisma.TeamMembershipWhereInput = {
      teamId,
      status: MembershipStatus.APPROVED,
      user: {
        deletedAt: null,
        showTeams: true,
        birthDate: { lte: this.adultCutoff() },
      },
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.teamMembership.findMany({
        where,
        select: {
          id: true,
          role: true,
          startYear: true,
          endYear: true,
          user: { select: USER_CARD_SELECT },
        },
        orderBy: { id: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.teamMembership.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findOne(id: number): Promise<TeamMembership> {
    const membership = await this.prisma.teamMembership.findUnique({
      where: { id },
    });
    if (!membership) {
      throw new NotFoundException(`No team membership found with id ${id}.`);
    }
    return membership;
  }

  private async decide(
    teamId: number,
    id: number,
    from: MembershipStatus,
    to: MembershipStatus,
  ) {
    const membership = await this.findOne(id);
    if (membership.teamId !== teamId) {
      throw new ForbiddenException(
        'Only the team can decide on this membership.',
      );
    }
    if (membership.status !== from) {
      throw new BadRequestException(
        `This membership is ${membership.status.toLowerCase()}, not ${from.toLowerCase()}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.teamMembership.update({
        where: { id },
        data: { status: to, decidedAt: new Date() },
        select: MEMBERSHIP_FIELDS,
      });
      await this.notifications.create(
        {
          recipientId: membership.userId,
          actorId: teamId,
          type: NotificationType.TEAM_MEMBERSHIP_DECIDED,
          data: { membershipId: id, status: to },
        },
        tx,
      );
      return row;
    });
    this.logger.log(`Membership ${id} ${to.toLowerCase()} by team ${teamId}.`);
    return updated;
  }

  private assertEditable(membership: TeamMembership): void {
    if (
      membership.status !== MembershipStatus.PENDING &&
      membership.status !== MembershipStatus.APPROVED
    ) {
      throw new BadRequestException(
        `This membership is ${membership.status.toLowerCase()} and cannot be edited.`,
      );
    }
  }

  private assertYears(startYear: number | null, endYear: number | null): void {
    const thisYear = new Date().getUTCFullYear();
    if (startYear !== null && startYear > thisYear) {
      throw new BadRequestException('startYear cannot be in the future.');
    }
    if (endYear !== null && endYear > thisYear) {
      throw new BadRequestException('endYear cannot be in the future.');
    }
    if (startYear !== null && endYear !== null && endYear < startYear) {
      throw new BadRequestException('endYear cannot be before startYear.');
    }
  }

  /** Users born on or before this date are 18 or older today. */
  private adultCutoff(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear() - ADULT_AGE,
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );
  }
}
