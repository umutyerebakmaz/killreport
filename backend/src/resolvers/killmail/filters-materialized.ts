import { KillmailFilter } from "@generated-types";
import prisma from '@services/prisma';

/**
 * Build WHERE clause using Pre-computed Table
 *
 * Performance: O(1) for indexed columns, no JOINs needed
 * Uses pre-computed killmail_filters table with optimized indexes
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
    shipGroupIds,
    victim,
    attacker,
    regionId,
    systemId,
    characterId,
    characterVictim,
    characterAttacker,
    corporationId,
    allianceId,
    minAttackers,
    maxAttackers
  } = filter;

  console.log('🔍 Filter input:', { shipTypeId, shipGroupIds, victim, attacker });

  // Collect all ship type IDs (from direct shipTypeId or from shipGroupIds)
  let allShipTypeIds: number[] = [];

  // Add direct shipTypeId if provided
  if (shipTypeId !== undefined && shipTypeId !== null) {
    allShipTypeIds.push(shipTypeId);
  }

  // Add ship types from groups if shipGroupIds provided
  if (shipGroupIds !== undefined && shipGroupIds !== null && shipGroupIds.length > 0) {
    console.log('🔍 Fetching types for groups:', shipGroupIds);
    const typesInGroups = await prisma.type.findMany({
      where: {
        group_id: { in: shipGroupIds }
      },
      select: { id: true }
    });
    console.log('🔍 Found types:', typesInGroups.length, 'IDs:', typesInGroups.map(t => t.id).slice(0, 10));
    allShipTypeIds = allShipTypeIds.concat(typesInGroups.map(t => t.id));
  }

  console.log('🔍 All ship type IDs to filter:', allShipTypeIds.length, 'IDs:', allShipTypeIds.slice(0, 10));

  // Ship type filter: respects victim / attacker checkboxes
  if (allShipTypeIds.length > 0) {
    const onlyVictim = victim === true && !attacker;
    const onlyAttacker = attacker === true && !victim;

    params.push(allShipTypeIds);
    if (onlyVictim) {
      conditions.push(`victim_ship_type_id = ANY($${paramIndex}::int[])`);
    } else if (onlyAttacker) {
      conditions.push(`attacker_ship_type_ids && $${paramIndex}::int[]`);
    } else {
      // Both checked or neither checked → victim OR attacker (default)
      conditions.push(`(victim_ship_type_id = ANY($${paramIndex}::int[]) OR attacker_ship_type_ids && $${paramIndex}::int[])`);
    }
    paramIndex++;
  }

  // Character filter: respects characterVictim / characterAttacker checkboxes
  if (characterId !== undefined && characterId !== null) {
    const onlyCharVictim = characterVictim === true && !characterAttacker;
    const onlyCharAttacker = characterAttacker === true && !characterVictim;

    params.push(characterId);
    if (onlyCharVictim) {
      conditions.push(`victim_character_id = $${paramIndex}`);
    } else if (onlyCharAttacker) {
      conditions.push(`$${paramIndex} = ANY(attacker_character_ids)`);
    } else {
      // Both or neither → victim OR attacker (default)
      conditions.push(`(victim_character_id = $${paramIndex} OR $${paramIndex} = ANY(attacker_character_ids))`);
    }
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
    FROM killmail_filters
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
        WHERE tablename = 'killmail_filters'
      ) as exists
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error('❌ Error checking materialized view:', error);
    return false;
  }
}
