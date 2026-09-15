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
 * The label tiers. One colour, white, for all three.
 *
 * The app's own text tones were tried first — gray-500, gray-400, gray-200 from
 * `globals.css`, the last being what `.system-name` is set in — on the reasoning
 * that the background tier should recede. On the map they were simply hard to
 * read: a name over the galaxy has no surface behind it, so a tone that reads as
 * "quieter" against a card reads as "washed out" against black. Reverted
 * 2026-09-15 after looking.
 *
 * The hierarchy is carried by size instead — 16 / 12 / 8, with region
 * uppercased and letter-spaced — which is a difference that survives being read
 * at a glance where a difference of tone did not.
 *
 * Kept as a record rather than collapsed to one constant: the tiers are what
 * a hovered group will tint, and that is where a second colour earns its place.
 */
export const LABEL_TINT: Record<LabelTier, number> = {
  region: 0xffffff,
  constellation: 0xffffff,
  system: 0xffffff,
};
