/**
 * The two decisions behind an hourly system activity snapshot.
 *
 * `worker-system-activity.ts` calls ESI twice — `/universe/system_kills` and
 * `/universe/system_jumps` — and writes one row per system per hour. Both
 * endpoints publish on the same hourly cadence, so the pair really is one
 * snapshot of the same instant; what is left to decide is where that instant
 * is rounded to and what a system missing from one of the two lists means.
 *
 * Those two decisions live here, as pure functions with a spec, because the
 * worker itself needs ESI and Postgres to run and no worker in this repo has
 * a test.
 */

export interface EsiSystemKills {
  system_id: number;
  npc_kills: number;
  pod_kills: number;
  ship_kills: number;
}

export interface EsiSystemJumps {
  system_id: number;
  ship_jumps: number;
}

export interface SystemActivityRow {
  system_id: number;
  npc_kills: number;
  pod_kills: number;
  ship_kills: number;
  /** Null means ESI did not report the system, not that nobody jumped. */
  ship_jumps: number | null;
  timestamp: Date;
}

/**
 * The snapshot's own hour. Every row of one run shares it, which is what makes
 * `(system_id, timestamp)` a usable unique key and lets `skipDuplicates` absorb
 * a re-run of the same hour.
 */
export function hourSnapshotTime(now: Date): Date {
  const at = new Date(now);
  at.setUTCMinutes(0, 0, 0);
  return at;
}

/**
 * The two ESI lists into one row per system.
 *
 * The lists do not cover the same systems: one holds the systems with kills in
 * the hour, the other the systems with jumps, and either may omit a system the
 * other reports. The asymmetry in what a gap means is deliberate:
 *
 * - A missing kill count becomes 0. The three kills columns are NOT NULL with
 *   a zero default and have been filled that way since the table existed, so
 *   zero is already what "ESI did not list it" means there.
 * - A missing jump count becomes null. `ship_jumps` is nullable precisely so
 *   the rows written before the column existed do not claim their hours had no
 *   traffic, and a run whose jumps request failed must not claim it either.
 *   A chart skips a null; it would plot a zero.
 */
export function mergeSystemActivity(
  kills: EsiSystemKills[],
  jumps: EsiSystemJumps[],
  timestamp: Date,
): SystemActivityRow[] {
  const rows = new Map<number, SystemActivityRow>();

  for (const kill of kills) {
    rows.set(kill.system_id, {
      system_id: kill.system_id,
      npc_kills: kill.npc_kills,
      pod_kills: kill.pod_kills,
      ship_kills: kill.ship_kills,
      ship_jumps: null,
      timestamp,
    });
  }

  for (const jump of jumps) {
    const row = rows.get(jump.system_id);
    if (row) {
      row.ship_jumps = jump.ship_jumps;
      continue;
    }
    rows.set(jump.system_id, {
      system_id: jump.system_id,
      npc_kills: 0,
      pod_kills: 0,
      ship_kills: 0,
      ship_jumps: jump.ship_jumps,
      timestamp,
    });
  }

  return [...rows.values()];
}
