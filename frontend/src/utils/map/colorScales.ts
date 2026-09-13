export type Rgba = [number, number, number, number];

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

export function hexToRgba(hex: string, alpha = 255): Rgba {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

/** Same bucketing as star-map-svg.ts's securityColour, so the two never differ. */
export function securityColor(security: number): Rgba {
  const bucket = Math.round(Math.max(0, security) * 10);
  return hexToRgba(SECURITY_RAMP[Math.min(bucket, SECURITY_RAMP.length - 1)]);
}
