#!/usr/bin/env node
/**
 * Recomputes member_count and corporation_count on every alliance from the
 * corporations table, in one statement. This script is the only writer of
 * those two columns; the alliance snapshot reads corporations itself.
 * Mirrored by backend-rs/workers/update-alliance-counts, same SQL.
 *
 * Usage:
 *   yarn update:alliance-counts
 */

import prismaWorker from '@services/prisma-worker';

async function updateAllianceCounts() {
  console.log('🔄 updating alliance counts...');

  const startTime = new Date();

  try {
    // An alliance with no corporation gets 0; a corporation whose alliance is
    // not in the table is ignored. updated_at is left alone: it tracks the
    // ESI data, not this recount.
    const updated = await prismaWorker.$executeRaw`
      UPDATE alliances a
      SET member_count = COALESCE(s.members, 0),
          corporation_count = COALESCE(s.corps, 0)
      FROM alliances a2
      LEFT JOIN (
        SELECT alliance_id, COUNT(*)::int AS corps, SUM(member_count)::int AS members
        FROM corporations
        WHERE alliance_id IS NOT NULL
        GROUP BY alliance_id
      ) s ON s.alliance_id = a2.id
      WHERE a.id = a2.id
    `;

    const duration = ((Date.now() - startTime.getTime()) / 1000).toFixed(2);

    console.log(`✅ update completed!`);
    console.log(`   • total updated: ${updated}`);
    console.log(`   • duration: ${duration} seconds`);
  } catch (error) {
    console.error('❌ update error:', error);
    throw error;
  } finally {
    await prismaWorker.$disconnect();
  }
}

updateAllianceCounts()
  .then(() => {
    console.log('👋 script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 script error:', error);
    process.exit(1);
  });
