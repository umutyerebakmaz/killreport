import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  calculateAge,
  formatKillmailDate,
  formatKillmailDateTime,
  formatKillmailTime,
  formatRelativeTime,
  formatTimeAgo,
} from "./date";

// Built in local time so the calendar-based tests are stable in any timezone.
const NOW = new Date(2026, 8, 3, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatTimeAgo", () => {
  it('returns "Unknown" for empty or invalid input', () => {
    expect(formatTimeAgo(null)).toBe("Unknown");
    expect(formatTimeAgo("not a date")).toBe("Unknown");
  });

  it('returns "just now" under a minute', () => {
    expect(formatTimeAgo(new Date(NOW.getTime() - 30_000))).toBe("just now");
  });

  it("formats minutes, hours and days with correct plurals", () => {
    expect(formatTimeAgo(new Date(NOW.getTime() - 60_000))).toBe("1 minute ago");
    expect(formatTimeAgo(new Date(NOW.getTime() - 5 * 60_000))).toBe("5 minutes ago");
    expect(formatTimeAgo(new Date(NOW.getTime() - 60 * 60_000))).toBe("1 hour ago");
    expect(formatTimeAgo(new Date(NOW.getTime() - 3 * 24 * 60 * 60_000))).toBe("3 days ago");
  });

  it("supports the short format", () => {
    expect(formatTimeAgo(new Date(NOW.getTime() - 5 * 60_000), true)).toBe("5m ago");
    expect(formatTimeAgo(new Date(NOW.getTime() - 2 * 60 * 60_000), true)).toBe("2h ago");
    expect(formatTimeAgo(new Date(NOW.getTime() - 24 * 60 * 60_000), true)).toBe("1d ago");
  });
});

describe("formatRelativeTime", () => {
  it("handles future dates", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 3 * 60 * 60_000))).toBe("in 3 hours");
    expect(formatRelativeTime(new Date(NOW.getTime() + 90_000), true)).toBe("in 1m");
  });

  it("handles past dates", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() - 2 * 24 * 60 * 60_000))).toBe("2 days ago");
    expect(formatRelativeTime(new Date(NOW.getTime() - 45 * 60_000), true)).toBe("45m ago");
  });

  it('returns "now" within a minute either way', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 10_000))).toBe("now");
    expect(formatRelativeTime(new Date(NOW.getTime() - 10_000))).toBe("now");
  });
});

describe("calculateAge", () => {
  it('returns "Unknown" for missing input', () => {
    expect(calculateAge(null)).toBe("Unknown");
  });

  it('returns "Today" for the current day', () => {
    expect(calculateAge(NOW.toISOString())).toBe("Today");
  });

  it("joins years, months and days", () => {
    expect(calculateAge(new Date(2024, 4, 1).toISOString())).toBe("2 years, 4 months and 2 days");
  });

  it("uses singular units", () => {
    expect(calculateAge(new Date(2025, 8, 3).toISOString())).toBe("1 year");
  });
});

describe("killmail formatters", () => {
  const iso = "2026-03-11T08:05:09Z";

  it("formats time in UTC as HH:MM:SS", () => {
    expect(formatKillmailTime(iso)).toBe("08:05:09");
  });

  it("formats date as Month, Day", () => {
    expect(formatKillmailDate(iso)).toBe("March, 11");
  });

  it("formats a full UTC date time", () => {
    expect(formatKillmailDateTime(iso)).toBe("March 11, 2026 08:05:09 UTC");
  });
});
