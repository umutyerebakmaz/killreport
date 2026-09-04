import { describe, expect, it } from 'vitest';

import { formatISK } from './formatISK';

describe('formatISK', () => {
  it('returns "0" for null, undefined and zero', () => {
    expect(formatISK(null)).toBe('0');
    expect(formatISK(undefined)).toBe('0');
    expect(formatISK(0)).toBe('0');
  });

  it('formats values below one thousand as rounded integers', () => {
    expect(formatISK(999)).toBe('999');
    expect(formatISK(12.6)).toBe('13');
  });

  it('uses K, M, B and T suffixes with two decimals', () => {
    expect(formatISK(1_500)).toBe('1.50K');
    expect(formatISK(2_345_678)).toBe('2.35M');
    expect(formatISK(1_000_000_000)).toBe('1.00B');
    expect(formatISK(3_210_000_000_000)).toBe('3.21T');
  });

  it('keeps the sign of negative values', () => {
    expect(formatISK(-1_500_000)).toBe('-1.50M');
  });
});
