/**
 * Queue ALL killmails for value recalculation
 * This ensures all historical killmails are recalculated with current logic
 */
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'backfill_killmail_values_queue';
const BATCH_SIZE = 1000;

async function queueAllKillmails() {
  console.log('🔍 Queuing ALL killmails for recalculation...\n');
  console.log('⏳ Processing in batches (count may take long, skipping...)\\n');

  const channel = await getRabbitMQChannel();
  await channel.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: { 'x-max-priority': 10 },
  });

  let queued = 0;
  let lastKillmailId = 0;
  let batchNumber = 0;

  while (true) {
    const killmails = await prisma.killmail.findMany({
      take: BATCH_SIZE,
      where: {
        killmail_id: {
          gt: lastKillmailId,
        },
      },
      orderBy: { killmail_id: 'asc' },
    });

    if (killmails.length === 0) {
      break; // No more killmails
    }

    for (const km of killmails) {
      const message = JSON.stringify({
        killmailId: km.killmail_id,
        queuedAt: new Date().toISOString(),
        source: 'all_killmails_recalculation',
        mode: 'all', // Force full recalculation
      });

      channel.sendToQueue(QUEUE_NAME, Buffer.from(message), {
        persistent: true,
      });
      queued++;
      lastKillmailId = km.killmail_id;
    }

    batchNumber++;
    console.log(`✅ Batch ${batchNumber}: Queued ${queued.toLocaleString()} killmails (last ID: ${lastKillmailId})`);
  }

  console.log(`\n✅ Successfully queued ${queued.toLocaleString()} killmails`);
  console.log(`\n🚀 Now run: yarn worker:backfill-values (3-4 workers in parallel)`);

  await channel.close();
  await prisma.$disconnect();
}

queueAllKillmails().catch((error) => {
  console.error('❌ Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
