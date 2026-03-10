import { calculateKillmailValues } from '@helpers/calculate-killmail-values';
import { updateDailyAggregatesRealtime } from '@services/kill-stats-realtime';
import { KillmailService } from '@services/killmail';
import { insertKillmailFilter } from '@services/killmail-filters-realtime';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getRabbitMQChannel } from '@services/rabbitmq';
import { getCharacterKillmailsFromZKill } from '@services/zkillboard';

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
    logger.info('🔄 Killmail Worker Started');
    logger.info(`📦 Queue: ${QUEUE_NAME}`);
    logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent users\n`);

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

        logger.info('✅ Connected to RabbitMQ');
        logger.info('⏳ Waiting for killmail sync jobs...\n');

        // Consume messages from queue
        channel.consume(
            QUEUE_NAME,
            async (msg) => {
                if (!msg) return;

                try {
                    const message: QueueMessage = JSON.parse(msg.content.toString());

                    logger.info(`\n${'━'.repeat(60)}`);
                    logger.info(`👤 Processing: ${message.characterName} (ID: ${message.characterId})`);
                    logger.info(`📅 Queued at: ${message.queuedAt}`);
                    logger.info('━'.repeat(60));

                    await syncUserKillmails(message);

                    // Acknowledge message (remove from queue)
                    channel.ack(msg);
                    logger.info(`✅ Completed: ${message.characterName}\n`);
                } catch (error) {
                    logger.error(`❌ Failed to process message:`, error);

                    // Reject and requeue message (will retry later)
                    channel.nack(msg, false, true);
                }
            },
            { noAck: false } // Manual acknowledgment
        );
    } catch (error) {
        logger.error('💥 Worker failed to start:', error);
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
            const user = await prismaWorker.user.findUnique({
                where: { id: message.userId },
                select: {
                    access_token: true,
                    expires_at: true,
                    character_id: true,
                    character_name: true,
                },
            });

            if (!user) {
                logger.info(`  ⚠️  User not found in database`);
                return;
            }

            // Check if token is expired
            if (user.expires_at < new Date()) {
                logger.info(`  ⚠️  Token expired for ${user.character_name}`);
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

        logger.info(`\n${'='.repeat(60)}`);
        logger.info(`🚀 Processing Character: ${characterName} (${characterId})`);
        logger.info(`   Auth: ${hasAuth ? 'Yes (logged-in user)' : 'No (external character)'}`);
        logger.info(`${'='.repeat(60)}\n`);

        // Fetch killmails from zKillboard (includes ALL history)
        logger.info(`  📡 [${characterName}] Fetching killmails from zKillboard (max ${MAX_PAGES} pages)...`);
        const zkillPackages = await getCharacterKillmailsFromZKill(
            characterId,
            { maxPages: MAX_PAGES, characterName: characterName }
        );

        if (zkillPackages.length === 0) {
            logger.info(`  ℹ️  No killmails found`);
            return;
        }

        logger.info(`  📥 Found ${zkillPackages.length} killmails`);

        // Fetch details and save to database
        let savedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        logger.info(`  💾 Processing killmails...`);

        for (const zkillPkg of zkillPackages) {
            try {
                // Progress indicator every 50 killmails
                if ((savedCount + skippedCount + errorCount) % 50 === 0 && (savedCount + skippedCount + errorCount) > 0) {
                    logger.info(`     📊 Progress: ${savedCount + skippedCount + errorCount}/${zkillPackages.length} (Saved: ${savedCount}, Skipped: ${skippedCount}, Errors: ${errorCount})`);
                }

                // Fetch killmail details from ESI
                const detail = await KillmailService.getKillmailDetail(zkillPkg.killmail_id, zkillPkg.zkb.hash);

                // ⚡ Calculate value fields before saving
                const values = await calculateKillmailValues({
                    victim: { ship_type_id: detail.victim.ship_type_id },
                    items: detail.victim.items?.map(item => ({
                        item_type_id: item.item_type_id,
                        quantity_destroyed: item.quantity_destroyed,
                        quantity_dropped: item.quantity_dropped,
                        singleton: item.singleton,
                    })) || []
                });

                // Try to create killmail with all related data
                try {
                    await prismaWorker.$transaction(async (tx) => {
                        // 1. Create main killmail record with cached values
                        await tx.killmail.create({
                            data: {
                                killmail_id: zkillPkg.killmail_id,
                                killmail_hash: zkillPkg.zkb.hash,
                                killmail_time: new Date(detail.killmail_time),
                                solar_system_id: detail.solar_system_id,
                                total_value: values.totalValue,
                                destroyed_value: values.destroyedValue,
                                dropped_value: values.droppedValue,
                                attacker_count: detail.attackers.length,
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

                            // ⚡ Update daily aggregates in real-time
                            await updateDailyAggregatesRealtime(tx, {
                                killmail_time: new Date(detail.killmail_time),
                                character_ids: detail.attackers.map(a => a.character_id || null),
                                corporation_ids: detail.attackers.map(a => a.corporation_id || null),
                                alliance_ids: detail.attackers.map(a => a.alliance_id || null),
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

                    // ⚡ Insert into killmail_filters for fast GIN queries
                    insertKillmailFilter({
                        killmail_id: BigInt(zkillPkg.killmail_id),
                        killmail_time: new Date(detail.killmail_time),
                        solar_system_id: detail.solar_system_id,
                        attacker_count: detail.attackers.length,
                        victim_ship_type_id: detail.victim.ship_type_id || null,
                        victim_character_id: detail.victim.character_id || null,
                        victim_corporation_id: detail.victim.corporation_id || null,
                        victim_alliance_id: detail.victim.alliance_id || null,
                        attacker_ship_type_ids: detail.attackers.map(a => a.ship_type_id || null),
                        attacker_character_ids: detail.attackers.map(a => a.character_id || null),
                        attacker_corporation_ids: detail.attackers.map(a => a.corporation_id || null),
                        attacker_alliance_ids: detail.attackers.map(a => a.alliance_id || null),
                    }).catch(error => {
                        logger.error(`Failed to insert killmail_filters for ${zkillPkg.killmail_id}:`, error);
                    });

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
                logger.error(`  ❌ Failed to process killmail ${zkillPkg.killmail_id}:`, error);
            }
        }

        logger.info(`  ✅ Saved: ${savedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
    } catch (error) {
        logger.error(`  ❌ Sync failed:`, error);
        throw error; // Re-throw to trigger message requeue
    }
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers() {
    const shutdown = () => {
        logger.info('\n\n⚠️ Received shutdown signal');
        logger.info('🛑 Stopping worker...');
        prismaWorker.$disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// Start the worker
setupShutdownHandlers();
killmailWorker().catch((error) => {
    logger.error('💥 Worker crashed:', error);
    process.exit(1);
});
