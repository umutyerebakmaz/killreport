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
import { SovereigntyService } from '@services/sovereignty/sovereignty.service';

// Cap territory-change alerts per run so a large reshuffle can't flood clients.
const MAX_CHANGE_ALERTS = 25;

const CHUNK_SIZE = 100;

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
  return o.alliance_id !== null || o.corporation_id !== null || o.faction_id !== null;
}

function sameOwner(a: Owner, b: Owner): boolean {
  return a.alliance_id === b.alliance_id && a.corporation_id === b.corporation_id && a.faction_id === b.faction_id;
}

function changeType(prev: Owner | null, next: Owner | null): string {
  const prevA = prev?.alliance_id ?? null;
  const nextA = next?.alliance_id ?? null;
  if (prevA === null && nextA !== null) return 'captured';
  if (prevA !== null && nextA === null) return 'lost';
  if (prevA !== null && nextA !== null && prevA !== nextA) return 'transferred';
  return 'faction_change';
}

async function syncSovereigntyMap() {
  const startTime = Date.now();
  logger.info('🗺️  Starting sovereignty map sync...');

  try {
    const map = await SovereigntyService.getSovereigntyMap();
    logger.info(`📡 Received ${map.length} systems from ESI`);

    // Load current ownership state
    const existingRows = await prismaWorker.sovereigntyMapCurrent.findMany();
    const existing = new Map<number, Owner>(
      existingRows.map((r) => [r.solar_system_id, ownerOf(r)])
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

    // Persist territory changes
    if (changes.length > 0) {
      await prismaWorker.territoryChange.createMany({ data: changes });
      // Push live alerts (capped so a big reshuffle doesn't flood clients).
      for (const ch of changes.slice(0, MAX_CHANGE_ALERTS)) {
        pubsub.publish('SOVEREIGNTY_ALERT', {
          type: 'territory_change',
          systemId: ch.solar_system_id,
          previousOwnerId: ch.previous_owner_id,
          newOwnerId: ch.new_owner_id,
          changeType: ch.change_type,
        });
      }
    }

    // Upsert changed / new ownership rows
    for (let i = 0; i < toUpsert.length; i += CHUNK_SIZE) {
      const chunk = toUpsert.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(({ solar_system_id, owner }) =>
          prismaWorker.sovereigntyMapCurrent.upsert({
            where: { solar_system_id },
            create: { solar_system_id, ...owner },
            update: owner,
          })
        )
      );
    }

    // Remove systems that lost sovereignty
    if (toDelete.length > 0) {
      await prismaWorker.sovereigntyMapCurrent.deleteMany({
        where: { solar_system_id: { in: toDelete } },
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `✅ Map sync complete: ${fetchedOwned.size} owned systems, ` +
      `${toUpsert.length} updated, ${toDelete.length} lost, ` +
      `${changes.length} territory changes logged` +
      `${isInitialPopulation ? ' (initial baseline — changes not logged)' : ''} (${duration}s)`
    );
  } catch (error) {
    logger.error('❌ Sovereignty map sync failed', { error });
    throw error;
  }
}

syncSovereigntyMap()
  .then(async () => {
    await prismaWorker.$disconnect();
    process.exit(0);
  })
  .catch(async () => {
    await prismaWorker.$disconnect();
    process.exit(1);
  });
