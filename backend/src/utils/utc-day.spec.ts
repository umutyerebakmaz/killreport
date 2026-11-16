import { describe, expect, it } from 'vitest';
import { utcDay } from './utc-day';

describe('utcDay', () => {
  it('uses the UTC date, not the local one', () => {
    // 00:30 in Istanbul is still the 16th in UTC.
    expect(utcDay(new Date('2026-11-17T00:30:00+03:00')).toISOString()).toBe(
      '2026-11-16T00:00:00.000Z',
    );
  });

  it('keeps the last second of the UTC day on that day', () => {
    expect(utcDay(new Date('2026-11-16T23:59:59Z')).toISOString()).toBe(
      '2026-11-16T00:00:00.000Z',
    );
  });

  it('moves to the next day at UTC midnight', () => {
    expect(utcDay(new Date('2026-11-17T00:00:00Z')).toISOString()).toBe(
      '2026-11-17T00:00:00.000Z',
    );
  });
});
