/**
 * Queue all killmails containing blueprints for backfill
 * This ensures blueprint copy values are recalculated correctly
 */
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'backfill_killmail_values_queue';
const BATCH_SIZE = 500;

async function queueBlueprintKillmails() {
  console.log('🔍 Finding killmails with blueprints...\n');

  // Get all unique killmail IDs that contain blueprint items
  const killmailIds = await prisma.$queryRaw<Array<{ killmail_id: number }>>`
    SELECT DISTINCT k.killmail_id
    FROM killmails k
    JOIN killmail_items ki ON k.killmail_id = ki.killmail_id
    JOIN types t ON ki.item_type_id = t.id
    JOIN item_groups ig ON t.group_id = ig.id
    JOIN categories c ON ig.category_id = c.id
    WHERE LOWER(c.name) = 'blueprint'
    ORDER BY k.killmail_id DESC
  `;

  const totalCount = killmailIds.length;
  console.log(`📊 Found ${totalCount.toLocaleString()} killmails with blueprints\n`);

  if (totalCount === 0) {
    console.log('✅ No killmails to process');
    await prisma.$disconnect();
    return;
  }

  // Get breakdown by singleton
  const breakdown = await prisma.$queryRaw<Array<{
    singleton: number;
    killmail_count: bigint;
  }>>`
    SELECT
      ki.singleton,
      COUNT(DISTINCT k.killmail_id) as killmail_count
    FROM killmails k
    JOIN killmail_items ki ON k.killmail_id = ki.killmail_id
    JOIN types t ON ki.item_type_id = t.id
    JOIN item_groups ig ON t.group_id = ig.id
    JOIN categories c ON ig.category_id = c.id
    WHERE LOWER(c.name) = 'blueprint'
    GROUP BY ki.singleton
    ORDER BY ki.singleton
  `;

  console.log('📋 Breakdown by singleton type:');
  breakdown.forEach(b => {
    const label = b.singleton === 0 ? 'singleton=0 (WRONG/Stack)' :
      b.singleton === 1 ? 'singleton=1 (BPO/Original)' :
        'singleton=2 (BPC/Copy)';
    console.log(`   • ${label}: ${Number(b.killmail_count).toLocaleString()} killmails`);
  });
  console.log('');

  // Connect to RabbitMQ
  const channel = await getRabbitMQChannel();
  await channel.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: { 'x-max-priority': 10 }
  });

  console.log('📤 Queueing killmails...\n');

  let queued = 0;
  const startTime = Date.now();

  // Queue in batches
  for (let i = 0; i < killmailIds.length; i += BATCH_SIZE) {
    const batch = killmailIds.slice(i, i + BATCH_SIZE);

    for (const { killmail_id } of batch) {
      const message = {
        killmailId: killmail_id,
        queuedAt: new Date().toISOString(),
        source: 'blueprint_recalculation',
        mode: 'all' // Force recalculation
      };

      await channel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, priority: 5 }
      );

      queued++;
    }

    const percentage = ((i + batch.length) / totalCount * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (queued / (Date.now() - startTime) * 1000).toFixed(0);

    console.log(
      `  📤 Progress: ${queued.toLocaleString()}/${totalCount.toLocaleString()} (${percentage}%) | ` +
      `Rate: ${rate}/s | Elapsed: ${elapsed}s`
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '━'.repeat(60));
  console.log('✅ Queueing completed!');
  console.log(`📊 Total queued: ${queued.toLocaleString()} killmails`);
  console.log(`⏱️  Time: ${totalTime}s`);
  console.log('━'.repeat(60));
  console.log('\n💡 Now start worker(s) to process:');
  console.log('   yarn worker:backfill-values');
  console.log('\n💡 For faster processing, run multiple workers in parallel:');
  console.log('   yarn worker:backfill-values & yarn worker:backfill-values & yarn worker:backfill-values\n');

  await channel.close();
  await prisma.$disconnect();
  process.exit(0);
}

queueBlueprintKillmails().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
