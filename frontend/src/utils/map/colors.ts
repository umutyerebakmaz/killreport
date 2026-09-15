import { MapCelestialKind } from '@/generated/graphql';

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
 * The page behind the canvas — `--color-ground`, which is Tailwind's gray-950.
 * Named here because the gate line is drawn at 0.55 alpha, so what a reader
 * actually sees is this blended with GATE_TINT, and the highlight below is
 * defined relative to what is seen.
 */
export const GROUND_TINT = 0x030712;

/**
 * How much lighter a hovered region's lines are than the same lines were a
 * moment earlier, as a fraction of the distance to white.
 *
 * The first version of this was plain white at full alpha, which is a 100%
 * lift and read as a different material rather than the same lines lit. 0.4 is
 * the middle of the 30-50% band that replaced it: the region separates at a
 * glance and still belongs to the map.
 *
 * A judgement, not a measurement. Tune by looking.
 */
export const HIGHLIGHT_LIFT = 0.4;

/** Per channel, `amount` of the way from one tint to the other. */
export function mixTint(from: number, to: number, amount: number): number {
  let mixed = 0;
  for (const shift of [16, 8, 0]) {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    mixed |= Math.round(a + (b - a) * amount) << shift;
  }
  return mixed >>> 0;
}

/**
 * The gate line as it reads on the page: GATE_TINT already composited over the
 * ground at GATE_ALPHA. Lifting from here rather than from GATE_TINT is what
 * makes HIGHLIGHT_LIFT mean what it says — the raw tint is a colour nothing on
 * screen is.
 */
export const GATE_ON_GROUND = mixTint(GROUND_TINT, GATE_TINT, GATE_ALPHA);

/**
 * Derived rather than written as a hex, so the lift stays a lift if the gate
 * line's own colour or alpha is ever retuned.
 *
 * At 0.4 this lands on #989EA7, a few steps from GATE_TINT itself — so the
 * highlight is very nearly the gate colour with its veil taken off, and no
 * second colour enters the palette.
 */
export const HIGHLIGHT_TINT = mixTint(GATE_ON_GROUND, 0xffffff, HIGHLIGHT_LIFT);

/** Opaque: the lift is carried by the colour, so the alpha has nothing to say. */
export const HIGHLIGHT_ALPHA = 1;

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
