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
  console.log('🔍 INVALID KILLMAIL CLEANUP SCRIPT');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // STEP 1: Count total killmails
    console.log('📊 STEP 1: Counting total killmails in database...');
    const totalCount = await prisma.killmail.count();
    console.log(`✅ Found ${totalCount.toLocaleString()} killmails\n`);

    // STEP 2: Fetch all killmail IDs
    console.log('📦 STEP 2: Fetching killmail IDs...');
    const allKillmails = await prisma.killmail.findMany({
      select: { killmail_id: true },
      orderBy: { killmail_id: 'asc' },
    });
    console.log(
      `✅ Loaded ${allKillmails.length.toLocaleString()} killmail IDs into memory\n`,
    );

    // STEP 3: Check each killmail for attackers
    console.log('🔍 STEP 3: Checking killmails for attackers...');
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
          `📈 Progress: ${checkedCount.toLocaleString()}/${totalToCheck.toLocaleString()} (${percentage}%) | Valid: ${validCount} | Invalid: ${invalidKillmails.length} | Time: ${elapsed}s | ETA: ${eta}min`,
        );
      }

      const attackerCount = await prisma.attacker.count({
        where: { killmail_id: km.killmail_id },
      });

      if (attackerCount === 0) {
        invalidKillmails.push(km.killmail_id);
        console.log(
          `  ❌ INVALID: Killmail ${km.killmail_id} has NO attackers`,
        );
      } else {
        validCount++;
      }
    }

    console.log('\n─────────────────────────────────────────────────────');
    console.log(
      `✅ Scan complete: Checked ${checkedCount.toLocaleString()} killmails`,
    );
    console.log(`   ✓ Valid: ${validCount.toLocaleString()}`);
    console.log(`   ✗ Invalid: ${invalidKillmails.length.toLocaleString()}\n`);

    if (invalidKillmails.length === 0) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ DATABASE IS CLEAN - No invalid killmails found!');
      console.log('═══════════════════════════════════════════════════════\n');
      return;
    }

    // STEP 4: Show invalid killmails summary
    console.log('⚠️  STEP 4: Invalid killmails found');
    console.log('─────────────────────────────────────────────────────');
    console.log(
      `📝 Invalid killmail IDs: ${invalidKillmails.slice(0, 10).join(', ')}${invalidKillmails.length > 10 ? ` ...and ${invalidKillmails.length - 10} more` : ''}\n`,
    );

    // STEP 5: Delete invalid killmails
    console.log('🗑️  STEP 5: Deleting invalid killmails...');
    console.log('⏳ Please wait, deleting with cascade...');

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
      `✅ Deleted ${deleteResult.count.toLocaleString()} killmails in ${deleteTime}s`,
    );
    console.log('   (Cascade deleted: victims, attackers, items, etc.)\n');

    // STEP 6: Final summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 CLEANUP COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 Statistics:`);
    console.log(
      `   • Total killmails checked: ${totalToCheck.toLocaleString()}`,
    );
    console.log(`   • Valid killmails: ${validCount.toLocaleString()}`);
    console.log(
      `   • Invalid killmails deleted: ${deleteResult.count.toLocaleString()}`,
    );
    console.log(`   • Total time: ${totalTime}s`);
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n💥 ERROR DURING CLEANUP');
    console.error('═══════════════════════════════════════════════════════');
    console.error(error);
    console.error('═══════════════════════════════════════════════════════\n');
    throw error;
  } finally {
    console.log('🔌 Disconnecting from database...');
    await prisma.$disconnect();
    console.log('✅ Disconnected\n');
  }
}

// Run the cleanup
cleanInvalidKillmails()
  .then(() => {
    console.log('🎉 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
