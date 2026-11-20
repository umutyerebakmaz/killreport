#!/usr/bin/env node
/**
 * Sovereignty Map Worker
 *
 * Polls ESI `/sovereignty/map` and keeps `sovereignty_map_current` in sync with
 * who owns which system. It diffs the freshly fetched ownership against the
 * stored state and writes a `territory_changes` row for every system that
 * changed hands (captured / lost / transferred / faction_change) — the raw
 * material for territory-history analytics.
 *
 * On the very first run (empty current map) it bulk-populates the baseline
 * without logging changes, so history starts from a clean baseline.
 *
 * Usage:
 *   yarn worker:sov:map
 *
 * PM2 Cron:
 *   Runs every 30 minutes via ecosystem.config.js
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { pubsub } from '@services/pubsub';
import { buildSovereigntyAlert } from '@services/sovereignty/alert-builder';
import { SovereigntyService } from '@services/sovereignty/sovereignty.service';

// Cap territory-change alerts per run so a large reshuffle can't flood clients.
const MAX_CHANGE_ALERTS = 25;

type Owner = {
  alliance_id: number | null;
  corporation_id: number | null;
  faction_id: number | null;
};

function ownerOf(x: {
  alliance_id?: number | null;
  corporation_id?: number | null;
  faction_id?: number | null;
}): Owner {
  return {
    alliance_id: x.alliance_id ?? null,
    corporation_id: x.corporation_id ?? null,
    faction_id: x.faction_id ?? null,
  };
}

function isOwned(o: Owner): boolean {
  return (
    o.alliance_id !== null || o.corporation_id !== null || o.faction_id !== null
  );
}

function sameOwner(a: Owner, b: Owner): boolean {
  return (
    a.alliance_id === b.alliance_id &&
    a.corporation_id === b.corporation_id &&
    a.faction_id === b.faction_id
  );
}

function changeType(prev: Owner | null, next: Owner | null): string {
  const prevA = prev?.alliance_id ?? null;
  const nextA = next?.alliance_id ?? null;
  if (prevA === null && nextA !== null) return 'captured';
  if (prevA !== null && nextA === null) return 'lost';
  if (prevA !== null && nextA !== null && prevA !== nextA) return 'transferred';
  return 'faction_change';
}

export async function syncSovereigntyMap() {
  const startTime = Date.now();
  logger.info('🗺️  starting sovereignty map sync...');

  try {
    const map = await SovereigntyService.getSovereigntyMap();
    logger.info(`📡 received ${map.length} systems from ESI`);

    // ESI never reports an unclaimed New Eden for real. Acting on it would
    // log a permanent `lost` row for every system and empty the table, so the
    // next run would mistake itself for a first run.
    if (!map.some((entry) => isOwned(ownerOf(entry)))) {
      logger.warn('⚠️  ESI returned no owned systems — skipping this run');
      return;
    }

    // Load current ownership state
    const existingRows = await prismaWorker.sovereigntyMapCurrent.findMany();
    const existing = new Map<number, Owner>(
      existingRows.map((r) => [r.solar_system_id, ownerOf(r)]),
    );
    const isInitialPopulation = existing.size === 0;

    // Build fetched owned-systems map
    const fetchedOwned = new Map<number, Owner>();
    for (const entry of map) {
      const owner = ownerOf(entry);
      if (isOwned(owner)) fetchedOwned.set(entry.system_id, owner);
    }

    const changes: {
      solar_system_id: number;
      previous_owner_id: number | null;
      new_owner_id: number | null;
      previous_faction_id: number | null;
      new_faction_id: number | null;
      change_type: string;
    }[] = [];
    const toUpsert: { solar_system_id: number; owner: Owner }[] = [];

    // Detect new & changed ownership
    for (const [systemId, owner] of fetchedOwned) {
      const prev = existing.get(systemId) ?? null;
      if (prev && sameOwner(prev, owner)) continue; // unchanged
      toUpsert.push({ solar_system_id: systemId, owner });
      if (!isInitialPopulation) {
        changes.push({
          solar_system_id: systemId,
          previous_owner_id: prev?.alliance_id ?? null,
          new_owner_id: owner.alliance_id,
          previous_faction_id: prev?.faction_id ?? null,
          new_faction_id: owner.faction_id,
          change_type: changeType(prev, owner),
        });
      }
    }

    // Detect systems that lost sovereignty entirely (present before, unowned/absent now)
    const toDelete: number[] = [];
    for (const [systemId, prev] of existing) {
      if (!fetchedOwned.has(systemId)) {
        toDelete.push(systemId);
        changes.push({
          solar_system_id: systemId,
          previous_owner_id: prev.alliance_id,
          new_owner_id: null,
          previous_faction_id: prev.faction_id,
          new_faction_id: null,
          change_type: 'lost',
        });
      }
    }

    // The change log, the upserts and the deletes commit together, so a
    // failure cannot leave a change logged against a map that never moved.
    // The upsert is one statement: row-by-row upserts inside an interactive
    // transaction run one after another and a first population would outlast
    // its timeout. `last_updated` is bound in UTC (EVE time), not left to the
    // session time zone.
    const stamp = new Date().toISOString();
    await prismaWorker.$transaction(async (tx) => {
      if (changes.length > 0) {
        await tx.territoryChange.createMany({ data: changes });
      }
      if (toUpsert.length > 0) {
        const ids = toUpsert.map((u) => u.solar_system_id);
        const alliances = toUpsert.map((u) => u.owner.alliance_id);
        const corporations = toUpsert.map((u) => u.owner.corporation_id);
        const factions = toUpsert.map((u) => u.owner.faction_id);
        await tx.$executeRaw`
          INSERT INTO sovereignty_map_current
            (solar_system_id, alliance_id, corporation_id, faction_id, last_updated)
          SELECT u.*, ${stamp}::timestamp(3)
          FROM unnest(${ids}::int[], ${alliances}::int[], ${corporations}::int[], ${factions}::int[]) AS u
          ON CONFLICT (solar_system_id) DO UPDATE SET
            alliance_id = EXCLUDED.alliance_id,
            corporation_id = EXCLUDED.corporation_id,
            faction_id = EXCLUDED.faction_id,
            last_updated = EXCLUDED.last_updated
        `;
      }
      if (toDelete.length > 0) {
        await tx.sovereigntyMapCurrent.deleteMany({
          where: { solar_system_id: { in: toDelete } },
        });
      }
    });

    // Live alerts only after the commit, capped so a big reshuffle doesn't
    // flood clients.
    for (const ch of changes.slice(0, MAX_CHANGE_ALERTS)) {
      const alert = await buildSovereigntyAlert(prismaWorker, {
        type: 'territory_change',
        systemId: ch.solar_system_id,
        previousOwnerId: ch.previous_owner_id,
        newOwnerId: ch.new_owner_id,
        changeType: ch.change_type,
      });
      pubsub.publish('SOVEREIGNTY_ALERT', alert);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ map sync complete: ${fetchedOwned.size} owned systems, ` +
        `${toUpsert.length} updated, ${toDelete.length} lost, ` +
        `${changes.length} territory changes logged` +
        `${isInitialPopulation ? ' (initial baseline — changes not logged)' : ''} (${duration}s)`,
    );
  } catch (error) {
    logger.error('❌ sovereignty map sync failed', { error });
    throw error;
  }
}

// Run only when executed directly, so the spec can import the sync
if (require.main === module) {
  syncSovereigntyMap()
    .then(async () => {
      await prismaWorker.$disconnect();
      process.exit(0);
    })
    .catch(async () => {
      await prismaWorker.$disconnect();
      process.exit(1);
    });
}
