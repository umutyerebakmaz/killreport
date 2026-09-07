import { LeaderboardPeriod } from '@generated-types';

/**
 * A resolved leaderboard window.
 *
 * Both dates are inclusive YYYY-MM-DD. Shape A (the daily *_kill_stats tables)
 * compares them against a date column directly; shapes B and C compare against
 * a timestamp and so use `< endDate + INTERVAL '1 day'` for the upper bound.
 */
export interface ResolvedPeriod {
  startDate: string;
  endDate: string;
  /** The window contains today, so its numbers can still change. */
  isLive: boolean;
  /** 300 s while live, 3600 s once the window has closed. */
  cacheTtl: number;
  /** Normalised anchor for the cache key: a date, a Monday, or YYYY-MM. */
  cacheAnchor: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/** Returns the Monday (UTC) of the week containing the given date string */
export function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function toDate(now: Date): string {
  return now.toISOString().split('T')[0];
}

function requireFormat(
  anchor: string,
  pattern: RegExp,
  period: LeaderboardPeriod,
  shape: string,
): void {
  if (!pattern.test(anchor)) {
    throw new Error(
      `Invalid anchor "${anchor}" for period ${period}: expected ${shape}.`,
    );
  }
}

/**
 * True only if `dateStr` (YYYY-MM-DD) names a date that actually exists.
 * `DATE`/`MONTH` above check shape, not calendar validity, and `new
 * Date(...)` does not reliably reject an out-of-range one either: a bad
 * month (e.g. '2026-13-01') does become `Invalid Date`, but a bad
 * day-of-month (e.g. '2026-02-30') silently rolls forward into the next
 * month instead of throwing. Round-tripping through `toISOString()` and
 * comparing catches both — a rolled-over date never reproduces its input.
 */
function isCalendarDate(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

/**
 * Validates that `dateStr` is a real calendar date, reporting the error
 * against `displayAnchor` (the caller-supplied anchor, which for MONTH is
 * not the same string as `dateStr`). Called before `getWeekMonday` so a
 * rolled-over day-of-month is rejected instead of silently naming the wrong
 * week, and before any anchor reaches a raw SQL query.
 */
function requireCalendarDate(
  dateStr: string,
  displayAnchor: string,
  period: LeaderboardPeriod,
  shape: string,
): void {
  if (!isCalendarDate(dateStr)) {
    throw new Error(
      `Invalid anchor "${displayAnchor}" for period ${period}: expected ${shape}.`,
    );
  }
}

export function resolvePeriod(
  period: LeaderboardPeriod,
  anchor?: string | null,
  now: Date = new Date(),
): ResolvedPeriod {
  const today = toDate(now);
  // Whenever the caller supplied the field at all — not merely a truthy one —
  // it must be validated, and the fallback must be derived from the same
  // condition so the two can't drift apart. `anchor ?? today` alone would let
  // an empty string skip validation and survive into `startDate`.
  const hasAnchor = anchor !== undefined && anchor !== null;

  let startDate: string;
  let endDate: string;
  let cacheAnchor: string;

  switch (period) {
    case LeaderboardPeriod.Today: {
      if (hasAnchor) {
        requireFormat(anchor, DATE, period, 'YYYY-MM-DD');
        requireCalendarDate(anchor, anchor, period, 'YYYY-MM-DD');
      }
      startDate = hasAnchor ? anchor : today;
      endDate = startDate;
      cacheAnchor = startDate;
      break;
    }

    case LeaderboardPeriod.Week: {
      if (hasAnchor) {
        requireFormat(anchor, DATE, period, 'YYYY-MM-DD');
        requireCalendarDate(anchor, anchor, period, 'YYYY-MM-DD');
      }
      startDate = getWeekMonday(hasAnchor ? anchor : today);
      endDate = addDays(startDate, 6);
      cacheAnchor = startDate;
      break;
    }

    case LeaderboardPeriod.Month: {
      if (hasAnchor) requireFormat(anchor, MONTH, period, 'YYYY-MM');
      const month = hasAnchor ? anchor : today.slice(0, 7);
      if (hasAnchor)
        requireCalendarDate(`${month}-01`, anchor, period, 'YYYY-MM');
      startDate = `${month}-01`;
      // Day 0 of the following month is the last day of this one, which also
      // gets February right in a leap year.
      const [y, m] = month.split('-').map(Number);
      endDate = toDate(new Date(Date.UTC(y, m, 0)));
      cacheAnchor = month;
      break;
    }

    case LeaderboardPeriod.Last_7Days: {
      startDate = addDays(today, -6);
      endDate = today;
      cacheAnchor = today;
      break;
    }

    case LeaderboardPeriod.Last_90Days: {
      startDate = addDays(today, -89);
      endDate = today;
      cacheAnchor = today;
      break;
    }
  }

  const isLive = startDate <= today && today <= endDate;

  return {
    startDate,
    endDate,
    isLive,
    cacheTtl: isLive ? 300 : 3600,
    cacheAnchor,
  };
}
