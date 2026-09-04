import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  calculateAge,
  humanReadableDate,
  formatKillmailDate,
  formatKillmailDateTime,
  formatKillmailTime,
  formatRelativeTime,
  formatTimeAgo,
} from './date';

// Built in local time so the calendar-based tests are stable in any timezone.
const NOW = new Date(2026, 8, 3, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatTimeAgo', () => {
  it('returns "Unknown" for empty or invalid input', () => {
    expect(formatTimeAgo(null)).toBe('Unknown');
    expect(formatTimeAgo('not a date')).toBe('Unknown');
  });

  it('returns "just now" under a minute', () => {
    expect(formatTimeAgo(new Date(NOW.getTime() - 30_000))).toBe('just now');
  });

  it('formats minutes, hours and days with correct plurals', () => {
    expect(formatTimeAgo(new Date(NOW.getTime() - 60_000))).toBe(
      '1 minute ago',
    );
    expect(formatTimeAgo(new Date(NOW.getTime() - 5 * 60_000))).toBe(
      '5 minutes ago',
    );
    expect(formatTimeAgo(new Date(NOW.getTime() - 60 * 60_000))).toBe(
      '1 hour ago',
    );
    expect(formatTimeAgo(new Date(NOW.getTime() - 3 * 24 * 60 * 60_000))).toBe(
      '3 days ago',
    );
  });

  it('supports the short format', () => {
    expect(formatTimeAgo(new Date(NOW.getTime() - 5 * 60_000), true)).toBe(
      '5m ago',
    );
    expect(formatTimeAgo(new Date(NOW.getTime() - 2 * 60 * 60_000), true)).toBe(
      '2h ago',
    );
    expect(
      formatTimeAgo(new Date(NOW.getTime() - 24 * 60 * 60_000), true),
    ).toBe('1d ago');
  });
});

describe('formatRelativeTime', () => {
  it('handles future dates', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 3 * 60 * 60_000))).toBe(
      'in 3 hours',
    );
    expect(formatRelativeTime(new Date(NOW.getTime() + 90_000), true)).toBe(
      'in 1m',
    );
  });

  it('handles past dates', () => {
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 2 * 24 * 60 * 60_000)),
    ).toBe('2 days ago');
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 45 * 60_000), true),
    ).toBe('45m ago');
  });

  it('returns "now" within a minute either way', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 10_000))).toBe('now');
    expect(formatRelativeTime(new Date(NOW.getTime() - 10_000))).toBe('now');
  });
});

describe('singular units', () => {
  const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

  it('says "1 hour ago" and "1 day ago", not "1 hours"', () => {
    expect(formatTimeAgo(minutes(-60))).toBe('1 hour ago');
    expect(formatTimeAgo(minutes(-1440))).toBe('1 day ago');
  });

  it('says "1 month" and "1 day" in an age', () => {
    // Born 1 August 2026: one month and two days before today.
    expect(calculateAge(new Date(2026, 7, 1).toISOString())).toBe(
      '1 month and 2 days',
    );
    // Born 2 September 2026: exactly one day.
    expect(calculateAge(new Date(2026, 8, 2).toISOString())).toBe('1 day');
  });
});

