/**
 * `part` as a percentage of `whole`, English style (number, then `%`), to one
 * decimal place — but a whole number loses its `.0`: 100%, 62%, 12.3%, 0.4%.
 * Rounded first, so 99.96 reads as 100%.
 */
export const formatPercent = (part: number, whole: number): string => {
  if (whole <= 0) return '0%';
  const fixed = ((part / whole) * 100).toFixed(1);
  return `${fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed}%`;
};
