const DAY_MS = 86_400_000;

/**
 * Whole days a character spent in a corporation, rounded down as the game
 * does. The current corporation has no end date and counts up to now.
 */
export const employmentDays = (
  startDate: string,
  endDate: string | null | undefined,
  now: Date = new Date(),
): number => {
  const end = endDate ? new Date(endDate).getTime() : now.getTime();
  return Math.floor((end - new Date(startDate).getTime()) / DAY_MS);
};
