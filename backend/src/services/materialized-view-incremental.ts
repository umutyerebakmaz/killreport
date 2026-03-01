/**
 * Incremental Materialized View Refresh Service
 *
 * ⚡ NEW ARCHITECTURE (Real-time + Fallback):
 *
 * PRIMARY: Real-time updates (daily-aggregates-realtime.ts)
 * - Updates happen IN TRANSACTION as killmails are saved
 * - INSERT ... ON CONFLICT DO UPDATE for atomic increments
 * - Zero latency for leaderboard updates
 *
 * FALLBACK: This service (runs every 5 minutes)
 * - Detects and fixes any inconsistencies
 * - Recalculates last 6 hours of data
 * - Ensures data integrity in edge cases
 * - Full refresh once per day at 3 AM UTC
 *
 * Strategy:
 * 1. Tracks last processed killmail
 * 2. Only processes last 6 hours (consistency check)
 * 3. Uses DELETE + INSERT for affected days
 * 4. Reduces CPU from 99% spikes to ~5-10%
 *
 * Full refresh is still done once per day (at 3 AM UTC)
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';

interface RefreshLog {
    view_name: string;
    last_full_refresh_at: Date | null;
    last_incremental_refresh_at: Date | null;
    last_processed_killmail_id: number | null;
    last_processed_killmail_time: Date | null;
    total_records: bigint;
}

/**
 * Get refresh tracking info for a view
 */
async function getRefreshLog(viewName: string): Promise<RefreshLog | null> {
    const result = await prismaWorker.$queryRaw<RefreshLog[]>`
        SELECT * FROM refresh_log
        WHERE view_name = ${viewName}
    `;
    return result[0] || null;
}

/**
 * Update refresh log after processing
 */
async function updateRefreshLog(
    viewName: string,
    isFullRefresh: boolean,
    lastKillmailId: number | null,
    lastKillmailTime: Date | null,
    recordCount: bigint
): Promise<void> {
    if (isFullRefresh) {
        await prismaWorker.$executeRaw`
            UPDATE refresh_log
            SET last_full_refresh_at = NOW(),
                last_incremental_refresh_at = NOW(),
                last_processed_killmail_id = ${lastKillmailId},
                last_processed_killmail_time = ${lastKillmailTime},
                total_records = ${recordCount},
                updated_at = NOW()
            WHERE view_name = ${viewName}
        `;
    } else {
        await prismaWorker.$executeRaw`
            UPDATE refresh_log
            SET last_incremental_refresh_at = NOW(),
                last_processed_killmail_id = ${lastKillmailId},
                last_processed_killmail_time = ${lastKillmailTime},
                total_records = ${recordCount},
                updated_at = NOW()
            WHERE view_name = ${viewName}
        `;
    }
}

/**
 * Check if full refresh is needed (once per day at 3 AM UTC)
 */
function needsFullRefresh(lastFullRefresh: Date | null): boolean {
    if (!lastFullRefresh) return true;

    const now = new Date();
    const hoursSinceLastFull = (now.getTime() - lastFullRefresh.getTime()) / (1000 * 60 * 60);

    // If last full refresh was more than 20 hours ago AND it's between 3-4 AM UTC
    const currentHour = now.getUTCHours();
    const isRefreshWindow = currentHour === 3;

    return hoursSinceLastFull > 20 && isRefreshWindow;
}

/**
 * Incremental refresh for killmail_filters
 * Only processes killmails added since last refresh
 */
