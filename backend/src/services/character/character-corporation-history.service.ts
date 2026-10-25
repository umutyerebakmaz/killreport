/**
 * Character Corporation History Service
 *
 * Reads a character's corporation history for the Employment History tab.
 * The worker refreshes it weekly, so it is cached as rarely changing data.
 */

import prisma from '@services/prisma';
import redis from '@services/redis';

const CACHE_TTL = 7200;

export interface CorporationHistoryRow {
  recordId: number;
  corporationId: number;
  startDate: string;
  endDate: string | null;
  isDeleted: boolean;
}

/**
 * Newest first. ESI gives each record a start date only, so a record ends
 * where the next, newer one starts; the newest has no end.
 */
export async function getCorporationHistory(
  characterId: number,
): Promise<CorporationHistoryRow[]> {
  const cacheKey = `character:corporation-history:${characterId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const rows = await prisma.characterCorporationHistory.findMany({
    where: { character_id: characterId },
    orderBy: [{ start_date: 'desc' }, { record_id: 'desc' }],
  });

  const history = rows.map((row, i) => ({
    // BigInt does not survive JSON.stringify; record ids are far below 2^53
    recordId: Number(row.record_id),
    corporationId: row.corporation_id,
    startDate: row.start_date.toISOString(),
    endDate: i === 0 ? null : rows[i - 1].start_date.toISOString(),
    isDeleted: row.is_deleted,
  }));

  // An empty list means the worker has not fetched the character yet; caching
  // it would hide the first fetch for the whole TTL
  if (history.length > 0) {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(history));
  }
  return history;
}
