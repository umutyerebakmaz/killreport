/**
 * Real-time Killmail Filters Update Service
 *
 * Inserts into killmail_filters table when a new killmail is saved.
 * This pre-computes attacker arrays for fast GIN index lookups.
 *
 * Strategy:
 * - Called after each killmail is saved (within or after the transaction)
 * - Single INSERT with aggregated attacker arrays
 * - Uses ON CONFLICT DO NOTHING for idempotency
 *
 * Performance:
 * - O(1) per killmail
 * - No table scans, just array aggregation
 * - Typical overhead: <5ms per killmail
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

interface KillmailFilterData {
    killmail_id: bigint;
    killmail_time: Date;
    solar_system_id: number | null;
    constellation_id?: number | null;
    region_id?: number | null;
    attacker_count: number;
    victim_ship_type_id: number | null;
    victim_character_id: number | null;
    victim_corporation_id: number | null;
    victim_alliance_id: number | null;
    attacker_ship_type_ids: (number | null)[];
    attacker_character_ids: (number | null)[];
    attacker_corporation_ids: (number | null)[];
    attacker_alliance_ids: (number | null)[];
}

/**
 * Insert into killmail_filters for fast top-targets lookups
 */
export async function insertKillmailFilter(data: KillmailFilterData): Promise<void> {
    try {
        // Remove nulls and get unique IDs for arrays
        const shipIds = [...new Set(data.attacker_ship_type_ids.filter((id): id is number => id !== null))];
        const charIds = [...new Set(data.attacker_character_ids.filter((id): id is number => id !== null))];
        const corpIds = [...new Set(data.attacker_corporation_ids.filter((id): id is number => id !== null))];
        const allianceIds = [...new Set(data.attacker_alliance_ids.filter((id): id is number => id !== null))];

        await prismaWorker.$executeRaw`
      WITH data_row AS (
        SELECT
          ${data.killmail_id}::bigint as killmail_id,
          ${data.killmail_time}::timestamp as killmail_time,
          ${data.solar_system_id}::int as solar_system_id,
          ${data.constellation_id || null}::int as constellation_id,
          ${data.region_id || null}::int as region_id,
          ${data.attacker_count}::int as attacker_count,
          ${data.victim_ship_type_id}::int as victim_ship_type_id,
          ${data.victim_character_id}::int as victim_character_id,
          ${data.victim_corporation_id}::int as victim_corporation_id,
          ${data.victim_alliance_id}::int as victim_alliance_id,
          ${shipIds}::int[] as attacker_ship_type_ids,
          ${charIds}::int[] as attacker_character_ids,
          ${corpIds}::int[] as attacker_corporation_ids,
          ${allianceIds}::int[] as attacker_alliance_ids
      )
      INSERT INTO killmail_filters (
        killmail_id,
        killmail_time,
        solar_system_id,
        constellation_id,
        region_id,
        attacker_count,
        victim_ship_type_id,
        victim_character_id,
        victim_corporation_id,
        victim_alliance_id,
        attacker_ship_type_ids,
        attacker_character_ids,
        attacker_corporation_ids,
        attacker_alliance_ids,
        security_status,
        security_class
      )
      SELECT
        d.killmail_id,
        d.killmail_time,
        d.solar_system_id,
        d.constellation_id,
        d.region_id,
        d.attacker_count,
        d.victim_ship_type_id,
        d.victim_character_id,
        d.victim_corporation_id,
        d.victim_alliance_id,
        d.attacker_ship_type_ids,
        d.attacker_character_ids,
        d.attacker_corporation_ids,
        d.attacker_alliance_ids,
        ss.security_status,
        ss.security_class
      FROM data_row d
      LEFT JOIN solar_systems ss ON ss.system_id = d.solar_system_id
      ON CONFLICT (killmail_id) DO NOTHING
    `;

        logger.debug(`✅ Inserted killmail_filters for killmail ${data.killmail_id}`);
    } catch (error) {
        // Log error but don't fail
        logger.error(`❌ Error inserting killmail_filters for ${data.killmail_id}:`, error);
    }
}
