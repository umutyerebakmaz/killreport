import { describe, expect, it } from 'vitest';
import {
  LABEL_TIER_STYLE,
  labelFontString,
  labelLineHeight,
  labelText,
} from './labelStyle';

describe('labelLineHeight', () => {
  it('keeps the three line heights the collision boxes are built from', () => {
    expect(labelLineHeight('region')).toBe(18);
    expect(labelLineHeight('constellation')).toBe(16);
    expect(labelLineHeight('system')).toBe(14);
  });

  it('moves with fontSize rather than being written by hand', () => {
    const ratio = labelLineHeight('region') / LABEL_TIER_STYLE.region.fontSize;
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(1.2);
  });
});

describe('labelFontString', () => {
  it('gives weight, size and family in the order a canvas parses them', () => {
    expect(labelFontString('region')).toBe('700 16px Shentox, sans-serif');
    expect(labelFontString('constellation')).toBe(
      '600 14px Shentox, sans-serif',
    );
    expect(labelFontString('system')).toBe('500 12px Shentox, sans-serif');
  });
});

describe('labelText', () => {
  it('uppercases the region tier alone', () => {
    expect(labelText('region', 'Sinq Laison')).toBe('SINQ LAISON');
    expect(labelText('constellation', 'Kimotoro')).toBe('Kimotoro');
    expect(labelText('system', 'Jita')).toBe('Jita');
  });
});
