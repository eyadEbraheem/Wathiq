/** Damascus is UTC+3 all year (no daylight saving since 2022). */
const DAMASCUS_OFFSET_MS = 3 * 60 * 60 * 1000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SATURDAY = 6;

/**
 * Start of the week that contains `at`: Saturday 00:00 Damascus time, as a UTC Date. The
 * Syrian week runs Saturday to Friday.
 */
export function weekStartOf(at: Date): Date {
  const local = new Date(at.getTime() + DAMASCUS_OFFSET_MS);
  const daysSinceSaturday = (local.getUTCDay() - SATURDAY + 7) % 7;
  const start = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceSaturday,
  );
  return new Date(start - DAMASCUS_OFFSET_MS);
}

/** The last week that is already over at `at` (the one before the current week). */
export function lastFinishedWeek(at: Date): Date {
  return new Date(weekStartOf(at).getTime() - WEEK_MS);
}

export const weekEndOf = (weekStart: Date) =>
  new Date(weekStart.getTime() + WEEK_MS);
