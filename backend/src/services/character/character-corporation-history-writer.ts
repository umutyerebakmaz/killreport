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
 */
export async function saveCorporationHistory(
  characterId: number,
  records: EsiCorporationHistoryRecord[],
  fetchedAt: Date,
): Promise<void> {
  await prismaWorker.$transaction(async (tx) => {
    for (const record of records) {
      const fields = {
        character_id: characterId,
        corporation_id: record.corporation_id,
        start_date: new Date(record.start_date),
        is_deleted: record.is_deleted ?? false,
        fetched_at: fetchedAt,
      };
      await tx.characterCorporationHistory.upsert({
        where: { record_id: BigInt(record.record_id) },
        create: { record_id: BigInt(record.record_id), ...fields },
        update: fields,
      });
    }

    await tx.characterCorporationHistory.updateMany({
      where: { character_id: characterId },
      data: { fetched_at: fetchedAt },
    });
  });
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
