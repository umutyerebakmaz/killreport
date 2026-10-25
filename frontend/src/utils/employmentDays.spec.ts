import { describe, expect, it } from 'vitest';

import { employmentDays } from './employmentDays';

describe('employmentDays', () => {
  it('counts whole days between start and end, rounding down', () => {
    expect(employmentDays('2022-09-18T09:56:00Z', '2026-01-17T18:13:00Z')).toBe(
      1217,
    );
    expect(employmentDays('2007-04-30T17:47:00Z', '2007-05-15T18:38:00Z')).toBe(
      15,
    );
  });

  it('counts up to now for the current corporation', () => {
    expect(
      employmentDays(
        '2026-10-24T12:00:00Z',
        null,
        new Date('2026-10-25T11:59:00Z'),
      ),
    ).toBe(0);
  });
});
