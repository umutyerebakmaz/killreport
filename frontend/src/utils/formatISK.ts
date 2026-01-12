/**
 * Format ISK values to human-readable format
 * @param amount - The ISK amount to format
 * @returns Formatted ISK string (e.g., "1.50M ISK", "2.30B ISK")
 */
export function formatISK(amount: number | null | undefined): string {
  if (!amount) return "0 ISK";

  const absAmount = Math.abs(amount);

  if (absAmount >= 1_000_000_000_000) {
    return `${(amount / 1_000_000_000_000).toFixed(2)}T ISK`;
  } else if (absAmount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B ISK`;
  } else if (absAmount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M ISK`;
  } else if (absAmount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K ISK`;
  }

  return `${Math.round(amount).toLocaleString()} ISK`;
}
