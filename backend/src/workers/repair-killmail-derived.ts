import { updateDailyAggregatesRealtime } from '@services/kill-stats-realtime';
import { toAggregateInput, toFilterInput } from '@services/killmail-derived';
import { insertKillmailFilter } from '@services/killmail-filters-realtime';
import type { KillmailDetail } from '@services/killmail/killmail.service';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

/**
 * Repairs killmails that were saved without their derived writes (#245).
 *
 * `worker-esi-user-killmails` wrote `killmails`, `victims` and `attackers` but
 * never updated the daily leaderboard aggregates or `killmail_filters`. Those
 * killmails are counted nowhere and can never be counted later by the live
 * path, because every other writer skips them as duplicates.
 *
 * Usage:
 *   yarn repair:killmail-derived            # report only
 *   yarn repair:killmail-derived --apply    # write
 *
 * **The missing `killmail_filters` row is the marker.** A killmail is selected
 * precisely because it has none, and the repair writes that row in the same
 * transaction as the increment — so a repaired killmail is never selected
 * again and the counts cannot be inflated by a second run. That is also why
 * the filter row goes in first and is read back: `insertKillmailFilter` logs
 * and swallows its own failures, and a silent failure there would leave an
 * increment with no marker, which is the one way this script could double
 * count.
 *
 * Nothing is fetched from ESI. Everything needed is already in the database;
 * a killmail whose attacker rows are missing is reported and skipped, because
 * repairing it means re-fetching it, which is a different job.
 */

const BATCH_SIZE = 500;

interface KillmailRow {
  killmail_id: number;
  killmail_time: Date;
  solar_system_id: number | null;
}

interface VictimRow {
  character_id: number | null;
  corporation_id: number | null;
  alliance_id: number | null;
  ship_type_id: number | null;
}

interface AttackerRow {
  character_id: number | null;
  corporation_id: number | null;
  alliance_id: number | null;
  ship_type_id: number | null;
}

/**
 * Rebuild the ESI-shaped detail the live path had in hand, so the repair and
 * the workers share one mapping instead of two that can disagree.
 *
 * The fields the mappers do not read — damage, final blow, security status —
 * are filled with zeroes rather than queried: carrying them would imply this
 * reconstructs the killmail, and it does not. It reconstructs exactly what the
 * two derived writes need.
 */
export function detailFromRows(
  killmail: KillmailRow,
  victim: VictimRow,
  attackers: AttackerRow[],
): KillmailDetail {
  if (attackers.length === 0) {
    throw new Error(
      `killmail ${killmail.killmail_id} has no attacker rows; re-fetch it instead of repairing it`,
    );
  }

  return {
    killmail_id: killmail.killmail_id,
    killmail_time: killmail.killmail_time.toISOString(),
    solar_system_id: killmail.solar_system_id as number,
    victim: {
      character_id: victim.character_id ?? undefined,
      corporation_id: victim.corporation_id as number,
      alliance_id: victim.alliance_id ?? undefined,
      ship_type_id: victim.ship_type_id as number,
      damage_taken: 0,
    },
    attackers: attackers.map((a) => ({
      character_id: a.character_id ?? undefined,
      corporation_id: a.corporation_id ?? undefined,
      alliance_id: a.alliance_id ?? undefined,
      ship_type_id: a.ship_type_id ?? undefined,
      damage_done: 0,
      final_blow: false,
      security_status: 0,
    })),
  };
}

/** Killmails with no `killmail_filters` row, oldest first. */
async function findUnrepaired(limit: number) {
  return prismaWorker.$queryRaw<KillmailRow[]>`
    SELECT k.killmail_id, k.killmail_time, k.solar_system_id
    FROM killmails k
    LEFT JOIN killmail_filters f ON f.killmail_id = k.killmail_id
    WHERE f.killmail_id IS NULL
    ORDER BY k.killmail_time ASC
    LIMIT ${limit}
  `;
}

/** One killmail: filter row first, read back, then the increment. */
async function repairOne(killmail: KillmailRow): Promise<void> {
  const [victim] = await prismaWorker.$queryRaw<VictimRow[]>`
    SELECT character_id, corporation_id, alliance_id, ship_type_id
    FROM victims WHERE killmail_id = ${killmail.killmail_id}
  `;
  if (!victim) {
    throw new Error(
      `killmail ${killmail.killmail_id} has no victim row; re-fetch it instead of repairing it`,
    );
  }

  const attackers = await prismaWorker.$queryRaw<AttackerRow[]>`
    SELECT character_id, corporation_id, alliance_id, ship_type_id
    FROM attackers WHERE killmail_id = ${killmail.killmail_id}
  `;

  const detail = detailFromRows(killmail, victim, attackers);

  await prismaWorker.$transaction(async (tx) => {
    await insertKillmailFilter(toFilterInput(detail), tx);

    const written = await tx.$queryRaw<{ killmail_id: bigint }[]>`
      SELECT killmail_id FROM killmail_filters
      WHERE killmail_id = ${killmail.killmail_id}::bigint
    `;
    if (written.length === 0) {
      throw new Error(
        `killmail_filters row was not written for ${killmail.killmail_id}; rolling back so the aggregates are not incremented without a marker`,
      );
    }

    await updateDailyAggregatesRealtime(tx, toAggregateInput(detail));
  });
}

async function main() {
  const apply = process.argv.includes('--apply');

  const pending = await findUnrepaired(BATCH_SIZE);
  logger.info(
    `Killmails with no killmail_filters row: ${pending.length}${
      pending.length === BATCH_SIZE ? ` (batch limit, run again after)` : ''
    }`,
  );

  if (pending.length === 0) {
    await prismaWorker.$disconnect();
    return;
  }

  if (!apply) {
    for (const km of pending.slice(0, 5)) {
      logger.info(
        `  would repair ${km.killmail_id} (${km.killmail_time.toISOString()})`,
      );
    }
    logger.info('Report only. Re-run with --apply to write.');
    await prismaWorker.$disconnect();
    return;
  }

  let repaired = 0;
  let skipped = 0;

  for (const km of pending) {
    try {
      await repairOne(km);
      repaired++;
    } catch (error) {
      skipped++;
      logger.error(`  ! ${(error as Error).message}`);
    }
  }

  logger.info(`Repaired ${repaired}, skipped ${skipped}`);
  await prismaWorker.$disconnect();
}

if (require.main === module) {
  main().catch(async (error) => {
    logger.error('Repair failed', error);
    await prismaWorker.$disconnect();
    process.exit(1);
  });
}
