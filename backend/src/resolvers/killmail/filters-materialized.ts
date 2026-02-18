import { KillmailFilter } from "@generated-types";
import prisma from '@services/prisma';

/**
 * Build WHERE clause using Materialized View
 *
 * Performance: O(1) for indexed columns, no JOINs needed
 * Uses pre-computed killmail_filters_mv table with optimized indexes
 *
 * Best for:
 * - Large result sets (>25k killmails)
 * - Complex entity filters (ship, character, corporation, alliance)
 * - High-traffic queries
 *
 * Returns: Array of killmail IDs matching the filters
 */
export async function filtersMaterialized(filter: KillmailFilter): Promise<number[]> {
  const conditions: string[] = ['1=1'];
  const params: any[] = [];
  let paramIndex = 1;

  const {
    shipTypeId,
    victim,
    attacker,
    regionId,
    systemId,
    characterId,
    corporationId,
    allianceId,
    minAttackers,
    maxAttackers
  } = filter;

  // Ship type filter: respects victim / attacker checkboxes
  if (shipTypeId !== undefined && shipTypeId !== null) {
    const onlyVictim = victim === true && !attacker;
    const onlyAttacker = attacker === true && !victim;

    params.push(shipTypeId);
    if (onlyVictim) {
      conditions.push(`victim_ship_type_id = $${paramIndex}`);
    } else if (onlyAttacker) {
      conditions.push(`$${paramIndex} = ANY(attacker_ship_type_ids)`);
    } else {
      // Both checked or neither checked → victim OR attacker (default)
      conditions.push(`(victim_ship_type_id = $${paramIndex} OR $${paramIndex} = ANY(attacker_ship_type_ids))`);
    }
    paramIndex++;
  }

  // Character filter (victim OR attacker)
  if (characterId !== undefined && characterId !== null) {
    params.push(characterId);
    conditions.push(`(victim_character_id = $${paramIndex} OR $${paramIndex} = ANY(attacker_character_ids))`);
    paramIndex++;
  }

  // Corporation filter (victim OR attacker)
  if (corporationId !== undefined && corporationId !== null) {
    params.push(corporationId);
    conditions.push(`(victim_corporation_id = $${paramIndex} OR $${paramIndex} = ANY(attacker_corporation_ids))`);
    paramIndex++;
  }

  // Alliance filter (victim OR attacker)
  if (allianceId !== undefined && allianceId !== null) {
    params.push(allianceId);
    conditions.push(`(victim_alliance_id = $${paramIndex} OR $${paramIndex} = ANY(attacker_alliance_ids))`);
    paramIndex++;
  }

  // Location filters
  if (regionId !== undefined && regionId !== null) {
    params.push(regionId);
    conditions.push(`region_id = $${paramIndex}`);
    paramIndex++;
  }

  if (systemId !== undefined && systemId !== null) {
    params.push(systemId);
    conditions.push(`solar_system_id = $${paramIndex}`);
    paramIndex++;
  }

  // Attacker count filters
  if (minAttackers !== undefined && minAttackers !== null) {
    params.push(minAttackers);
    conditions.push(`attacker_count >= $${paramIndex}`);
    paramIndex++;
  }

  if (maxAttackers !== undefined && maxAttackers !== null) {
    params.push(maxAttackers);
    conditions.push(`attacker_count <= $${paramIndex}`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const query = `
    SELECT killmail_id
    FROM killmail_filters_mv
    WHERE ${whereClause}
  `;

  console.log(`🔍 Materialized View Query:`, { query, params });

  try {
    const result = await prisma.$queryRawUnsafe<Array<{ killmail_id: number }>>(query, ...params);
    const killmailIds = result.map(r => r.killmail_id);

    console.log(`✅ Materialized View returned ${killmailIds.length} killmail IDs`);

    return killmailIds;
  } catch (error) {
    console.error('❌ Materialized View query error:', error);
    throw error;
  }
}

/**
 * Check if materialized view exists and is ready
 */
export async function isMaterializedViewReady(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM pg_matviews
        WHERE matviewname = 'killmail_filters_mv'
      ) as exists
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error('❌ Error checking materialized view:', error);
    return false;
  }
}
