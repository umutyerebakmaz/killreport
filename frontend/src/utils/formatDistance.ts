/** One astronomical unit in metres, the IAU's exact definition. */
export const AU_METRES = 149_597_870_700;

/**
 * A distance in metres the way a pilot reads it: metres under a kilometre,
 * whole kilometres under a tenth of an AU, then AU to one decimal — so 83 km,
 * 5,332 km and 2.7 AU.
 */
export const formatDistance = (metres: number): string => {
  if (metres < 1_000) return `${Math.round(metres)} m`;
  if (metres < 0.1 * AU_METRES) {
    return `${Math.round(metres / 1_000).toLocaleString('en-US')} km`;
  }
  return `${(metres / AU_METRES).toFixed(1)} AU`;
};
