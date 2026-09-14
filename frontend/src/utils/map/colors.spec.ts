import { MapCelestialKind } from '@/generated/graphql';
import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_TINT,
  GATE_ALPHA,
  LABEL_TINT,
  GATE_TINT,
  hexToTint,
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

describe('LABEL_TINT', () => {
  // The design fixes the order, not the values: the background tier recedes and
  // the foreground one is the app's own body text. Asserting the order rather
  // than the numbers leaves all three free to be tuned by looking.
  it('recedes from the foreground tier to the background one', () => {
    const luminance = (tint: number) =>
      0.2126 * ((tint >> 16) & 0xff) +
      0.7152 * ((tint >> 8) & 0xff) +
      0.0722 * (tint & 0xff);

    expect(luminance(LABEL_TINT.system)).toBeGreaterThan(
      luminance(LABEL_TINT.constellation),
    );
    expect(luminance(LABEL_TINT.constellation)).toBeGreaterThan(
      luminance(LABEL_TINT.region),
    );
  });

  // gray-200 is what .system-name is set in; the map agreeing with the rest of
  // the site is the whole point of taking the tones from globals.css.
  it("uses the app's own gray-200 for a system name", () => {
    expect(LABEL_TINT.system).toBe(0xe5e7eb);
  });
});
