import type { Prisma } from '@prisma/client';
import { USER_CARD_SELECT } from 'src/users/user-card';

/** Everything a post card or a post page shows. `viewerId` fills `upvotedByMe`. */
export function postSelect(viewerId: number) {
  return {
    id: true,
    kind: true,
    status: true,
    title: true,
    body: true,
    upvoteCount: true,
    commentCount: true,
    createdAt: true,
    updatedAt: true,
    section: {
      select: {
        id: true,
        slug: true,
        nameAr: true,
        nameEn: true,
        logoUrl: true,
      },
    },
    topics: {
      select: {
        topic: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
      },
    },
    author: { select: USER_CARD_SELECT },
    creditedUser: { select: USER_CARD_SELECT },
    media: {
      where: { phase: 'MAIN' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, url: true, mimeType: true },
    },
    caseDetails: {
      select: { contactPhone: true, paymentQrUrl: true, paymentNote: true },
    },
    opportunity: {
      select: {
        deadline: true,
        applyUrl: true,
        mode: true,
        location: true,
        eligibility: true,
        minAge: true,
        maxAge: true,
        educationLevel: true,
        field: true,
      },
    },
    event: {
      select: {
        status: true,
        startsAt: true,
        endsAt: true,
        applicationDeadline: true,
        capacity: true,
        volunteerHours: true,
        governorate: true,
        city: true,
        locationText: true,
        minAge: true,
        _count: {
          select: { applications: { where: { status: 'ACCEPTED' } } },
        },
      },
    },
    collaborations: {
      where: { status: 'ACCEPTED' },
      orderBy: { respondedAt: 'asc' },
      select: { invitee: { select: USER_CARD_SELECT } },
    },
    upvotes: { where: { userId: viewerId }, select: { userId: true } },
  } satisfies Prisma.PostSelect;
}

type PostRow = Prisma.PostGetPayload<{
  select: ReturnType<typeof postSelect>;
}>;

/** The API shape of a post (same for the feed, the post page and after a write). */
export function toPostView(row: PostRow, now = new Date()) {
  const { topics, upvotes, opportunity, event, collaborations, ...rest } = row;
  return {
    ...rest,
    collaborators: collaborations.map((c) => c.invitee),
    event: event ? toEventSummary(event) : null,
    topics: topics.map((t) => t.topic),
    opportunity: opportunity
      ? {
          ...opportunity,
          // Computed, never stored: open until the deadline passes.
          isOpen: !opportunity.deadline || opportunity.deadline > now,
        }
      : null,
    upvotedByMe: upvotes.length > 0,
  };
}

/** The event block of a post card: dates, place and how many seats are left. */
function toEventSummary(event: NonNullable<PostRow['event']>) {
  const { _count, ...rest } = event;
  const acceptedCount = _count.applications;
  return {
    ...rest,
    acceptedCount,
    seatsLeft:
      rest.capacity === null
        ? null
        : Math.max(rest.capacity - acceptedCount, 0),
  };
}

export type PostView = ReturnType<typeof toPostView>;
