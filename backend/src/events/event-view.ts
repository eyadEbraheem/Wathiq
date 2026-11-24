import { ApplicationStatus, type Prisma } from '@prisma/client';

/** A question as stored in `events.application_questions`. */
export interface EventQuestion {
  id: string;
  text: string;
  required: boolean;
}

/** Reads the stored questions JSON defensively. */
export function readQuestions(value: Prisma.JsonValue): EventQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const { id, text, required } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof text !== 'string') return [];
    return [{ id, text, required: required === true }];
  });
}

/** The event fields that are only on the event page (the card has the rest). */
export const EVENT_DETAILS_SELECT = {
  latitude: true,
  longitude: true,
  applicationQuestions: true,
  autoClosedAt: true,
  documentation: true,
  documentedAt: true,
  documentationDueAt: true,
  impactMetrics: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { label: true, value: true },
  },
  post: {
    select: {
      media: {
        where: { phase: 'DOCUMENTATION' },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, url: true, mimeType: true },
      },
    },
  },
  roles: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      seats: true,
      _count: {
        select: {
          applications: { where: { status: ApplicationStatus.ACCEPTED } },
        },
      },
    },
  },
} satisfies Prisma.EventSelect;

type EventDetailsRow = Prisma.EventGetPayload<{
  select: typeof EVENT_DETAILS_SELECT;
}>;

export function toEventDetails(row: EventDetailsRow) {
  const { roles, applicationQuestions, post, ...rest } = row;
  return {
    ...rest,
    documentationMedia: post.media,
    questions: readQuestions(applicationQuestions),
    roles: roles.map(({ _count, ...role }) => ({
      ...role,
      seatsTaken: _count.applications,
      seatsLeft: Math.max(role.seats - _count.applications, 0),
    })),
  };
}

const ROLE_SELECT = { id: true, name: true } satisfies Prisma.EventRoleSelect;

/** An application as its applicant (and the organizer) sees it. */
export const APPLICATION_SELECT = {
  id: true,
  eventId: true,
  status: true,
  message: true,
  answers: true,
  createdAt: true,
  decidedAt: true,
  role: { select: ROLE_SELECT },
  rating: { select: { stars: true, updatedAt: true } },
  roleChoices: {
    orderBy: { rank: 'asc' },
    select: { rank: true, role: { select: ROLE_SELECT } },
  },
} satisfies Prisma.EventApplicationSelect;

type ApplicationRow = Prisma.EventApplicationGetPayload<{
  select: typeof APPLICATION_SELECT;
}>;

export function toApplicationView(row: ApplicationRow) {
  const { roleChoices, ...rest } = row;
  return {
    ...rest,
    roleChoices: roleChoices.map((c) => ({ rank: c.rank, ...c.role })),
  };
}
