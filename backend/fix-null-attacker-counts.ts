/**
 * Fix null attacker_count values in the database
 * Updates killmails where attacker_count is null by counting attackers
 */
import prisma from './src/services/prisma';

async function fixNullAttackerCounts() {
  console.log('🔍 Finding killmails with null attacker_count...');

  // Find all killmails with null attacker_count
  const killmailsWithNullCount = await prisma.killmail.findMany({
    where: {
      attacker_count: null,
    },
    select: {
      killmail_id: true,
    },
  });

  console.log(
    `Found ${killmailsWithNullCount.length} killmails with null attacker_count`,
  );

  if (killmailsWithNullCount.length === 0) {
    console.log('✅ No killmails need fixing!');
    return;
  }

  // Update each killmail with actual attacker count
  let fixed = 0;
  for (const km of killmailsWithNullCount) {
    const attackerCount = await prisma.attacker.count({
      where: {
        killmail_id: km.killmail_id,
      },
    });

    await prisma.killmail.update({
      where: { killmail_id: km.killmail_id },
      data: { attacker_count: attackerCount },
    });

    fixed++;
    if (fixed % 100 === 0) {
      console.log(`⏳ Fixed ${fixed}/${killmailsWithNullCount.length}...`);
    }
  }

  console.log(`✅ Fixed ${fixed} killmails!`);
}

fixNullAttackerCounts()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
