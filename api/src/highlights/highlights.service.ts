import {
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import type { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import {
  lastFinishedWeek,
  WEEK_MS,
  weekEndOf,
  weekStartOf,
} from 'src/highlights/week';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_CARD_SELECT } from 'src/users/user-card';

/** Below this many first-time volunteers in a week, nobody is named (no cheap wins). */
export const MIN_NEW_VOLUNTEERS = 5;

const HIGHLIGHT_SELECT = {
  weekStart: true,
  newVolunteers: true,
  organizer: {
    select: { ...USER_CARD_SELECT, city: true, governorate: true },
  },
} satisfies Prisma.WeeklyHighlightSelect;

type HighlightRow = Prisma.WeeklyHighlightGetPayload<{
  select: typeof HIGHLIGHT_SELECT;
}>;

const view = (row: HighlightRow) => ({
  weekStart: row.weekStart,
  weekEnd: weekEndOf(row.weekStart),
  newVolunteers: row.newVolunteers,
  organizer: row.organizer,
});

interface Candidate {
  organizer_id: number;
  new_volunteers: number;
  avg_stars: number | null;
}

/**
 * "Organization of the week". Each finished week (Saturday to Friday, Damascus) names the
 * verified account that brought the most first-time volunteers: people accepted in one of its
 * events that was completed and documented that week, when it was their first completed event
 * on the platform. Counting documented events only means a campaign must really happen (with
 * photos), not just accept people on paper. Ties go to the better rated campaigns of the week,
 * then to the account that joined first.
 */
@Injectable()
export class HighlightsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HighlightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Fills in any week missed while the API was down. Not in tests: they drive it directly. */
  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.catchUp().catch((error: unknown) =>
      this.logger.error(
        'Weekly highlight catch-up failed.',
        error instanceof Error ? error.stack : String(error),
      ),
    );
  }

  /** The latest finished week: its winner, or `organizer: null` when nobody qualified. */
  async current() {
    const row = await this.prisma.weeklyHighlight.findFirst({
      orderBy: { weekStart: 'desc' },
      select: HIGHLIGHT_SELECT,
    });
    if (!row) throw new NotFoundException('No week has been computed yet.');
    return view(row);
  }

  /** Every named winner, newest week first (the honour board). */
  async history(query: PaginationQueryDto) {
    const where = { organizerId: { not: null } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.weeklyHighlight.count({ where }),
      this.prisma.weeklyHighlight.findMany({
        where,
        orderBy: { weekStart: 'desc' },
        ...pageArgs(query),
        select: HIGHLIGHT_SELECT,
      }),
    ]);
    return paginated(rows.map(view), total, query);
  }

  /** How many weeks this account was organization of the week (shown on its profile). */
  countWins(organizerId: number) {
    return this.prisma.weeklyHighlight.count({ where: { organizerId } });
  }

  /**
   * Computes every finished week that has no row yet, from the first documented event on.
   * Only the most recent finished week sends notifications (old weeks filled in later stay
   * quiet). Safe to run any number of times.
   */
  async catchUp(now = new Date()): Promise<number> {
    const first = await this.prisma.event.findFirst({
      where: { documentedAt: { not: null } },
      orderBy: { documentedAt: 'asc' },
      select: { documentedAt: true },
    });
    if (!first?.documentedAt) return 0;
    const latest = lastFinishedWeek(now);
    const done = new Set(
      (
        await this.prisma.weeklyHighlight.findMany({
          select: { weekStart: true },
        })
      ).map((r) => r.weekStart.getTime()),
    );
    let computed = 0;
    for (
      let week = weekStartOf(first.documentedAt);
      week <= latest;
      week = new Date(week.getTime() + WEEK_MS)
    ) {
      if (done.has(week.getTime())) continue;
      await this.computeWeek(week, week.getTime() === latest.getTime());
      computed += 1;
    }
    if (computed) {
      this.logger.log(`Computed ${computed} weekly highlight week(s).`);
    }
    return computed;
  }

  /** Names the week's winner (or nobody) and stores it. Returns the winner, or null. */
  async computeWeek(
    weekStart: Date,
    notify: boolean,
  ): Promise<Candidate | null> {
    const weekEnd = weekEndOf(weekStart);
    // Per organizer: accepted volunteers whose first completed event is one of its events
    // documented this week. Deleted posts and suspended or deleted organizers do not count.
    const counts = await this.prisma.$queryRaw<Candidate[]>`
      WITH completed AS (
        SELECT e.post_id, e.documented_at, p.author_id
        FROM events e
        JOIN posts p ON p.id = e.post_id
        WHERE e.status = 'COMPLETED' AND e.documented_at IS NOT NULL
          AND p.status <> 'DELETED'
      ),
      firsts AS (
        SELECT a.user_id, MIN(c.documented_at) AS first_at
        FROM event_applications a
        JOIN completed c ON c.post_id = a.event_id
        WHERE a.status = 'ACCEPTED'
        GROUP BY a.user_id
      ),
      week_events AS (
        SELECT c.post_id, c.documented_at, c.author_id
        FROM completed c
        JOIN users o ON o.id = c.author_id
        WHERE c.documented_at >= ${weekStart} AND c.documented_at < ${weekEnd}
          AND o.deleted_at IS NULL AND o.is_suspended = false
          AND o.verified_kind IS NOT NULL
      ),
      newcomers AS (
        SELECT we.author_id, COUNT(DISTINCT a.user_id)::int AS new_volunteers
        FROM week_events we
        JOIN event_applications a
          ON a.event_id = we.post_id AND a.status = 'ACCEPTED'
        JOIN firsts f
          ON f.user_id = a.user_id AND f.first_at = we.documented_at
        GROUP BY we.author_id
      )
      SELECT n.author_id AS organizer_id, n.new_volunteers,
        (SELECT AVG(r.stars)::float FROM event_ratings r
          JOIN week_events we ON we.post_id = r.event_id
          WHERE we.author_id = n.author_id) AS avg_stars
      FROM newcomers n
      JOIN users u ON u.id = n.author_id
      ORDER BY n.new_volunteers DESC, avg_stars DESC NULLS LAST,
        u.created_at ASC, u.id ASC
      LIMIT 1
    `;
    const best = counts[0];
    const winner =
      best && best.new_volunteers >= MIN_NEW_VOLUNTEERS ? best : null;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.weeklyHighlight.create({
          data: {
            weekStart,
            organizerId: winner?.organizer_id ?? null,
            newVolunteers: winner?.new_volunteers ?? 0,
          },
        });
        if (winner && notify) {
          await this.notifyWinner(
            winner.organizer_id,
            winner.new_volunteers,
            weekStart,
            tx,
          );
        }
      });
    } catch (error) {
      // Another instance computed the same week first.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
    if (winner) {
      this.logger.log(
        `Week of ${weekStart.toISOString()}: organizer ${winner.organizer_id} with ${winner.new_volunteers} new volunteers.`,
      );
    }
    return winner;
  }

  /** Tells the winner, and its followers (the winner is the actor). */
  private async notifyWinner(
    organizerId: number,
    newVolunteers: number,
    weekStart: Date,
    tx: Prisma.TransactionClient,
  ) {
    const data = { newVolunteers, weekStart: weekStart.toISOString() };
    const followers = await tx.follow.findMany({
      where: { followingId: organizerId, follower: { deletedAt: null } },
      select: { followerId: true },
    });
    await this.notifications.createMany(
      [
        {
          recipientId: organizerId,
          type: NotificationType.WEEKLY_HIGHLIGHT,
          data: { ...data, winner: true },
        },
        ...followers.map((f) => ({
          recipientId: f.followerId,
          actorId: organizerId,
          type: NotificationType.WEEKLY_HIGHLIGHT,
          data,
        })),
      ],
      tx,
    );
  }
}
