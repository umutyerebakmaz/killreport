import '../config';
import { KillmailService } from '../services/killmail';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';
import { getCharacterKillmailsFromZKill } from '../services/zkillboard';

const QUEUE_NAME = 'zkillboard_character_queue';
const PREFETCH_COUNT = 2; // Process 2 users at a time (rate limit consideration)
const MAX_PAGES = 100; // Fetch up to 100 pages from zKillboard (20,000 killmails max) - Set to 999 for ALL history

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
 * Sync killmails for a single user or character
 */
async function syncUserKillmails(message: QueueMessage): Promise<void> {
    try {
        let characterId: number;
        let characterName: string;
        let hasAuth = false;

        // Check if this is a logged-in user or external character
        if (message.userId) {
            // Get user from database with token
            const user = await prisma.user.findUnique({
                where: { id: message.userId },
                select: {
                    access_token: true,
                    expires_at: true,
                    character_id: true,
                    character_name: true,
                },
            });

            if (!user) {
                console.log(`  ⚠️  User not found in database`);
                return;
            }

            // Check if token is expired
            if (user.expires_at < new Date()) {
                console.log(`  ⚠️  Token expired for ${user.character_name}`);
                return;
            }

            characterId = user.character_id;
            characterName = user.character_name;
            hasAuth = true;
        } else {
            // External character (no authentication)
            characterId = message.characterId;
            characterName = message.characterName;
            hasAuth = false;
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🚀 Processing Character: ${characterName} (${characterId})`);
        console.log(`   Auth: ${hasAuth ? 'Yes (logged-in user)' : 'No (external character)'}`);
        console.log(`${'='.repeat(60)}\n`);

        // Fetch killmails from zKillboard (includes ALL history)
        console.log(`  📡 [${characterName}] Fetching killmails from zKillboard (max ${MAX_PAGES} pages)...`);
        const zkillPackages = await getCharacterKillmailsFromZKill(
            characterId,
            { maxPages: MAX_PAGES, characterName: characterName }
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
                const detail = await KillmailService.getKillmailDetail(zkillPkg.killmail_id, zkillPkg.zkb.hash);

                // Try to create killmail with all related data
                try {
                    await prisma.$transaction(async (tx) => {
                        // 1. Create main killmail record
                        await tx.killmail.create({
                            data: {
                                killmail_id: zkillPkg.killmail_id,
                                killmail_hash: zkillPkg.zkb.hash,
                                killmail_time: new Date(detail.killmail_time),
                                solar_system_id: detail.solar_system_id,
                            },
                        });

                        // 2. Create victim record
                        await tx.victim.create({
                            data: {
                                killmail_id: zkillPkg.killmail_id,
                                character_id: detail.victim.character_id,
                                corporation_id: detail.victim.corporation_id,
                                alliance_id: detail.victim.alliance_id,
                                faction_id: detail.victim.faction_id,
                                ship_type_id: detail.victim.ship_type_id,
                                damage_taken: detail.victim.damage_taken,
                                position_x: detail.victim.position?.x,
                                position_y: detail.victim.position?.y,
                                position_z: detail.victim.position?.z,
                            },
                        });

                        // 3. Create attacker records (bulk insert)
                        if (detail.attackers.length > 0) {
                            await tx.attacker.createMany({
                                data: detail.attackers.map(attacker => ({
                                    killmail_id: zkillPkg.killmail_id,
                                    character_id: attacker.character_id,
                                    corporation_id: attacker.corporation_id,
                                    alliance_id: attacker.alliance_id,
                                    faction_id: attacker.faction_id,
                                    ship_type_id: attacker.ship_type_id,
                                    weapon_type_id: attacker.weapon_type_id,
                                    damage_done: attacker.damage_done,
                                    final_blow: attacker.final_blow,
                                    security_status: attacker.security_status,
                                })),
                            });
                        }

                        // 4. Create item records (bulk insert)
                        if (detail.victim.items && detail.victim.items.length > 0) {
                            await tx.killmailItem.createMany({
                                data: detail.victim.items.map(item => ({
                                    killmail_id: zkillPkg.killmail_id,
                                    item_type_id: item.item_type_id,
                                    flag: item.flag,
                                    quantity_dropped: item.quantity_dropped,
                                    quantity_destroyed: item.quantity_destroyed,
                                    singleton: item.singleton,
                                })),
                            });
                        }
                    });

                    savedCount++;

                    // Note: Enrichment is now handled by separate microservices
                    // Run scan-killmail-entities.ts to queue missing entities
                    // Then start specialized info workers
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
        console.log('\n\n⚠️ Received shutdown signal');
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
