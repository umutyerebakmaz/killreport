#!/usr/bin/env node
/**
 * Corporation Snapshot Worker
 *
 * This worker should run daily (via cron job) and records the current
 * member_count values for all corporations as snapshots.
 *
 * Usage:
 *   yarn snapshot:corporations
 *
 * Cron example (every day at midnight):
 *   0 0 * * * cd /root/killreport/backend && yarn snapshot:corporations
 */

import prisma from '../services/prisma';

async function takeCorporationSnapshots() {
    console.log('📸 Corporation Snapshot Worker started...');

    const startTime = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    try {
        // Get all corporations
        const corporations = await prisma.corporation.findMany({
            select: { id: true, member_count: true },
        });

        console.log(`✓ Found ${corporations.length} corporations`);

        let processed = 0;
        let created = 0;
        let skipped = 0;

        for (const corporation of corporations) {
            // Check if snapshot for today already exists for this corporation
            const existingSnapshot = await prisma.corporationSnapshot.findFirst({
                where: {
                    corporation_id: corporation.id,
                    snapshot_date: today,
                },
            });

            if (existingSnapshot) {
                skipped++;
                processed++;
                continue;
            }

            // Create snapshot
            await prisma.corporationSnapshot.create({
                data: {
                    corporation_id: corporation.id,
                    member_count: corporation.member_count,
                    snapshot_date: today,
                },
            });

            created++;
            processed++;

            // Show progress every 100 corporations
            if (processed % 100 === 0) {
                console.log(`  ⏳ Processed: ${processed}/${corporations.length} (${created} new, ${skipped} existing)`);
            }
        }

        const endTime = new Date();
        const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);

        console.log(`✅ Snapshot creation completed!`);
        console.log(`   • Total processed: ${processed}`);
        console.log(`   • New snapshots: ${created}`);
        console.log(`   • Already existing: ${skipped}`);
        console.log(`   • Duration: ${duration} seconds`);
        console.log(`   • Date: ${today.toISOString().split('T')[0]}`);

    } catch (error) {
        console.error('❌ Snapshot creation error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Start worker
takeCorporationSnapshots()
    .then(() => {
        console.log('👋 Worker terminated');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Worker error:', error);
        process.exit(1);
    });
