import './config';
import { getKillmailDetail } from './services/eve-esi';
import prisma from './services/prisma';
import { getRabbitMQChannel } from './services/rabbitmq';
import { getCharacterKillmailsFromZKill } from './services/zkillboard';

const QUEUE_NAME = 'killmail_sync_queue';
const PREFETCH_COUNT = 2; // Process 2 users at a time (rate limit consideration)
const MAX_PAGES = 5; // Fetch up to 5 pages from zKillboard (1000 killmails max)

interface QueueMessage {
  userId: number;
  characterId: number;
  characterName: string;
  queuedAt: string;
}

/**
 * Background worker for syncing killmails
 * Uses RabbitMQ queue for better scalability and reliability
 */
async function killmailWorker() {
  console.log('🔄 Killmail Worker Started');
  console.log(`📦 Queue: ${QUEUE_NAME}`);
  console.log(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent users\n`);

  try {
    const channel = await getRabbitMQChannel();

    // Configure queue
    await channel.assertQueue(QUEUE_NAME, {
      durable: true, // Survive RabbitMQ restarts
      arguments: {
        'x-max-priority': 10, // Enable priority queue (0-10)
      },
    });

    // Set prefetch count (how many messages to process concurrently)
    channel.prefetch(PREFETCH_COUNT);

    console.log('✅ Connected to RabbitMQ');
    console.log('⏳ Waiting for killmail sync jobs...\n');

    // Consume messages from queue
    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;

        try {
          const message: QueueMessage = JSON.parse(msg.content.toString());

          console.log(`\n${'━'.repeat(60)}`);
          console.log(`👤 Processing: ${message.characterName} (ID: ${message.characterId})`);
          console.log(`📅 Queued at: ${message.queuedAt}`);
          console.log('━'.repeat(60));

          await syncUserKillmails(message);

          // Acknowledge message (remove from queue)
          channel.ack(msg);
          console.log(`✅ Completed: ${message.characterName}\n`);
        } catch (error) {
          console.error(`❌ Failed to process message:`, error);

          // Reject and requeue message (will retry later)
          channel.nack(msg, false, true);
        }
      },
      { noAck: false } // Manual acknowledgment
    );
  } catch (error) {
    console.error('💥 Worker failed to start:', error);
    process.exit(1);
  }
}

/**
 * Sync killmails for a single user
 */
async function syncUserKillmails(message: QueueMessage): Promise<void> {
  try {
    // Get user from database with token
    const user = await prisma.user.findUnique({
      where: { id: message.userId },
      select: {
        accessToken: true,
        expiresAt: true,
        characterId: true,
        characterName: true,
      },
    });

    if (!user) {
      console.log(`  ⚠️  User not found in database`);
      return;
    }

    // Check if token is expired
    if (user.expiresAt < new Date()) {
      console.log(`  ⚠️  Token expired - skipping`);
      // TODO: Implement token refresh logic here
      return;
    }

    // Fetch killmails from zKillboard (includes ALL history)
    console.log(`  📡 Fetching killmails from zKillboard (max ${MAX_PAGES} pages)...`);
    const zkillPackages = await getCharacterKillmailsFromZKill(
      user.characterId,
      { maxPages: MAX_PAGES }
    );

    if (zkillPackages.length === 0) {
      console.log(`  ℹ️  No killmails found`);
      return;
    }

    console.log(`  📥 Found ${zkillPackages.length} killmails`);

    // Fetch details and save to database
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log(`  💾 Processing killmails...`);

    for (const zkillPkg of zkillPackages) {
      try {
        // Progress indicator every 50 killmails
        if ((savedCount + skippedCount + errorCount) % 50 === 0 && (savedCount + skippedCount + errorCount) > 0) {
          console.log(`     📊 Progress: ${savedCount + skippedCount + errorCount}/${zkillPackages.length} (Saved: ${savedCount}, Skipped: ${skippedCount}, Errors: ${errorCount})`);
        }

        // Fetch killmail details from ESI
        const detail = await getKillmailDetail(zkillPkg.killmail_id, zkillPkg.zkb.hash);

        // Try to create killmail
        try {
          await prisma.killmail.create({
            data: {
              killmailId: zkillPkg.killmail_id,
              killmailHash: zkillPkg.zkb.hash,
              killmail_time: new Date(detail.killmail_time),
              solar_system_id: detail.solar_system_id,
              victim_character_id: detail.victim.character_id,
              victim_corporation_id: detail.victim.corporation_id,
              victim_alliance_id: detail.victim.alliance_id,
              victim_ship_type_id: detail.victim.ship_type_id,
              victim_damage_taken: detail.victim.damage_taken,
              victim_position_x: detail.victim.position?.x,
              victim_position_y: detail.victim.position?.y,
              victim_position_z: detail.victim.position?.z,
              attackers: {
                create: detail.attackers.map(attacker => ({
                  character_id: attacker.character_id,
                  corporation_id: attacker.corporation_id,
                  alliance_id: attacker.alliance_id,
                  ship_type_id: attacker.ship_type_id,
                  weapon_type_id: attacker.weapon_type_id,
                  damage_done: attacker.damage_done,
                  final_blow: attacker.final_blow,
                  security_status: attacker.security_status,
                })),
              },
            },
          });
          savedCount++;
        } catch (createError: any) {
          // If duplicate (P2002), it's already in database - skip it
          if (createError.code === 'P2002') {
            skippedCount++;
          } else {
            // Other errors should be counted as errors
            throw createError;
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Failed to process killmail ${zkillPkg.killmail_id}:`, error);
      }
    }

    console.log(`  ✅ Saved: ${savedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error(`  ❌ Sync failed:`, error);
    throw error; // Re-throw to trigger message requeue
  }
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
  const shutdown = () => {
    console.log('\n\n⚠️  Received shutdown signal');
    console.log('🛑 Stopping worker...');
    prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the worker
setupShutdownHandlers();
killmailWorker().catch((error) => {
  console.error('💥 Worker crashed:', error);
  process.exit(1);
});
