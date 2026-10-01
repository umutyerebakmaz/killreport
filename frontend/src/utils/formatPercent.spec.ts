import { describe, expect, it } from 'vitest';

import { formatPercent } from './formatPercent';

describe('formatPercent', () => {
  it('drops the decimal from a whole number', () => {
    expect(formatPercent(10_000, 10_000)).toBe('100%');
    expect(formatPercent(6_200, 10_000)).toBe('62%');
  });

  it('keeps one decimal when there is one', () => {
    expect(formatPercent(1_234, 10_000)).toBe('12.3%');
    expect(formatPercent(40, 10_000)).toBe('0.4%');
  });

  it('rounds to one decimal before deciding', () => {
    // 99.96 rounds to 100.0, so it reads as a whole 100%.
    expect(formatPercent(9_996, 10_000)).toBe('100%');
  });

  it('is 0% when there is nothing to divide by', () => {
    expect(formatPercent(5, 0)).toBe('0%');
  });
});
