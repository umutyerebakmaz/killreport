import { describe, expect, it } from 'vitest';

import { AU_METRES, formatDistance } from './formatDistance';

describe('formatDistance', () => {
  it('writes metres under a kilometre', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(742.6)).toBe('743 m');
  });

  it('writes whole kilometres with thousands separators', () => {
    expect(formatDistance(1_000)).toBe('1 km');
    expect(formatDistance(82_995.46)).toBe('83 km');
    expect(formatDistance(5_331_810.38)).toBe('5,332 km');
  });

  it('switches to AU at a tenth of one', () => {
    expect(formatDistance(0.0999 * AU_METRES)).toMatch(/ km$/);
    expect(formatDistance(0.1 * AU_METRES)).toBe('0.1 AU');
    expect(formatDistance(403_942_607_636.09)).toBe('2.7 AU');
  });
});
