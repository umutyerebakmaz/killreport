/**
 * Character Corporation History Writer
 *
 * Saves a character's ESI corporation history. Used by the worker only, so it
 * goes through the worker Prisma client.
 */

import prismaWorker from '@services/prisma-worker';
import type { EsiCorporationHistoryRecord } from './character.service';

/**
 * Upserts every record and stamps `fetched_at` on all of the character's rows,
 * so `MAX(fetched_at)` is when the history was last fetched.
 *
 * One statement, not a transaction of per-row upserts: a transaction holds one
 * of the worker pool's two connections for the whole loop, and with a full
 * prefetch in flight the rest time out waiting to start one (P2028). The
 * timestamps go in as UTC text, which `timestamp` stores without shifting.
 */
export async function saveCorporationHistory(
  characterId: number,
  records: EsiCorporationHistoryRecord[],
  fetchedAt: Date,
): Promise<void> {
  const recordIds = records.map((r) => r.record_id);
  const corporationIds = records.map((r) => r.corporation_id);
  const startDates = records.map((r) => r.start_date);
  const deleted = records.map((r) => r.is_deleted ?? false);
  const stamp = fetchedAt.toISOString();

  // The UPDATE skips the incoming records: the CTE already writes those, and a
  // statement may not modify the same row twice
  await prismaWorker.$executeRaw`
    WITH incoming AS (
      SELECT *
      FROM unnest(
        ${recordIds}::bigint[],
        ${corporationIds}::int[],
        ${startDates}::timestamp(3)[],
        ${deleted}::bool[]
      ) AS v(record_id, corporation_id, start_date, is_deleted)
    ), upserted AS (
      INSERT INTO character_corporation_history
        (record_id, character_id, corporation_id, start_date, is_deleted, fetched_at)
      SELECT record_id, ${characterId}, corporation_id, start_date, is_deleted,
        ${stamp}::timestamp(3)
      FROM incoming
      ON CONFLICT (record_id) DO UPDATE SET
        character_id = EXCLUDED.character_id,
        corporation_id = EXCLUDED.corporation_id,
        start_date = EXCLUDED.start_date,
        is_deleted = EXCLUDED.is_deleted,
        fetched_at = EXCLUDED.fetched_at
    )
    UPDATE character_corporation_history
    SET fetched_at = ${stamp}::timestamp(3)
    WHERE character_id = ${characterId}
      AND record_id NOT IN (SELECT record_id FROM incoming)
  `;
}

/**
 * Corporation IDs that have no row in `corporations` yet, so their names can be
 * queued for the corporation info worker.
 */
export async function findMissingCorporationIds(
  ids: number[],
): Promise<number[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const existing = await prismaWorker.corporation.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  const known = new Set(existing.map((c) => c.id));
  return unique.filter((id) => !known.has(id));
}
