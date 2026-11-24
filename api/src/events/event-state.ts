import { NotFoundException } from '@nestjs/common';
import { ApplicationStatus, EventStatus, type Prisma } from '@prisma/client';

/** Events whose applications can still be decided, moved or withdrawn. */
export const ACTIVE_EVENT_STATUSES: EventStatus[] = [
  EventStatus.OPEN,
  EventStatus.CLOSED,
];

/** Applications that hold or wait for a seat. */
export const ACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.PENDING,
  ApplicationStatus.ACCEPTED,
];

/**
 * Locks the event row until the transaction ends, so two requests never fill the same last
 * seat or reopen / close the event at the same time.
 */
export async function lockEvent(
  tx: Prisma.TransactionClient,
  eventId: number,
): Promise<void> {
  const rows = await tx.$queryRaw<{ post_id: number }[]>`
    SELECT post_id FROM events WHERE post_id = ${eventId} FOR UPDATE`;
  if (rows.length === 0) {
    throw new NotFoundException(`No event found with id ${eventId}.`);
  }
}

/** The last moment to apply: the deadline, or the start when there is none. */
export function applyUntil(event: {
  applicationDeadline: Date | null;
  startsAt: Date;
}): Date {
  return event.applicationDeadline ?? event.startsAt;
}

/**
 * Keeps OPEN / CLOSED in line with the seats, inside the caller's transaction (event locked):
 * - OPEN and every seat taken → CLOSED, stamped `autoClosedAt`.
 * - CLOSED by itself (`autoClosedAt` set), a seat free again, and the deadline and start not
 *   passed → OPEN. An event closed by hand never reopens here.
 */
export async function syncCapacity(
  tx: Prisma.TransactionClient,
  eventId: number,
  now: Date = new Date(),
): Promise<'closed' | 'reopened' | null> {
  const event = await tx.event.findUniqueOrThrow({
    where: { postId: eventId },
    select: {
      status: true,
      capacity: true,
      autoClosedAt: true,
      startsAt: true,
      applicationDeadline: true,
    },
  });
  const accepted = await tx.eventApplication.count({
    where: { eventId, status: ApplicationStatus.ACCEPTED },
  });
  const full = event.capacity !== null && accepted >= event.capacity;

  if (event.status === EventStatus.OPEN && full) {
    await tx.event.update({
      where: { postId: eventId },
      data: { status: EventStatus.CLOSED, autoClosedAt: now },
    });
    return 'closed';
  }

  const stillOpenForApplications =
    applyUntil(event) > now && event.startsAt > now;
  if (
    event.status === EventStatus.CLOSED &&
    event.autoClosedAt &&
    !full &&
    stillOpenForApplications
  ) {
    await tx.event.update({
      where: { postId: eventId },
      data: { status: EventStatus.OPEN, autoClosedAt: null },
    });
    return 'reopened';
  }
  return null;
}
