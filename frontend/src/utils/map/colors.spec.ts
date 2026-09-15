import { MapCelestialKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_TINT,
  GATE_ALPHA,
  GATE_ON_GROUND,
  GATE_TINT,
  hexToTint,
  HIGHLIGHT_LIFT,
  HIGHLIGHT_TINT,
  mixTint,
  SECURITY_RAMP,
  securityTint,
} from './colors';

describe('hexToTint', () => {
  it('turns a css hex into the single number Pixi wants', () => {
    // deck.gl took [r, g, b, a]; Pixi takes 0xRRGGBB and an alpha of its own.
    expect(hexToTint('#94A3B8')).toBe(0x94a3b8);
    expect(hexToTint('#000000')).toBe(0x000000);
    expect(hexToTint('#FFFFFF')).toBe(0xffffff);
  });
});

describe('securityTint', () => {
  it("keeps EVE's eleven stops, not a three-colour simplification", () => {
    expect(SECURITY_RAMP).toHaveLength(11);
    expect(SECURITY_RAMP[0]).toBe('#F00000');
    expect(SECURITY_RAMP[10]).toBe('#2FEFEF');
  });

  it('buckets to a tenth, the way star-map-svg.ts does', () => {
    expect(securityTint(1.0)).toBe(hexToTint('#2FEFEF'));
    expect(securityTint(0.5)).toBe(hexToTint('#EFEF00'));
    expect(securityTint(0.0)).toBe(hexToTint('#F00000'));
  });

  it('clamps a negative security to the bottom of the ramp', () => {
    // Nullsec runs to -1.0 and the ramp has no entries below zero.
    expect(securityTint(-0.9)).toBe(hexToTint('#F00000'));
  });

  it('clamps above 1.0 rather than reading past the array', () => {
    expect(securityTint(1.7)).toBe(hexToTint('#2FEFEF'));
  });
});

describe('gate and celestial colours', () => {
  it('keeps the gate line the shipped SVGs use', () => {
    expect(GATE_TINT).toBe(0x94a3b8);
    // deck.gl carried 140/255 inside the Rgba tuple; Pixi wants it separately.
    expect(GATE_ALPHA).toBeCloseTo(140 / 255, 6);
  });

  it('keeps every celestial colour phase 2 shipped', () => {
    expect(CELESTIAL_TINT[MapCelestialKind.Star]).toBe(0xfff4ea);
    expect(CELESTIAL_TINT[MapCelestialKind.Planet]).toBe(0x9ca3af);
    expect(CELESTIAL_TINT[MapCelestialKind.Station]).toBe(0x38bdf8);
    expect(CELESTIAL_TINT[MapCelestialKind.Gate]).toBe(0x4cc94c);
    expect(CELESTIAL_TINT[MapCelestialKind.Moon]).toBe(0x64748b);
    expect(CELESTIAL_TINT[MapCelestialKind.Belt]).toBe(0xa16207);
  });
});

describe('mixTint', () => {
  it('returns each end at the ends', () => {
    expect(mixTint(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixTint(0x000000, 0xffffff, 1)).toBe(0xffffff);
  });

  it('mixes each channel on its own, not the packed number', () => {
    // 0xFF0000 to 0x0000FF halfway is 0x800080, not the average of the two
    // integers — which is what a single lerp over the packed value would give.
    expect(mixTint(0xff0000, 0x0000ff, 0.5)).toBe(0x800080);
  });

  it('keeps a channel that does not move', () => {
    expect(mixTint(0x102030, 0x10a030, 0.5)).toBe(0x106030);
  });
});

describe('the region highlight', () => {
  it('lifts the gate line by HIGHLIGHT_LIFT from how it reads on the page', () => {
    // Not from GATE_TINT: the line is drawn at 0.55 over the ground, so the
    // raw tint is a colour nothing on screen actually is, and lifting from it
    // would overshoot.
    expect(GATE_ON_GROUND).toBe(0x535d6d);
    expect(HIGHLIGHT_TINT).toBe(mixTint(0x535d6d, 0xffffff, HIGHLIGHT_LIFT));
  });

  it('stays inside the 30-50% band the lift was tuned to', () => {
    expect(HIGHLIGHT_LIFT).toBeGreaterThanOrEqual(0.3);
    expect(HIGHLIGHT_LIFT).toBeLessThanOrEqual(0.5);
  });

  it('is lighter than the line it replaces on every channel', () => {
    for (const shift of [16, 8, 0]) {
      expect((HIGHLIGHT_TINT >> shift) & 0xff).toBeGreaterThan(
        (GATE_ON_GROUND >> shift) & 0xff,
      );
    }
  });
});
