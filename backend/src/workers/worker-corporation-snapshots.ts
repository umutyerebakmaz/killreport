#!/usr/bin/env node
/**
 * Corporation Snapshot Worker
 *
 * This worker should run daily (via cron job) and records the current
 * member_count values for all corporations as snapshots.
 *
 * Usage:
 *   yarn snapshot:corporations
 */

import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';

async function takeCorporationSnapshots() {
    logger.info('📸 Corporation Snapshot Worker started...');

    const startTime = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    try {
        // Get all corporations with member counts
        const corporations = await prismaWorker.corporation.findMany({
            select: { id: true, member_count: true },
        });

        logger.info(`✓ Found ${corporations.length} corporations`);

        // Check which corporations already have snapshots for today (single query)
        const existingSnapshots = await prismaWorker.corporationSnapshot.findMany({
            where: { snapshot_date: today },
            select: { corporation_id: true },
        });

        const existingCorporationIds = new Set(existingSnapshots.map((s) => s.corporation_id));
        logger.info(`✓ Found ${existingCorporationIds.size} existing snapshots for today`);

        // Filter corporations that need snapshots
        const corporationsToSnapshot = corporations.filter((c) => !existingCorporationIds.has(c.id));

        if (corporationsToSnapshot.length === 0) {
            logger.info('✅ All corporations already have snapshots for today!');
            const duration = ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(2);
            logger.info(`   • Duration: ${duration} seconds`);
            logger.info(`   • Date: ${today.toISOString().split('T')[0]}`);
            return;
        }

        logger.info(`📝 Creating ${corporationsToSnapshot.length} new snapshots...`);

        // Prepare snapshot data
        const snapshotsData = corporationsToSnapshot.map((corp) => ({
            corporation_id: corp.id,
            member_count: corp.member_count,
            snapshot_date: today,
        }));

        // Batch create snapshots in chunks of 1000
        const BATCH_SIZE = 1000;
        let created = 0;

        for (let i = 0; i < snapshotsData.length; i += BATCH_SIZE) {
            const batch = snapshotsData.slice(i, i + BATCH_SIZE);

            await prismaWorker.corporationSnapshot.createMany({
                data: batch,
                skipDuplicates: true,
            });

            created += batch.length;

            const progress = Math.round((created / snapshotsData.length) * 100);
            logger.info(`  ⏳ Progress: ${created}/${snapshotsData.length} (${progress}%)`);
        }

        const endTime = new Date();
        const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);

        logger.info(`✅ Snapshot creation completed!`);
        logger.info(`   • Total corporations: ${corporations.length}`);
        logger.info(`   • New snapshots: ${created}`);
        logger.info(`   • Already existing: ${existingCorporationIds.size}`);
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
takeCorporationSnapshots()
    .then(() => {
        logger.info('👋 Worker terminated');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('💥 Worker error:', error);
        process.exit(1);
    });
