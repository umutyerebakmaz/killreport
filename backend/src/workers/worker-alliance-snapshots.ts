#!/usr/bin/env node
/**
 * Alliance Snapshot Worker
 *
 * This worker should run daily (via cron job) and records the current
 * member_count and corporation_count values for all alliances as snapshots.
 *
 * Usage:
 *   yarn snapshot:alliances
 *
 * Scheduled: Daily at 01:00 UTC (cron: '0 1 * * *')
 */

import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { guardCronJob } from '../utils/cron-guard';

// Prevent running on PM2 restart - only run daily at 01:00 UTC
guardCronJob('snapshot-alliances', { hour: 1, minute: 0 });

async function takeAllianceSnapshots() {
    logger.info('📸 Alliance Snapshot Worker started...');

    const startTime = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    try {
        // Get all alliances
        const alliances = await prismaWorker.alliance.findMany({
            select: { id: true },
        });

        logger.info(`✓ Found ${alliances.length} alliances`);

        // Check which alliances already have snapshots for today (single query)
        const existingSnapshots = await prismaWorker.allianceSnapshot.findMany({
            where: { snapshot_date: today },
            select: { alliance_id: true },
        });

        const existingAllianceIds = new Set(existingSnapshots.map((s) => s.alliance_id));
        logger.info(`✓ Found ${existingAllianceIds.size} existing snapshots for today`);

        // Filter alliances that need snapshots
        const allianceIds = alliances
            .filter((a) => !existingAllianceIds.has(a.id))
            .map((a) => a.id);

        if (allianceIds.length === 0) {
            logger.info('✅ All alliances already have snapshots for today!');
            const duration = ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(2);
            logger.info(`   • Duration: ${duration} seconds`);
            logger.info(`   • Date: ${today.toISOString().split('T')[0]}`);
            return;
        }

        logger.info(`📝 Calculating stats for ${allianceIds.length} alliances...`);

        // Fetch all corporations for these alliances in ONE query
        const corporations = await prismaWorker.corporation.findMany({
            where: { alliance_id: { in: allianceIds } },
            select: {
                alliance_id: true,
                member_count: true,
            },
        });

        logger.info(`✓ Found ${corporations.length} corporations across ${allianceIds.length} alliances`);

        // Group corporations by alliance_id and calculate stats in JavaScript
        const allianceStats = new Map<number, { corporationCount: number; memberCount: number }>();

        // Initialize all alliances with 0 values (for alliances with no corporations)
        allianceIds.forEach((id) => {
            allianceStats.set(id, { corporationCount: 0, memberCount: 0 });
        });

        // Aggregate corporation data
        corporations.forEach((corp) => {
            if (corp.alliance_id) {
                const stats = allianceStats.get(corp.alliance_id);
                if (stats) {
                    stats.corporationCount++;
                    stats.memberCount += corp.member_count;
                }
            }
        });

        // Prepare snapshot data
        const snapshotsData = Array.from(allianceStats.entries()).map(([allianceId, stats]) => ({
            alliance_id: allianceId,
            member_count: stats.memberCount,
            corporation_count: stats.corporationCount,
            snapshot_date: today,
        }));

        logger.info(`📊 Stats calculated, creating ${snapshotsData.length} snapshots...`);

        // Batch create snapshots in chunks of 500
        const BATCH_SIZE = 500;
        let created = 0;

        for (let i = 0; i < snapshotsData.length; i += BATCH_SIZE) {
            const batch = snapshotsData.slice(i, i + BATCH_SIZE);

            await prismaWorker.allianceSnapshot.createMany({
                data: batch,
                skipDuplicates: true,
            });

            created += batch.length;

            const progress = Math.round((created / snapshotsData.length) * 100);
            logger.info(`  ⏳ Progress: ${created}/${snapshotsData.length} (${progress}%)`);
        }

        // Also update alliance table with current counts (batch update in chunks)
        logger.info('🔄 Updating alliance records with current stats...');

        const updatePromises: Promise<any>[] = [];
        for (const [allianceId, stats] of allianceStats.entries()) {
            updatePromises.push(
                prismaWorker.alliance.update({
                    where: { id: allianceId },
                    data: {
                        member_count: stats.memberCount,
                        corporation_count: stats.corporationCount,
                    },
                })
            );

            // Process updates in batches of 100 to avoid overwhelming the connection pool
            if (updatePromises.length >= 100) {
                await Promise.all(updatePromises);
                updatePromises.length = 0;
            }
        }

        // Process remaining updates
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
        }

        const endTime = new Date();
        const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);

        logger.info(`✅ Snapshot creation completed!`);
        logger.info(`   • Total alliances: ${alliances.length}`);
        logger.info(`   • New snapshots: ${created}`);
        logger.info(`   • Already existing: ${existingAllianceIds.size}`);
        logger.info(`   • Total corporations: ${corporations.length}`);
        logger.info(`   • Alliance records updated: ${allianceStats.size}`);
        logger.info(`   • Duration: ${duration} seconds`);
        logger.info(`   • Date: ${today.toISOString().split('T')[0]}`);
    } catch (error) {
        logger.error('❌ Snapshot creation error:', error);
        throw error;
    } finally {
        await prismaWorker.$disconnect();
    }
}

// Start worker
takeAllianceSnapshots()
    .then(() => {
        logger.info('👋 Worker terminated');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('💥 Worker error:', error);
        process.exit(1);
    });
