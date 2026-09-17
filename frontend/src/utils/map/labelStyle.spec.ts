import { describe, expect, it } from 'vitest';
import {
  LABEL_TIER_STYLE,
  labelFontString,
  labelLineHeight,
  labelText,
} from './labelStyle';

describe('labelLineHeight', () => {
  it('keeps the three line heights the collision boxes are built from', () => {
    // 19/17/14, up from 18/16/14 when the family was Shentox. Roboto
    // Condensed's ascender and descender sum to 1.17 em against Shentox's
    // smaller box, so the ratio moved to 1.2 and the boxes with it.
    expect(labelLineHeight('region')).toBe(19);
    expect(labelLineHeight('constellation')).toBe(17);
    expect(labelLineHeight('system')).toBe(14);
  });

  it('moves with fontSize rather than being written by hand', () => {
    const ratio = labelLineHeight('region') / LABEL_TIER_STYLE.region.fontSize;
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThanOrEqual(1.2);
  });
});

describe('labelFontString', () => {
  it('gives weight, size and family in the order a canvas parses them', () => {
    expect(labelFontString('region')).toBe(
      `700 16px "Roboto Condensed", sans-serif`,
    );
    expect(labelFontString('constellation')).toBe(
      `600 14px "Roboto Condensed", sans-serif`,
    );
    expect(labelFontString('system')).toBe(
      `500 12px "Roboto Condensed", sans-serif`,
    );
  });
});

describe('labelText', () => {
  it('uppercases the region tier alone', () => {
    expect(labelText('region', 'Sinq Laison')).toBe('SINQ LAISON');
    expect(labelText('constellation', 'Kimotoro')).toBe('Kimotoro');
    expect(labelText('system', 'Jita')).toBe('Jita');
  });
});
