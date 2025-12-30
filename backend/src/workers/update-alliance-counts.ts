#!/usr/bin/env node
/**
 * One-time script to populate member_count and corporation_count for all alliances
 *
 * Usage:
 *   npx tsx update-alliance-counts.ts
 */

import prismaWorker from '../services/prisma-worker';

async function updateAllianceCounts() {
  console.log('🔄 Updating alliance counts...');

  const startTime = new Date();

  try {
    const alliances = await prismaWorker.alliance.findMany({
      select: { id: true, name: true },
    });

    console.log(`✓ Found ${alliances.length} alliances`);

    let processed = 0;

    for (const alliance of alliances) {
      // Count corporations
      const corporationCount = await prismaWorker.corporation.count({
        where: { alliance_id: alliance.id },
      });

      // Sum member counts
      const memberResult = await prismaWorker.corporation.aggregate({
        where: { alliance_id: alliance.id },
        _sum: {
          member_count: true,
        },
      });

      const memberCount = memberResult._sum.member_count || 0;

      // Update alliance
      await prismaWorker.alliance.update({
        where: { id: alliance.id },
        data: {
          member_count: memberCount,
          corporation_count: corporationCount,
        },
      });

      processed++;

      if (processed % 50 === 0) {
        console.log(`  ⏳ Processed: ${processed}/${alliances.length}`);
      }
    }

    const endTime = new Date();
    const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);

    console.log(`✅ Update completed!`);
    console.log(`   • Total updated: ${processed}`);
    console.log(`   • Duration: ${duration} seconds`);

  } catch (error) {
    console.error('❌ Update error:', error);
    throw error;
  } finally {
    await prismaWorker.$disconnect();
  }
}

updateAllianceCounts()
  .then(() => {
    console.log('👋 Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script error:', error);
    process.exit(1);
  });
