/**
 * Fix victim records that have no corresponding killmail
 */
import '../src/config';
import prismaWorker from '../src/services/prisma-worker';

async function fixVictimForeignKey() {
  console.log('🔍 Checking for orphaned victims...\n');

  // Find victims without killmails
  const orphanedVictims = await prismaWorker.$queryRaw<Array<{ killmail_id: number }>>`
    SELECT v.killmail_id
    FROM victims v
    LEFT JOIN killmails k ON v.killmail_id = k.killmail_id
    WHERE k.killmail_id IS NULL
  `;

  console.log(`Found ${orphanedVictims.length} orphaned victim records\n`);

  if (orphanedVictims.length === 0) {
    console.log('✅ No orphaned victims found!');
    await prismaWorker.$disconnect();
    return;
  }

  // Show first 10
  console.log('Sample orphaned killmail_ids:');
  orphanedVictims.slice(0, 10).forEach((v) => {
    console.log(`  - ${v.killmail_id}`);
  });

  if (orphanedVictims.length > 10) {
    console.log(`  ... and ${orphanedVictims.length - 10} more\n`);
  }

  console.log('\n⚠️  These victim records will be DELETED because they have no corresponding killmail.');
  console.log('This is necessary to restore the foreign key constraint.\n');

  // Delete orphaned victims
  const result = await prismaWorker.$executeRaw`
    DELETE FROM victims v
    WHERE NOT EXISTS (
      SELECT 1 FROM killmails k WHERE k.killmail_id = v.killmail_id
    )
  `;

  console.log(`\n✅ Deleted ${result} orphaned victim records`);

  await prismaWorker.$disconnect();
}

fixVictimForeignKey().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
