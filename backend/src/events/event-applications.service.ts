import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  EventStatus,
  NotificationType,
  PostStatus,
  Prisma,
} from '@prisma/client';
import { ageOn } from 'src/common/utils/age';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import type { ApplyEventDto } from 'src/events/dto/apply-event.dto';
import type {
  AcceptApplicationDto,
  MoveApplicationDto,
} from 'src/events/dto/application-role.dto';
import type { FindApplicationsQueryDto } from 'src/events/dto/find-applications-query.dto';
import {
  ACTIVE_APPLICATION_STATUSES,
  ACTIVE_EVENT_STATUSES,
  applyUntil,
  lockEvent,
  syncCapacity,
} from 'src/events/event-state';
import {
  APPLICATION_SELECT,
  readQuestions,
  toApplicationView,
  type EventQuestion,
} from 'src/events/event-view';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { toPublicProfile } from 'src/users/public-profile';

const MAX_ANSWER_LENGTH = 1000;

/**
 * Applying to events and deciding applications. Every write locks the event row first, so
 * seats, auto-close and reopen stay exact under concurrent requests.
 */
@Injectable()
export class EventApplicationsService {
  private readonly logger = new Logger(EventApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Applicant ────────────────────────────────────────────────────────────

  async apply(userId: number, eventId: number, dto: ApplyEventDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        birthDate: true,
        verifiedKind: true,
        isSuspended: true,
        deletedAt: true,
      },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${userId}.`);
    }
    if (user.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
    // Volunteering is for people; an organization runs events, it does not join them.
    if (user.verifiedKind === 'ORGANIZATION') {
      throw new ForbiddenException('Organizations cannot apply to events.');
    }

    const applicationId = await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const event = await tx.event.findUniqueOrThrow({
        where: { postId: eventId },
        select: {
          status: true,
          startsAt: true,
          applicationDeadline: true,
          minAge: true,
          applicationQuestions: true,
          post: { select: { authorId: true, status: true } },
          roles: { select: { id: true } },
        },
      });
      if (event.post.status !== PostStatus.PUBLISHED) {
        throw new NotFoundException(`No event found with id ${eventId}.`);
      }
      if (event.post.authorId === userId) {
        throw new ForbiddenException('You cannot apply to your own event.');
      }
      if (event.status !== EventStatus.OPEN) {
        throw new BadRequestException(
          'This event is not accepting applications.',
        );
      }
      if (applyUntil(event) <= new Date()) {
        throw new BadRequestException('The application deadline has passed.');
      }
      // Age on the event date; organizations have no age.
      if (
        event.minAge !== null &&
        user.verifiedKind !== 'ORGANIZATION' &&
        ageOn(user.birthDate, event.startsAt) < event.minAge
      ) {
        throw new BadRequestException(
          `You must be at least ${event.minAge} years old on the day of the event.`,
        );
      }
      const roleIds = this.checkRoleChoices(
        event.roles.map((r) => r.id),
        dto.roleIds,
      );
      const answers = this.checkAnswers(
        readQuestions(event.applicationQuestions),
        dto.answers ?? {},
      );

      const existing = await tx.eventApplication.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { id: true, status: true },
      });
      if (existing && existing.status !== ApplicationStatus.WITHDRAWN) {
        throw new ConflictException('You already applied to this event.');
      }
      const data = {
        status: ApplicationStatus.PENDING,
        message: dto.message ?? '',
        answers,
        roleId: null,
        decidedById: null,
        decidedAt: null,
      };
      const choices = roleIds.map((roleId, index) => ({
        roleId,
        rank: index + 1,
      }));
      let id: number;
      try {
        if (existing) {
          // Applying again after withdrawing reuses the row (one per user and event).
          await tx.eventApplicationRoleChoice.deleteMany({
            where: { applicationId: existing.id },
          });
          await tx.eventApplication.update({
            where: { id: existing.id },
            data: { ...data, roleChoices: { create: choices } },
          });
          id = existing.id;
        } else {
          const created = await tx.eventApplication.create({
            data: {
              ...data,
              eventId,
              userId,
              roleChoices: { create: choices },
            },
            select: { id: true },
          });
          id = created.id;
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('You already applied to this event.');
        }
        throw error;
      }
      await this.notifications.create(
        {
          recipientId: event.post.authorId,
          actorId: userId,
          type: NotificationType.EVENT_APPLICATION_RECEIVED,
          postId: eventId,
          data: { applicationId: id },
        },
        tx,
      );
      return id;
    });
    this.logger.log(
      `User ${userId} applied to event ${eventId} (application ${applicationId}).`,
    );
    return this.findView(applicationId);
  }

  async withdraw(userId: number, applicationId: number) {
    const application = await this.findApplication(applicationId);
    if (application.userId !== userId) {
      throw new ForbiddenException(
        'You can only withdraw your own application.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, application.eventId);
      const current = await this.reload(tx, applicationId);
      if (!ACTIVE_APPLICATION_STATUSES.includes(current.status)) {
        throw new BadRequestException(
          'Only pending or accepted applications can be withdrawn.',
        );
      }
      if (!ACTIVE_EVENT_STATUSES.includes(current.event.status)) {
        throw new BadRequestException(
          `You cannot withdraw from a ${current.event.status.toLowerCase()} event.`,
        );
      }
      // After the deadline (or the start, when there is none) the organizer counts on you.
      if (applyUntil(current.event) <= new Date()) {
        throw new BadRequestException(
          'The application deadline has passed: you can no longer withdraw.',
        );
      }
      await tx.eventApplication.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.WITHDRAWN, roleId: null },
      });
      // A freed seat may reopen an event that closed itself because it was full.
      if (current.status === ApplicationStatus.ACCEPTED) {
        await syncCapacity(tx, application.eventId);
      }
      await this.notifications.create(
        {
          recipientId: current.event.post.authorId,
          actorId: userId,
          type: NotificationType.EVENT_APPLICATION_WITHDRAWN,
          postId: application.eventId,
          data: {
            applicationId,
            wasAccepted: current.status === ApplicationStatus.ACCEPTED,
            roleId: current.roleId,
          },
        },
        tx,
      );
    });
    this.logger.log(
      `User ${userId} withdrew application ${applicationId} (event ${application.eventId}).`,
    );
    return this.findView(applicationId);
  }

  async findMine(userId: number, query: FindApplicationsQueryDto) {
    const where: Prisma.EventApplicationWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      event: { post: { status: { not: PostStatus.DELETED } } },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.eventApplication.count({ where }),
      this.prisma.eventApplication.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
        select: {
          ...APPLICATION_SELECT,
          event: {
            select: {
              status: true,
              startsAt: true,
              endsAt: true,
              governorate: true,
              city: true,
              post: {
                select: {
                  id: true,
                  title: true,
                  section: { select: { id: true, slug: true, nameAr: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    return paginated(
      rows.map(({ event, ...row }) => {
        const { post, ...eventRest } = event;
        return {
          ...toApplicationView(row),
          event: {
            ...eventRest,
            id: post.id,
            title: post.title,
            section: post.section,
          },
        };
      }),
      total,
      query,
    );
  }

  // ── Organizer ────────────────────────────────────────────────────────────

  /** Applicants with what they chose to show (privacy switches, under-18 rule). */
  async findForEvent(
    userId: number,
    eventId: number,
    query: FindApplicationsQueryDto,
  ) {
    await this.assertOrganizer(userId, eventId);
    const where: Prisma.EventApplicationWhereInput = {
      eventId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleId
        ? {
            OR: [
              { roleId: query.roleId },
              { roleChoices: { some: { roleId: query.roleId } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.eventApplication.count({ where }),
      this.prisma.eventApplication.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: { ...APPLICATION_SELECT, user: true },
      }),
    ]);
    const now = new Date();
    return paginated(
      rows.map(({ user, ...row }) => ({
        ...toApplicationView(row),
        applicant: toPublicProfile(user, now),
      })),
      total,
      query,
    );
  }

  /**
   * Organizer inbox: applications to all of the caller's events (not deleted), oldest first so
   * the longest-waiting applicant comes first. Same applicant privacy as findForEvent.
   */
  async findForOrganizer(userId: number, query: FindApplicationsQueryDto) {
    const where: Prisma.EventApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      event: {
        post: { authorId: userId, status: { not: PostStatus.DELETED } },
      },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.eventApplication.count({ where }),
      this.prisma.eventApplication.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
        select: {
          ...APPLICATION_SELECT,
          user: true,
          event: {
            select: {
              status: true,
              startsAt: true,
              post: { select: { id: true, title: true } },
              _count: { select: { roles: true } },
            },
          },
        },
      }),
    ]);
    const now = new Date();
    return paginated(
      rows.map(({ user, event, ...row }) => ({
        ...toApplicationView(row),
        applicant: toPublicProfile(user, now),
        event: {
          id: event.post.id,
          title: event.post.title,
          status: event.status,
          startsAt: event.startsAt,
          // With roles, accepting needs a role choice (done on the event's manage page).
          hasRoles: event._count.roles > 0,
        },
      })),
      total,
      query,
    );
  }

  /** PENDING → ACCEPTED, into exactly one role with a free seat when the event has roles. */
  async accept(
    userId: number,
    applicationId: number,
    dto: AcceptApplicationDto,
  ) {
    const application = await this.findApplication(applicationId);
    let roleName: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, application.eventId);
      const current = await this.reloadForOrganizer(tx, userId, applicationId);
      if (current.status !== ApplicationStatus.PENDING) {
        throw new BadRequestException(
          'Only pending applications can be accepted.',
        );
      }
      const event = current.event;
      if (event.roles.length > 0) {
        const role = await this.requireFreeSeat(tx, event.roles, dto.roleId);
        roleName = role.name;
      } else if (dto.roleId !== undefined) {
        throw new BadRequestException('This event has no roles.');
      }
      if (event.capacity !== null) {
        const accepted = await tx.eventApplication.count({
          where: {
            eventId: application.eventId,
            status: ApplicationStatus.ACCEPTED,
          },
        });
        if (accepted >= event.capacity) {
          throw new ConflictException('The event is full.');
        }
      }
      await tx.eventApplication.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.ACCEPTED,
          roleId: event.roles.length > 0 ? (dto.roleId ?? null) : null,
          decidedById: userId,
          decidedAt: new Date(),
        },
      });
      await syncCapacity(tx, application.eventId);
      await this.notifications.create(
        {
          recipientId: application.userId,
          actorId: userId,
          type: NotificationType.EVENT_APPLICATION_DECIDED,
          postId: application.eventId,
          data: {
            applicationId,
            status: ApplicationStatus.ACCEPTED,
            roleId: dto.roleId ?? null,
            roleName,
          },
        },
        tx,
      );
    });
    this.logger.log(
      `Application ${applicationId} accepted by user ${userId} (event ${application.eventId}).`,
    );
    return this.findView(applicationId);
  }

  async reject(userId: number, applicationId: number) {
    const application = await this.findApplication(applicationId);
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, application.eventId);
      const current = await this.reloadForOrganizer(tx, userId, applicationId);
      if (current.status !== ApplicationStatus.PENDING) {
        throw new BadRequestException(
          'Only pending applications can be rejected.',
        );
      }
      await tx.eventApplication.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.REJECTED,
          decidedById: userId,
          decidedAt: new Date(),
        },
      });
      await this.notifications.create(
        {
          recipientId: application.userId,
          actorId: userId,
          type: NotificationType.EVENT_APPLICATION_DECIDED,
          postId: application.eventId,
          data: { applicationId, status: ApplicationStatus.REJECTED },
        },
        tx,
      );
    });
    this.logger.log(
      `Application ${applicationId} rejected by user ${userId} (event ${application.eventId}).`,
    );
    return this.findView(applicationId);
  }

  /** Moves an ACCEPTED volunteer to another role of the same event that has a free seat. */
  async move(userId: number, applicationId: number, dto: MoveApplicationDto) {
    const application = await this.findApplication(applicationId);
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, application.eventId);
      const current = await this.reloadForOrganizer(tx, userId, applicationId);
      if (current.status !== ApplicationStatus.ACCEPTED) {
        throw new BadRequestException(
          'Only accepted volunteers can be moved to another role.',
        );
      }
      if (current.roleId === dto.roleId) {
        throw new BadRequestException('The volunteer already has this role.');
      }
      const role = await this.requireFreeSeat(
        tx,
        current.event.roles,
        dto.roleId,
      );
      await tx.eventApplication.update({
        where: { id: applicationId },
        data: { roleId: role.id },
      });
      await this.notifications.create(
        {
          recipientId: application.userId,
          actorId: userId,
          type: NotificationType.EVENT_ROLE_CHANGED,
          postId: application.eventId,
          data: {
            applicationId,
            roleId: role.id,
            roleName: role.name,
            previousRoleId: current.roleId,
          },
        },
        tx,
      );
    });
    this.logger.log(
      `Application ${applicationId} moved to role ${dto.roleId} by user ${userId}.`,
    );
    return this.findView(applicationId);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findApplication(id: number) {
    const application = await this.prisma.eventApplication.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        userId: true,
        event: { select: { post: { select: { status: true } } } },
      },
    });
    if (!application || application.event.post.status === PostStatus.DELETED) {
      throw new NotFoundException(`No application found with id ${id}.`);
    }
    return application;
  }

  private async findView(id: number) {
    const row = await this.prisma.eventApplication.findUniqueOrThrow({
      where: { id },
      select: APPLICATION_SELECT,
    });
    return toApplicationView(row);
  }

  /** The application's current state, read after the event lock. */
  private reload(tx: Prisma.TransactionClient, id: number) {
    return tx.eventApplication.findUniqueOrThrow({
      where: { id },
      select: {
        status: true,
        roleId: true,
        event: {
          select: {
            status: true,
            capacity: true,
            startsAt: true,
            applicationDeadline: true,
            post: { select: { authorId: true } },
            roles: { select: { id: true, name: true, seats: true } },
          },
        },
      },
    });
  }

  /** reload() plus: the caller organizes the event, and the event is OPEN or CLOSED. */
  private async reloadForOrganizer(
    tx: Prisma.TransactionClient,
    userId: number,
    id: number,
  ) {
    const current = await this.reload(tx, id);
    if (current.event.post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the event organizer can manage its applications.',
      );
    }
    const organizer = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { isSuspended: true },
    });
    if (organizer.isSuspended) {
      throw new ForbiddenException('This account is suspended.');
    }
    if (!ACTIVE_EVENT_STATUSES.includes(current.event.status)) {
      throw new BadRequestException(
        `Applications of a ${current.event.status.toLowerCase()} event cannot change.`,
      );
    }
    return current;
  }

  private async assertOrganizer(userId: number, eventId: number) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: eventId,
        kind: 'EVENT',
        status: { not: PostStatus.DELETED },
      },
      select: { authorId: true },
    });
    if (!post) {
      throw new NotFoundException(`No event found with id ${eventId}.`);
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the event organizer can see its applications.',
      );
    }
  }

  /** A role of the event with at least one free seat (event locked by the caller). */
  private async requireFreeSeat(
    tx: Prisma.TransactionClient,
    roles: { id: number; name: string; seats: number }[],
    roleId: number | undefined,
  ) {
    if (roleId === undefined) {
      throw new BadRequestException(
        'This event has roles: choose the role the volunteer gets.',
      );
    }
    const role = roles.find((r) => r.id === roleId);
    if (!role) {
      throw new BadRequestException(
        `Role ${roleId} does not belong to this event.`,
      );
    }
    const taken = await tx.eventApplication.count({
      where: { roleId, status: ApplicationStatus.ACCEPTED },
    });
    if (taken >= role.seats) {
      throw new ConflictException(`The role "${role.name}" has no free seat.`);
    }
    return role;
  }

  private checkRoleChoices(
    eventRoleIds: number[],
    chosen: number[] | undefined,
  ): number[] {
    if (eventRoleIds.length === 0) {
      if (chosen && chosen.length > 0) {
        throw new BadRequestException('This event has no roles.');
      }
      return [];
    }
    if (!chosen || chosen.length === 0) {
      throw new BadRequestException(
        'Choose 1 to 3 roles, your first choice first.',
      );
    }
    const known = new Set(eventRoleIds);
    const unknown = chosen.find((id) => !known.has(id));
    if (unknown !== undefined) {
      throw new BadRequestException(
        `Role ${unknown} does not belong to this event.`,
      );
    }
    return chosen;
  }

  private checkAnswers(
    questions: EventQuestion[],
    answers: Record<string, unknown>,
  ): Record<string, string> {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const result: Record<string, string> = {};
    for (const [id, value] of Object.entries(answers)) {
      if (!byId.has(id)) {
        throw new BadRequestException(`Unknown question: ${id}.`);
      }
      if (typeof value !== 'string' || value.length > MAX_ANSWER_LENGTH) {
        throw new BadRequestException(
          `The answer to ${id} must be text of up to ${MAX_ANSWER_LENGTH} characters.`,
        );
      }
      const trimmed = value.trim();
      if (trimmed) result[id] = trimmed;
    }
    const missing = questions.find((q) => q.required && !result[q.id]);
    if (missing) {
      throw new BadRequestException(
        `Please answer the required question: ${missing.text}`,
      );
    }
    return result;
  }
}
