import { MapCelestialKind } from '@/generated/graphql';
import type { LabelTier } from './lod';

/**
 * EVE's security ramp, 0.0 to 1.0, one entry per tenth. Byte for byte the array
 * in backend/src/scripts/star-map-svg.ts, which colours the region and
 * constellation SVGs already shipped under frontend/public/images — the map has
 * to agree with those or the same system is two colours in two places.
 *
 * Duplicated rather than shared because those SVGs are pre-rendered on the
 * backend: there is no module the two sides both import.
 */
export const SECURITY_RAMP = [
  '#F00000',
  '#D73000',
  '#F04800',
  '#F06000',
  '#D77700',
  '#EFEF00',
  '#8FEF2F',
  '#00F000',
  '#00EF47',
  '#48F0C0',
  '#2FEFEF',
] as const;

/** Pixi tints with a single number, not the [r, g, b, a] tuple deck.gl took. */
export function hexToTint(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** Same bucketing as star-map-svg.ts's securityColour, so the two never differ. */
export function securityTint(security: number): number {
  const bucket = Math.round(Math.max(0, security) * 10);
  return hexToTint(SECURITY_RAMP[Math.min(bucket, SECURITY_RAMP.length - 1)]);
}

/**
 * #94A3B8 at 0.55 alpha — the same line the shipped region SVGs use for an
 * internal jump (star-map-svg.ts, REGION_PALETTE.jump). The alpha is separate
 * because Pixi carries it on the object, not in the colour.
 */
export const GATE_TINT = 0x94a3b8;
export const GATE_ALPHA = 140 / 255;

/**
 * Phase 2's palette, unchanged. Three are inherited from the shipped SVGs —
 * star #FFF4EA and planet #9CA3AF from solar-system-map-svg.ts, gate #4CC94C
 * from star-map-svg.ts — and three were chosen because those SVGs draw no
 * stations, moons or belts.
 */
export const CELESTIAL_TINT: Record<MapCelestialKind, number> = {
  STAR: 0xfff4ea,
  PLANET: 0x9ca3af,
  STATION: 0x38bdf8,
  GATE: 0x4cc94c,
  MOON: 0x64748b,
  BELT: 0xa16207,
};

/**
 * The label tiers, in the app's own text tones.
 *
 * Taken from `globals.css`'s palette rather than chosen here: gray-200 is what
 * `.system-name` and every other entity name on the site is set in, and the two
 * steps above it are the same ramp receding. Tailwind 4 states them in OKLCH; a
 * Pixi tint needs an sRGB number, so these are the converted values —
 * gray-200 oklch(92.8% 0.006 264.531), gray-400 oklch(70.7% 0.022 261.325),
 * gray-500 oklch(55.1% 0.027 264.364).
 *
 * Grey rather than three hues on purpose: the dots already carry a strong
 * red-to-cyan ramp for security, and a coloured name beside a coloured dot puts
 * two unrelated meanings in the same channel.
 *
 * Free at runtime — the atlases are installed with `dynamicFill`, so a tint
 * costs no second atlas.
 */
export const LABEL_TINT: Record<LabelTier, number> = {
  region: 0x6a7282,
  constellation: 0x99a1af,
  system: 0xe5e7eb,
};
