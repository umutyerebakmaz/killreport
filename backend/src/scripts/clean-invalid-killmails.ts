/**
 * Clean Invalid Killmails Script
 *
 * Removes killmails that have no attackers in the database.
 * Every valid killmail MUST have at least 1 attacker.
 *
 * Usage: npx tsx src/scripts/clean-invalid-killmails.ts
 */

import prisma from '@services/prisma.js';

async function cleanInvalidKillmails() {
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 invalid killmail cleanup script');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // STEP 1: Count total killmails
    console.log('📊 step 1: counting total killmails in database...');
    const totalCount = await prisma.killmail.count();
    console.log(`✅ found ${totalCount.toLocaleString()} killmails\n`);

    // STEP 2: Fetch all killmail IDs
    console.log('📦 step 2: fetching killmail IDs...');
    const allKillmails = await prisma.killmail.findMany({
      select: { killmail_id: true },
      orderBy: { killmail_id: 'asc' },
    });
    console.log(
      `✅ loaded ${allKillmails.length.toLocaleString()} killmail IDs into memory\n`,
    );

    // STEP 3: Check each killmail for attackers
    console.log('🔍 step 3: checking killmails for attackers...');
    console.log('─────────────────────────────────────────────────────\n');

    const invalidKillmails: number[] = [];
    let validCount = 0;
    let checkedCount = 0;
    const totalToCheck = allKillmails.length;

    for (const km of allKillmails) {
      checkedCount++;

      // Show progress every 100 killmails
      if (checkedCount % 100 === 0) {
        const percentage = ((checkedCount / totalToCheck) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = ((checkedCount / (Date.now() - startTime)) * 1000).toFixed(
          1,
        );
        const eta = (
          (totalToCheck - checkedCount) /
          parseFloat(rate) /
          60
        ).toFixed(1);

        console.log(
          `📈 progress: ${checkedCount.toLocaleString()}/${totalToCheck.toLocaleString()} (${percentage}%) | valid: ${validCount} | invalid: ${invalidKillmails.length} | time: ${elapsed}s | ETA: ${eta}min`,
        );
      }

      const attackerCount = await prisma.attacker.count({
        where: { killmail_id: km.killmail_id },
      });

      if (attackerCount === 0) {
        invalidKillmails.push(km.killmail_id);
        console.log(
          `  ❌ invalid: killmail ${km.killmail_id} has no attackers`,
        );
      } else {
        validCount++;
      }
    }

    console.log('\n─────────────────────────────────────────────────────');
    console.log(
      `✅ scan complete: checked ${checkedCount.toLocaleString()} killmails`,
    );
    console.log(`   ✓ valid: ${validCount.toLocaleString()}`);
    console.log(`   ✗ invalid: ${invalidKillmails.length.toLocaleString()}\n`);

    if (invalidKillmails.length === 0) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ database is clean - no invalid killmails found!');
      console.log('═══════════════════════════════════════════════════════\n');
      return;
    }

    // STEP 4: Show invalid killmails summary
    console.log('⚠️  step 4: invalid killmails found');
    console.log('─────────────────────────────────────────────────────');
    console.log(
      `📝 invalid killmail IDs: ${invalidKillmails.slice(0, 10).join(', ')}${invalidKillmails.length > 10 ? ` ...and ${invalidKillmails.length - 10} more` : ''}\n`,
    );

    // STEP 5: Delete invalid killmails
    console.log('🗑️  step 5: deleting invalid killmails...');
    console.log('⏳ please wait, deleting with cascade...');

    const deleteStartTime = Date.now();
    const deleteResult = await prisma.killmail.deleteMany({
      where: {
        killmail_id: {
          in: invalidKillmails,
        },
      },
    });
    const deleteTime = ((Date.now() - deleteStartTime) / 1000).toFixed(1);

    console.log(
      `✅ deleted ${deleteResult.count.toLocaleString()} killmails in ${deleteTime}s`,
    );
    console.log('   (cascade deleted: victims, attackers, items, etc.)\n');

    // STEP 6: Final summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 cleanup complete');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 statistics:`);
    console.log(
      `   • total killmails checked: ${totalToCheck.toLocaleString()}`,
    );
    console.log(`   • valid killmails: ${validCount.toLocaleString()}`);
    console.log(
      `   • invalid killmails deleted: ${deleteResult.count.toLocaleString()}`,
    );
    console.log(`   • total time: ${totalTime}s`);
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n💥 error during cleanup');
    console.error('═══════════════════════════════════════════════════════');
    console.error(error);
    console.error('═══════════════════════════════════════════════════════\n');
    throw error;
  } finally {
    console.log('🔌 disconnecting from database...');
    await prisma.$disconnect();
    console.log('✅ disconnected\n');
  }
}

// Run the cleanup
cleanInvalidKillmails()
  .then(() => {
    console.log('🎉 script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 script failed:', error);
    process.exit(1);
  });