describe('formatRelativeTime units', () => {
  const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

  it('accepts a Date object as well as a string', () => {
    expect(formatRelativeTime(minutes(180))).toBe('in 3 hours');
    expect(formatRelativeTime(minutes(-180))).toBe('3 hours ago');
  });

  // Sovereignty campaign timers arrive from GraphQL as ISO strings, so the
  // string path is the one production actually takes.
  it('accepts an ISO string', () => {
    expect(formatRelativeTime(minutes(180).toISOString())).toBe('in 3 hours');
    expect(formatRelativeTime(minutes(-180).toISOString(), true)).toBe(
      '3h ago',
    );
  });

  it('returns "Unknown" for an unparseable string', () => {
    expect(formatRelativeTime('not a date')).toBe('Unknown');
  });

  it('returns "Unknown" for an invalid Date object', () => {
    expect(formatRelativeTime(new Date('nonsense'))).toBe('Unknown');
  });

  it('returns "Unknown" for missing input', () => {
    expect(formatRelativeTime(null)).toBe('Unknown');
    expect(formatRelativeTime(undefined)).toBe('Unknown');
  });

  it('accepts a Date object in formatTimeAgo too', () => {
    expect(formatTimeAgo(minutes(-120))).toBe('2 hours ago');
  });

  it.each([
    { offset: 1, long: 'in 1 minute', short: 'in 1m' },
    { offset: 2, long: 'in 2 minutes', short: 'in 2m' },
    { offset: 60, long: 'in 1 hour', short: 'in 1h' },
    { offset: 120, long: 'in 2 hours', short: 'in 2h' },
    { offset: 1440, long: 'in 1 day', short: 'in 1d' },
    { offset: 2880, long: 'in 2 days', short: 'in 2d' },
  ])('reads $long', ({ offset, long, short }) => {
    expect(formatRelativeTime(minutes(offset))).toBe(long);
    expect(formatRelativeTime(minutes(offset), true)).toBe(short);
  });

  it.each([
    { offset: -1, long: '1 minute ago', short: '1m ago' },
    { offset: -60, long: '1 hour ago', short: '1h ago' },
    { offset: -1440, long: '1 day ago', short: '1d ago' },
  ])('reads $long', ({ offset, long, short }) => {
    expect(formatRelativeTime(minutes(offset))).toBe(long);
    expect(formatRelativeTime(minutes(offset), true)).toBe(short);
  });
});

describe('calculateAge', () => {
  it('returns "Unknown" for missing input', () => {
    expect(calculateAge(null)).toBe('Unknown');
  });

  it('returns "Today" for the current day', () => {
    expect(calculateAge(NOW.toISOString())).toBe('Today');
  });

  it('joins years, months and days', () => {
    expect(calculateAge(new Date(2024, 4, 1).toISOString())).toBe(
      '2 years, 4 months and 2 days',
    );
  });

  it('uses singular units', () => {
    expect(calculateAge(new Date(2025, 8, 3).toISOString())).toBe('1 year');
  });
});

/**
 * The borrow branches: a birthday later in the month than today's date has to
 * take days from the previous month, and that can push the month count
 * negative in turn. Both were the last uncovered lines in the file.
 */
describe('calculateAge borrowing', () => {
  it('borrows days from the previous month', () => {
    // Born 20 April 2025, today is 3 September 2026.
    expect(calculateAge(new Date(2025, 3, 20).toISOString())).toBe(
      '1 year, 4 months and 14 days',
    );
  });

  it('borrows a year when the month count goes negative', () => {
    // Born 1 November 2025 — two months after today's month, same year gone.
    expect(calculateAge(new Date(2025, 10, 1).toISOString())).toBe(
      '10 months and 2 days',
    );
  });

  it('borrows days and then a year in the same calculation', () => {
    // Born 20 September 2025: the day borrow drives the month count negative.
    expect(calculateAge(new Date(2025, 8, 20).toISOString())).toBe(
      '11 months and 14 days',
    );
  });

  it('reports only the days when the birthday is this month', () => {
    expect(calculateAge(new Date(2026, 8, 1).toISOString())).toBe('2 days');
  });
});

describe('humanReadableDate', () => {
  it('returns "Unknown" for missing input', () => {
    expect(humanReadableDate(null)).toBe('Unknown');
    expect(humanReadableDate(undefined)).toBe('Unknown');
    expect(humanReadableDate('')).toBe('Unknown');
  });

  it('formats as YYYY.MM.DD HH:MM', () => {
    // No timezone suffix, so this is parsed as local time — the same clock the
    // formatter reads back — and the expectation holds in any timezone.
    expect(humanReadableDate('2026-12-25T18:45:00')).toBe('2026.12.25 18:45');
  });

  it('pads a single-digit month, day, hour and minute', () => {
    expect(humanReadableDate('2026-03-05T07:09:00')).toBe('2026.03.05 07:09');
  });

  it('drops the seconds', () => {
    expect(humanReadableDate('2026-03-05T07:09:59')).toBe('2026.03.05 07:09');
  });
});

describe('killmail formatters', () => {
  const iso = '2026-03-11T08:05:09Z';

  it('formats time in UTC as HH:MM:SS', () => {
    expect(formatKillmailTime(iso)).toBe('08:05:09');
  });

  it('formats date as Month, Day', () => {
    expect(formatKillmailDate(iso)).toBe('March, 11');
  });

  it('formats a full UTC date time', () => {
    expect(formatKillmailDateTime(iso)).toBe('March 11, 2026 08:05:09 UTC');
  });
});