export async function incrementalRefreshKillmailFilters(): Promise<void> {
    const viewName = 'killmail_filters';
    const startTime = Date.now();

    try {
        logger.info(`🔄 Starting incremental refresh for ${viewName}...`);

        // Get tracking info
        const log = await getRefreshLog(viewName);
        const shouldDoFull = needsFullRefresh(log?.last_full_refresh_at || null);

        if (shouldDoFull) {
            logger.info('⚡ Full refresh needed (scheduled daily refresh)');
            await fullRefreshKillmailFilters();
            return;
        }

        // Get new killmails since last refresh
        const lastProcessedId = log?.last_processed_killmail_id || 0;

        // Check if there are any new killmails
        const newKillmailsCount = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM killmails
            WHERE killmail_id > ${lastProcessedId}
        `;

        const newCount = Number(newKillmailsCount[0].count);

        if (newCount === 0) {
            logger.info('✨ No new killmails to process, skipping refresh');
            return;
        }

        logger.info(`📊 Found ${newCount} new killmails to process`);

        // Set memory for better performance
        await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '256MB'`);

        // Insert new killmail data into table (using ON CONFLICT to handle duplicates)
        await prismaWorker.$executeRaw`
            INSERT INTO killmail_filters (
                killmail_id,
                killmail_time,
                solar_system_id,
                attacker_count,
                constellation_id,
                region_id,
                victim_ship_type_id,
                victim_character_id,
                victim_corporation_id,
                victim_alliance_id,
                attacker_ship_type_ids,
                attacker_character_ids,
                attacker_corporation_ids,
                attacker_alliance_ids
            )
            SELECT
                k.killmail_id,
                k.killmail_time,
                k.solar_system_id,
                k.attacker_count,
                ss.constellation_id,
                c.region_id,
                v.ship_type_id as victim_ship_type_id,
                v.character_id as victim_character_id,
                v.corporation_id as victim_corporation_id,
                v.alliance_id as victim_alliance_id,
                array_agg(DISTINCT a.ship_type_id) FILTER (WHERE a.ship_type_id IS NOT NULL) as attacker_ship_type_ids,
                array_agg(DISTINCT a.character_id) FILTER (WHERE a.character_id IS NOT NULL) as attacker_character_ids,
                array_agg(DISTINCT a.corporation_id) FILTER (WHERE a.corporation_id IS NOT NULL) as attacker_corporation_ids,
                array_agg(DISTINCT a.alliance_id) FILTER (WHERE a.alliance_id IS NOT NULL) as attacker_alliance_ids
            FROM killmails k
            INNER JOIN victims v ON k.killmail_id = v.killmail_id
            LEFT JOIN attackers a ON k.killmail_id = a.killmail_id
            LEFT JOIN solar_systems ss ON k.solar_system_id = ss.system_id
            LEFT JOIN constellations c ON ss.constellation_id = c.constellation_id
            WHERE k.killmail_id > ${lastProcessedId}
            GROUP BY
                k.killmail_id,
                k.killmail_time,
                k.solar_system_id,
                k.attacker_count,
                ss.constellation_id,
                c.region_id,
                v.ship_type_id,
                v.character_id,
                v.corporation_id,
                v.alliance_id
            ON CONFLICT (killmail_id) DO UPDATE SET
                killmail_time = EXCLUDED.killmail_time,
                solar_system_id = EXCLUDED.solar_system_id,
                attacker_count = EXCLUDED.attacker_count,
                constellation_id = EXCLUDED.constellation_id,
                region_id = EXCLUDED.region_id,
                victim_ship_type_id = EXCLUDED.victim_ship_type_id,
                victim_character_id = EXCLUDED.victim_character_id,
                victim_corporation_id = EXCLUDED.victim_corporation_id,
                victim_alliance_id = EXCLUDED.victim_alliance_id,
                attacker_ship_type_ids = EXCLUDED.attacker_ship_type_ids,
                attacker_character_ids = EXCLUDED.attacker_character_ids,
                attacker_corporation_ids = EXCLUDED.attacker_corporation_ids,
                attacker_alliance_ids = EXCLUDED.attacker_alliance_ids
        `;

        // Get the latest killmail info for tracking
        const latestKillmail = await prismaWorker.$queryRaw<Array<{ killmail_id: number; killmail_time: Date }>>`
            SELECT killmail_id, killmail_time
            FROM killmails
            ORDER BY killmail_id DESC
            LIMIT 1
        `;

        // Get total record count
        const totalRecords = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM killmail_filters
        `;

        // Update tracking log
        if (latestKillmail[0]) {
            await updateRefreshLog(
                viewName,
                false,
                latestKillmail[0].killmail_id,
                latestKillmail[0].killmail_time,
                totalRecords[0].count
            );
        }

        const duration = Date.now() - startTime;
        logger.info(`✅ Incremental refresh completed: ${newCount} new records processed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error in incremental refresh after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Full refresh for killmail_filters (used once per day)
 * Now using TRUNCATE + INSERT since it's a regular table (not materialized view)
 */
export async function fullRefreshKillmailFilters(): Promise<void> {
    const viewName = 'killmail_filters';
    const startTime = Date.now();

    try {
        logger.info(`🔄 Starting FULL refresh for ${viewName}...`);

        await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '256MB'`);

        // Truncate table (faster than DELETE)
        await prismaWorker.$executeRawUnsafe(`TRUNCATE TABLE ${viewName}`);

        // Re-insert all data
        await prismaWorker.$executeRaw`
      INSERT INTO killmail_filters (
        killmail_id,
        killmail_time,
        solar_system_id,
        attacker_count,
        constellation_id,
        region_id,
        victim_ship_type_id,
        victim_character_id,
        victim_corporation_id,
        victim_alliance_id,
        attacker_ship_type_ids,
        attacker_character_ids,
        attacker_corporation_ids,
        attacker_alliance_ids
      )
      SELECT
        k.killmail_id,
        k.killmail_time,
        k.solar_system_id,
        k.attacker_count,
        ss.constellation_id,
        c.region_id,
        v.ship_type_id as victim_ship_type_id,
        v.character_id as victim_character_id,
        v.corporation_id as victim_corporation_id,
        v.alliance_id as victim_alliance_id,
        array_agg(DISTINCT a.ship_type_id) FILTER (WHERE a.ship_type_id IS NOT NULL) as attacker_ship_type_ids,
        array_agg(DISTINCT a.character_id) FILTER (WHERE a.character_id IS NOT NULL) as attacker_character_ids,
        array_agg(DISTINCT a.corporation_id) FILTER (WHERE a.corporation_id IS NOT NULL) as attacker_corporation_ids,
        array_agg(DISTINCT a.alliance_id) FILTER (WHERE a.alliance_id IS NOT NULL) as attacker_alliance_ids
      FROM killmails k
      INNER JOIN victims v ON k.killmail_id = v.killmail_id
      LEFT JOIN attackers a ON k.killmail_id = a.killmail_id
      LEFT JOIN solar_systems ss ON k.solar_system_id = ss.system_id
      LEFT JOIN constellations c ON ss.constellation_id = c.constellation_id
      GROUP BY
        k.killmail_id,
        k.killmail_time,
        k.solar_system_id,
        k.attacker_count,
        ss.constellation_id,
        c.region_id,
        v.ship_type_id,
        v.character_id,
        v.corporation_id,
        v.alliance_id
    `;

        // Get the latest killmail info for tracking
        const latestKillmail = await prismaWorker.$queryRaw<Array<{ killmail_id: number; killmail_time: Date }>>`
            SELECT killmail_id, killmail_time
            FROM killmails
            ORDER BY killmail_id DESC
            LIMIT 1
        `;

        // Get total record count
        const totalRecords = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM killmail_filters
        `;

        // Update tracking log
        if (latestKillmail[0]) {
            await updateRefreshLog(
                viewName,
                true,
                latestKillmail[0].killmail_id,
                latestKillmail[0].killmail_time,
                totalRecords[0].count
            );
        }

        const duration = Date.now() - startTime;
        logger.info(`✅ Full refresh completed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error in full refresh after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Incremental refresh for character_kill_stats
 * Only refreshes last 6 hours of data (efficient for 5-minute refresh cycle)
 */
export async function incrementalRefreshCharacterKillStats(): Promise<void> {
    const viewName = 'character_kill_stats';
    const startTime = Date.now();

    try {
        logger.info(`🔄 Starting incremental refresh for ${viewName}...`);

        const log = await getRefreshLog(viewName);
        const shouldDoFull = needsFullRefresh(log?.last_full_refresh_at || null);

        if (shouldDoFull) {
            logger.info('⚡ Full refresh needed (scheduled daily refresh)');
            await fullRefreshCharacterKillStats();
            return;
        }

        // Only process last 6 hours to determine which day(s) need refresh
        const sixHoursAgo = new Date();
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

        // Find affected date (start of the day for the 6-hour window)
        // This ensures we refresh today and possibly yesterday if within 6 hours
        const affectedDateStart = new Date(sixHoursAgo);
        affectedDateStart.setUTCHours(0, 0, 0, 0);

        await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '128MB'`);

        // Delete affected days (today and possibly yesterday)
        await prismaWorker.$executeRaw`
            DELETE FROM character_kill_stats
            WHERE kill_date >= ${affectedDateStart}
        `;

        // Re-insert ENTIRE affected day(s) from their start (not just last 6 hours)
        // This ensures no data loss for the affected day
        await prismaWorker.$executeRaw`
            INSERT INTO character_kill_stats (kill_date, character_id, kill_count)
            SELECT
                DATE(k.killmail_time AT TIME ZONE 'UTC') as kill_date,
                a.character_id,
                COUNT(*)::int as kill_count
            FROM attackers a
            INNER JOIN killmails k ON a.killmail_id = k.killmail_id
            WHERE a.character_id IS NOT NULL
              AND k.killmail_time >= ${affectedDateStart}
            GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.character_id
            ON CONFLICT (kill_date, character_id) DO UPDATE SET
                kill_count = EXCLUDED.kill_count
        `;

        // Get total record count
        const totalRecords = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM character_kill_stats
        `;

        // Update tracking log
        await updateRefreshLog(viewName, false, null, new Date(), totalRecords[0].count);

        const duration = Date.now() - startTime;
        logger.info(`✅ Incremental refresh completed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error in incremental refresh after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Full refresh for character_kill_stats
 */
async function fullRefreshCharacterKillStats(): Promise<void> {
    const viewName = 'character_kill_stats';
    const startTime = Date.now();

    try {
        logger.info(`🔄 Starting FULL refresh for ${viewName}...`);

        await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '128MB'`);

        // Truncate table (faster than DELETE)
        await prismaWorker.$executeRawUnsafe(`TRUNCATE TABLE ${viewName}`);

        // Re-insert all data
        await prismaWorker.$executeRaw`
      INSERT INTO character_kill_stats (kill_date, character_id, kill_count)
      SELECT
        DATE(k.killmail_time AT TIME ZONE 'UTC') AS kill_date,
        a.character_id,
        COUNT(*)::int AS kill_count
      FROM attackers a
      INNER JOIN killmails k ON a.killmail_id = k.killmail_id
      WHERE a.character_id IS NOT NULL
      GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.character_id
    `;

        const totalRecords = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM character_kill_stats
        `;

        await updateRefreshLog(viewName, true, null, new Date(), totalRecords[0].count);

        const duration = Date.now() - startTime;
        logger.info(`✅ Full refresh completed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error in full refresh after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Incremental refresh for corporation_kill_stats
 * Only refreshes last 6 hours of data (efficient for 5-minute refresh cycle)
 */
export async function incrementalRefreshCorporationKillStats(): Promise<void> {
    const viewName = 'corporation_kill_stats';
    const startTime = Date.now();

    try {
        logger.info(`🔄 Starting incremental refresh for ${viewName}...`);

        const log = await getRefreshLog(viewName);
        const shouldDoFull = needsFullRefresh(log?.last_full_refresh_at || null);

        if (shouldDoFull) {
            logger.info('⚡ Full refresh needed (scheduled daily refresh)');
            await fullRefreshCorporationKillStats();
            return;
        }

        // Only process last 6 hours
        const sixHoursAgo = new Date();
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

        const affectedDateStart = new Date(sixHoursAgo);
        affectedDateStart.setUTCHours(0, 0, 0, 0);

        await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '128MB'`);

        // Delete affected days
        await prismaWorker.$executeRaw`
            DELETE FROM corporation_kill_stats
            WHERE kill_date >= ${affectedDateStart}
        `;

        // Re-insert affected day(s)
        await prismaWorker.$executeRaw`
            INSERT INTO corporation_kill_stats (kill_date, corporation_id, kill_count)
            SELECT
                DATE(k.killmail_time AT TIME ZONE 'UTC') as kill_date,
                a.corporation_id,
                COUNT(DISTINCT a.killmail_id)::int as kill_count
            FROM attackers a
            INNER JOIN killmails k ON a.killmail_id = k.killmail_id
            WHERE a.corporation_id IS NOT NULL
              AND k.killmail_time >= ${affectedDateStart}
            GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.corporation_id
            ON CONFLICT (kill_date, corporation_id) DO UPDATE SET
                kill_count = EXCLUDED.kill_count
        `;

        const totalRecords = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM corporation_kill_stats
        `;

        await updateRefreshLog(viewName, false, null, new Date(), totalRecords[0].count);

        const duration = Date.now() - startTime;
        logger.info(`✅ Incremental refresh completed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error in incremental refresh after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Full refresh for corporation_kill_stats
 */
async function fullRefreshCorporationKillStats(): Promise<void> {
    const viewName = 'corporation_kill_stats';
    const startTime = Date.now();

    try {
        logger.info(`🔄 Starting FULL refresh for ${viewName}...`);

        await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '128MB'`);

        await prismaWorker.$executeRawUnsafe(`TRUNCATE TABLE ${viewName}`);

        await prismaWorker.$executeRaw`
      INSERT INTO corporation_kill_stats (kill_date, corporation_id, kill_count)
      SELECT
        DATE(k.killmail_time AT TIME ZONE 'UTC') AS kill_date,
        a.corporation_id,
        COUNT(DISTINCT a.killmail_id)::int AS kill_count
      FROM attackers a
      INNER JOIN killmails k ON a.killmail_id = k.killmail_id
      WHERE a.corporation_id IS NOT NULL
      GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.corporation_id
    `;

        const totalRecords = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM corporation_kill_stats
        `;

        await updateRefreshLog(viewName, true, null, new Date(), totalRecords[0].count);

        const duration = Date.now() - startTime;
        logger.info(`✅ Full refresh completed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error in full refresh after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Incremental refresh for alliance_kill_stats
 * Only refreshes last 6 hours of data (efficient for 5-minute refresh cycle)
 */
export async function incrementalRefreshAllianceKillStats(): Promise<void> {
    const viewName = 'alliance_kill_stats';
    const startTime = Date.now();

    try {
        logger.info(`🔄 Starting incremental refresh for ${viewName}...`);

        const log = await getRefreshLog(viewName);
        const shouldDoFull = needsFullRefresh(log?.last_full_refresh_at || null);

        if (shouldDoFull) {
            logger.info('⚡ Full refresh needed (scheduled daily refresh)');
            await fullRefreshAllianceKillStats();
            return;
        }

        // Only process last 6 hours
        const sixHoursAgo = new Date();
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

        const affectedDateStart = new Date(sixHoursAgo);
        affectedDateStart.setUTCHours(0, 0, 0, 0);

        await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '128MB'`);

        // Delete affected days
        await prismaWorker.$executeRaw`
            DELETE FROM alliance_kill_stats
            WHERE kill_date >= ${affectedDateStart}
        `;

        // Re-insert affected day(s)
        await prismaWorker.$executeRaw`
            INSERT INTO alliance_kill_stats (kill_date, alliance_id, kill_count)
            SELECT
                DATE(k.killmail_time AT TIME ZONE 'UTC') as kill_date,
                a.alliance_id,
                COUNT(DISTINCT a.killmail_id)::int as kill_count
            FROM attackers a
            INNER JOIN killmails k ON a.killmail_id = k.killmail_id
            WHERE a.alliance_id IS NOT NULL
              AND k.killmail_time >= ${affectedDateStart}
            GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.alliance_id
            ON CONFLICT (kill_date, alliance_id) DO UPDATE SET
                kill_count = EXCLUDED.kill_count
        `;

        const totalRecords = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM alliance_kill_stats
        `;

        await updateRefreshLog(viewName, false, null, new Date(), totalRecords[0].count);

        const duration = Date.now() - startTime;
        logger.info(`✅ Incremental refresh completed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error in incremental refresh after ${duration}ms:`, error);
        throw error;
    }
}

/**
 * Full refresh for alliance_kill_stats
 */
async function fullRefreshAllianceKillStats(): Promise<void> {
    const viewName = 'alliance_kill_stats';
    const startTime = Date.now();

    try {
        logger.info(`🔄 Starting FULL refresh for ${viewName}...`);

        await prismaWorker.$executeRawUnsafe(`SET LOCAL maintenance_work_mem = '128MB'`);

        await prismaWorker.$executeRawUnsafe(`TRUNCATE TABLE ${viewName}`);

        await prismaWorker.$executeRaw`
      INSERT INTO alliance_kill_stats (kill_date, alliance_id, kill_count)
      SELECT
        DATE(k.killmail_time AT TIME ZONE 'UTC') AS kill_date,
        a.alliance_id,
        COUNT(DISTINCT a.killmail_id)::int AS kill_count
      FROM attackers a
      INNER JOIN killmails k ON a.killmail_id = k.killmail_id
      WHERE a.alliance_id IS NOT NULL
      GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.alliance_id
    `;

        const totalRecords = await prismaWorker.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM alliance_kill_stats
        `;

        await updateRefreshLog(viewName, true, null, new Date(), totalRecords[0].count);

        const duration = Date.now() - startTime;
        logger.info(`✅ Full refresh completed in ${duration}ms`);

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Error in full refresh after ${duration}ms:`, error);
        throw error;
    }
}

