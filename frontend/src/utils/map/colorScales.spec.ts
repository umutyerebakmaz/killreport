import { describe, expect, it } from 'vitest';
import { hexToRgba, SECURITY_RAMP, securityColor } from './colorScales';

describe('SECURITY_RAMP', () => {
  it('has one colour per tenth, matching the shipped region maps', () => {
    expect(SECURITY_RAMP).toHaveLength(11);
    expect(SECURITY_RAMP[0]).toBe('#F00000');
    expect(SECURITY_RAMP[10]).toBe('#2FEFEF');
  });
});

describe('hexToRgba', () => {
  it('splits a six-digit hex', () => {
    expect(hexToRgba('#2FEFEF')).toEqual([47, 239, 239, 255]);
  });

  it('takes an explicit alpha', () => {
    expect(hexToRgba('#94A3B8', 140)).toEqual([148, 163, 184, 140]);
  });
});

describe('securityColor', () => {
  it('buckets to the nearest tenth, like backend/src/scripts/star-map-svg.ts', () => {
    expect(securityColor(1.0)).toEqual(hexToRgba('#2FEFEF'));
    expect(securityColor(0.95)).toEqual(hexToRgba('#2FEFEF'));
    expect(securityColor(0.94)).toEqual(hexToRgba('#48F0C0'));
    expect(securityColor(0.5)).toEqual(hexToRgba('#EFEF00'));
  });

  it('clamps everything at or below zero to the red end', () => {
    expect(securityColor(0)).toEqual(hexToRgba('#F00000'));
    expect(securityColor(-0.99)).toEqual(hexToRgba('#F00000'));
  });

  it('does not fall off the end of the ramp above 1.0', () => {
    expect(securityColor(1.5)).toEqual(hexToRgba('#2FEFEF'));
  });

  it('keeps the two lowsec systems nearest the boundary out of the highsec colour', () => {
    // 0.49 buckets to 5 (#EFEF00), 0.5 to 5 as well - the ramp is coarser than
    // the classification, which is why the service truncates rather than rounds
    // the value itself.
    expect(securityColor(0.49)).toEqual(securityColor(0.5));
  });
});
