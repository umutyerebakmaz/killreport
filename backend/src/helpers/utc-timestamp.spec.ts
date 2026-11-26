import { describe, expect, it } from 'vitest';
import { utcTimestamp } from './utc-timestamp';

describe('utcTimestamp', () => {
  it('is the UTC wall clock without a zone, for timestamp(3) columns', () => {
    expect(utcTimestamp(new Date('2026-11-26T10:00:00.123Z'))).toBe(
      '2026-11-26 10:00:00.123',
    );
    expect(utcTimestamp(new Date('2026-11-26T00:00:00.000Z'))).toBe(
      '2026-11-26 00:00:00.000',
    );
  });
});
