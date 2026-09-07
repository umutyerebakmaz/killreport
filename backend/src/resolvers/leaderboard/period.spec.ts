import { describe, expect, it } from 'vitest';

import { LeaderboardPeriod } from '@generated-types';

import { getWeekMonday, resolvePeriod } from './period';

/** A fixed Wednesday, so week arithmetic has something to round back from. */
const NOW = new Date('2026-09-09T11:30:00.000Z');

describe('getWeekMonday', () => {
  it('rounds a mid-week day back to its Monday', () => {
    expect(getWeekMonday('2026-09-09')).toBe('2026-09-07');
  });

  it('leaves a Monday where it is', () => {
    expect(getWeekMonday('2026-09-07')).toBe('2026-09-07');
  });

  it('rounds Sunday back six days, not forward one', () => {
    expect(getWeekMonday('2026-09-13')).toBe('2026-09-07');
  });
});

describe('resolvePeriod TODAY', () => {
  it('spans a single day and is live when the anchor is today', () => {
    expect(resolvePeriod(LeaderboardPeriod.Today, null, NOW)).toEqual({
      startDate: '2026-09-09',
      endDate: '2026-09-09',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09-09',
    });
  });

  it('is not live for a past day and caches it for an hour', () => {
    expect(resolvePeriod(LeaderboardPeriod.Today, '2026-09-01', NOW)).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      isLive: false,
      cacheTtl: 3600,
      cacheAnchor: '2026-09-01',
    });
  });
});

describe('resolvePeriod WEEK', () => {
  it('spans Monday to Sunday of the current week and is live', () => {
    expect(resolvePeriod(LeaderboardPeriod.Week, null, NOW)).toEqual({
      startDate: '2026-09-07',
      endDate: '2026-09-13',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09-07',
    });
  });

  it('rounds any day of a past week back to its Monday', () => {
    expect(resolvePeriod(LeaderboardPeriod.Week, '2026-09-03', NOW)).toEqual({
      startDate: '2026-08-31',
      endDate: '2026-09-06',
      isLive: false,
      cacheTtl: 3600,
      cacheAnchor: '2026-08-31',
    });
  });
});

describe('resolvePeriod MONTH', () => {
  it('spans the whole current month and is live', () => {
    expect(resolvePeriod(LeaderboardPeriod.Month, null, NOW)).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09',
    });
  });

  it('handles a 31-day past month', () => {
    expect(resolvePeriod(LeaderboardPeriod.Month, '2026-07', NOW)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      isLive: false,
      cacheTtl: 3600,
      cacheAnchor: '2026-07',
    });
  });

  it('handles December without rolling the year wrong', () => {
    expect(resolvePeriod(LeaderboardPeriod.Month, '2025-12', NOW)).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      isLive: false,
      cacheTtl: 3600,
      cacheAnchor: '2025-12',
    });
  });

  it('handles a leap February', () => {
    expect(resolvePeriod(LeaderboardPeriod.Month, '2024-02', NOW).endDate).toBe(
      '2024-02-29',
    );
  });
});

describe('resolvePeriod rolling windows', () => {
  it('LAST_7_DAYS covers today and the six days before it', () => {
    expect(resolvePeriod(LeaderboardPeriod.Last_7Days, null, NOW)).toEqual({
      startDate: '2026-09-03',
      endDate: '2026-09-09',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09-09',
    });
  });

  it('LAST_90_DAYS covers today and the 89 days before it', () => {
    expect(resolvePeriod(LeaderboardPeriod.Last_90Days, null, NOW)).toEqual({
      startDate: '2026-06-12',
      endDate: '2026-09-09',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09-09',
    });
  });

  it('ignores an anchor rather than letting it shift the window', () => {
    expect(
      resolvePeriod(LeaderboardPeriod.Last_7Days, '2020-01-01', NOW).startDate,
    ).toBe('2026-09-03');
  });
});

describe('resolvePeriod rejects a malformed anchor', () => {
  it('throws when TODAY gets a month string', () => {
    expect(() => resolvePeriod(LeaderboardPeriod.Today, '2026-09', NOW)).toThrow(
      /anchor/i,
    );
  });

  it('throws when MONTH gets a full date', () => {
    expect(() =>
      resolvePeriod(LeaderboardPeriod.Month, '2026-09-09', NOW),
    ).toThrow(/anchor/i);
  });

  it('throws on a non-date string', () => {
    expect(() => resolvePeriod(LeaderboardPeriod.Week, 'last week', NOW)).toThrow(
      /anchor/i,
    );
  });
});
