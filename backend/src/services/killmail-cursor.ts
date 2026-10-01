import prismaWorker from '@services/prisma-worker';

/**
 * Where an incremental sync should stop, derived from the database.
 *
 * This used to be a column (`users.last_killmail_id`) that the worker advanced
 * after writing killmails. Once publishing and writing are split, that ledger
 * starts to lie: if the publisher advances the cursor, "synced" now means
 * "queued", and a killmail that lands in parking gets skipped over
 * — never to be tried again.
 *
 * Read from here, "synced" means "written" again.
 *
 * **It does not heal itself.** This is a `MAX()`, and the ESI list endpoint
 * stops at an exact id match; a gap *below* the max — a killmail that landed
 * in parking — is never listed again. The column it replaces did the same.
 * The record of such a killmail is the `killreport.parking` queue.
 *
 * **This table is not this sync's ledger.** Every writer feeds it and RedisQ
 * writes the whole EVE feed, so the max here means "this entity's newest
 * killmail in EVE" — not "the newest killmail this sync wrote". For a user who
 * has never synced the two coincide and the list stops at the first row of the
 * first page; that is why the first sync is published as a full sync in
 * `killmail-sync-cron.ts`.
 *
 * `killmail_filters` is chosen because the indexes we need live there: the
 * attacker arrays are GIN-indexed, the victim columns btree. Measured
 * (2026-09-23, 108,890 rows): 4.8 ms for a character, 4.7 ms for a
 * corporation — both a bitmap index scan.
 */
export async function lastStoredKillmailId(scope: {
  characterId?: number;
  corporationId?: number;
}): Promise<number | undefined> {
  const rows = scope.characterId
    ? await prismaWorker.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(killmail_id) AS max FROM killmail_filters
        WHERE attacker_character_ids @> ARRAY[${scope.characterId}]::int[]
           OR victim_character_id = ${scope.characterId}
      `
    : await prismaWorker.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(killmail_id) AS max FROM killmail_filters
        WHERE attacker_corporation_ids @> ARRAY[${scope.corporationId}]::int[]
           OR victim_corporation_id = ${scope.corporationId}
      `;

  const max = rows[0]?.max;
  // ::BIGINT comes back as a JavaScript BigInt and JSON.stringify throws on
  // those; every caller passes this straight into a query string or a message.
  return max == null ? undefined : Number(max);
}
