import '../config';
import { CharacterService } from '../services/character/character.service';
import { KillmailService } from '../services/killmail/killmail.service';
import prisma from '../services/prisma';
import { pubsub } from '../services/pubsub';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_user_killmails_queue';
const PREFETCH_COUNT = 1; // Process 1 user at a time to avoid rate limiting

interface UserKillmailMessage {
    userId: number;
    characterId: number;
    characterName: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    queuedAt: string;
}

/**
 * ESI-only killmail worker for logged-in users
 *
 * This worker fetches killmails directly from ESI API using user's access token.
 * No zKillboard dependency - completely independent system.
 *
 * Features:
 * - Fetches recent killmails from ESI (up to 100 pages = 2500 killmails)
 * - Automatically enriches related entities (characters, corps, etc.)
 * - Publishes GraphQL subscription events for real-time updates
 * - Handles duplicates gracefully
 * - Respects ESI rate limits
 *
 * Usage: yarn worker:user-killmails
 * Or: Start with server process via ENABLE_USER_KILLMAIL_WORKER=true
 */
export async function esiUserKillmailWorker() {
    console.log('🔄 ESI User Killmail Worker Started');
    console.log(`📦 Queue: ${QUEUE_NAME}`);
    console.log(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent users`);
    console.log(`🌐 Data Source: ESI API (direct, no zKillboard)\n`);

    try {
        const channel = await getRabbitMQChannel();

        // Assert queue
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: {
                'x-max-priority': 10,
            },
        });

        // Set prefetch to limit concurrent processing
        channel.prefetch(PREFETCH_COUNT);

        console.log('✅ Connected to RabbitMQ');
        console.log('⏳ Waiting for user killmail jobs...\n');

        // Consume messages
        const consumerTag = await channel.consume(
            QUEUE_NAME,
            async (msg) => {
                if (!msg) {
                    console.log('⚠️  Received null message from RabbitMQ');
                    return;
                }

                console.log('📨 Received message from queue!');

                try {
                    const message: UserKillmailMessage = JSON.parse(msg.content.toString());

                    console.log(`\n${'━'.repeat(70)}`);
                    console.log(`👤 Processing: ${message.characterName} (ID: ${message.characterId})`);
                    console.log(`🆔 User ID: ${message.userId}`);
                    console.log(`📅 Queued at: ${message.queuedAt}`);
                    console.log('━'.repeat(70));

                    // Validate token exists
                    if (!message.accessToken || !message.refreshToken) {
                        console.error(`  ❌ No valid tokens available for user ${message.characterName}`);
                        console.error(`  ⏭️  Skipping user - requires re-login via SSO`);
                        channel.ack(msg); // Acknowledge to remove from queue (don't retry)
                        return;
                    }

                    // Check if token is expired or will expire soon (5 min buffer)
                    const tokenExpiresAt = new Date(message.expiresAt);
                    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

                    if (tokenExpiresAt <= fiveMinutesFromNow) {
                        console.log(`  ⚠️  Token expired or expiring soon, refreshing...`);
                        console.log(`     Expires at: ${tokenExpiresAt.toISOString()}`);
                        console.log(`     Current time: ${new Date().toISOString()}`);

                        try {
                            const { refreshAccessToken } = await import('../services/eve-sso.js');
                            const newTokenData = await refreshAccessToken(message.refreshToken);

                            const newExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000);

                            // Update token in database
                            await prisma.user.update({
                                where: { id: message.userId },
                                data: {
                                    access_token: newTokenData.access_token,
                                    refresh_token: newTokenData.refresh_token || message.refreshToken,
                                    expires_at: newExpiresAt,
                                },
                            });

                            // Update message with new token and expiry
                            message.accessToken = newTokenData.access_token;
                            message.refreshToken = newTokenData.refresh_token || message.refreshToken;
                            message.expiresAt = newExpiresAt.toISOString();

                            console.log(`  ✅ Token refreshed successfully`);
                            console.log(`     New expiry: ${newExpiresAt.toISOString()}`);
                        } catch (error: any) {
                            console.error(`  ❌ Failed to refresh token:`, error.message);
                            console.error(`  ⏭️  Skipping user - refresh token invalid, requires re-login`);
                            channel.ack(msg); // Acknowledge to remove from queue (don't retry)
                            return;
                        }
                    } else {
                        console.log(`  ✅ Token is valid (expires: ${tokenExpiresAt.toISOString()})`);
                    }

                    // Token is now guaranteed to be valid - proceed with ESI sync
                    await syncUserKillmailsFromESI(message);

                    // Acknowledge message
                    channel.ack(msg);
                    console.log(`✅ Completed: ${message.characterName}\n`);
                } catch (error: any) {
                    console.error(`❌ Failed to process message:`, error.message);

                    // Only requeue if it's a transient error (network, database, etc.)
                    // Don't requeue auth errors
                    if (error.message.includes('Token') ||
                        error.message.includes('403') ||
                        error.message.includes('401')) {
                        console.error(`  ⏭️  Skipping user - authentication error`);
                        channel.ack(msg); // Don't retry auth errors
                    } else {
                        console.error(`  🔄 Requeuing for retry...`);
                        channel.nack(msg, false, true); // Requeue for transient errors
                    }
                }
            },
            { noAck: false }
        );

        console.log(`📢 Consumer started with tag: ${consumerTag.consumerTag}`);
        console.log(`📊 Ready to process messages from ${QUEUE_NAME}\n`);
    } catch (error) {
        console.error('💥 Worker failed to start:', error);
        process.exit(1);
    }
}

/**
 * Fetch killmails from ESI for a single user
 */
async function syncUserKillmailsFromESI(message: UserKillmailMessage): Promise<void> {
    try {
        console.log(`  📡 [${message.characterName}] Fetching killmails from ESI...`);

        // Fetch killmail list from ESI (max 50 pages = 2500 killmails, 50 per page)
        const killmailList = await CharacterService.getCharacterKillmails(
            message.characterId,
            message.accessToken,
            50 // Max pages (50 killmails per page)
        );

        console.log(`  📥 Total killmails found from ESI: ${killmailList.length}`);

        if (killmailList.length > 0) {
            console.log(`  📄 First killmail: ID ${killmailList[0].killmail_id}, Hash ${killmailList[0].killmail_hash.substring(0, 10)}...`);
            console.log(`  📄 Last killmail: ID ${killmailList[killmailList.length - 1].killmail_id}, Hash ${killmailList[killmailList.length - 1].killmail_hash.substring(0, 10)}...`);
        }

        if (killmailList.length === 0) {
            console.log(`  ℹ️  No killmails found for this character`);
            return;
        }

        let savedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        console.log(`  💾 Processing killmails...\n`);

        // Process each killmail
        for (let i = 0; i < killmailList.length; i++) {
            const km = killmailList[i];

            try {
                // Progress indicator every 10 killmails for better visibility
                if (i > 0 && i % 10 === 0) {
                    console.log(`     📊 Progress: ${i}/${killmailList.length} (Saved: ${savedCount}, Skipped: ${skippedCount}, Errors: ${errorCount})`);
                }

                // Log first 3 killmails being processed
                if (i < 3) {
                    console.log(`     🔍 Processing killmail #${i + 1}: ID ${km.killmail_id}`);
                }

                // Fetch full details from ESI (public endpoint, no token needed)
                const detail = await KillmailService.getKillmailDetail(
                    km.killmail_id,
                    km.killmail_hash
                );

                // Save to database in a transaction
                try {
                    await prisma.$transaction(async (tx) => {
                        // 1. Create killmail record
                        await tx.killmail.create({
                            data: {
                                killmail_id: km.killmail_id,
                                killmail_hash: km.killmail_hash,
                                killmail_time: new Date(detail.killmail_time),
                                solar_system_id: detail.solar_system_id,
                            },
                        });

                        // 2. Create victim record
                        await tx.victim.create({
                            data: {
                                killmail_id: km.killmail_id,
                                character_id: detail.victim.character_id || null,
                                corporation_id: detail.victim.corporation_id,
                                alliance_id: detail.victim.alliance_id || null,
                                faction_id: detail.victim.faction_id || null,
                                ship_type_id: detail.victim.ship_type_id,
                                damage_taken: detail.victim.damage_taken,
                            },
                        });

                        // 3. Create attacker records
                        if (detail.attackers && detail.attackers.length > 0) {
                            await tx.attacker.createMany({
                                data: detail.attackers.map((attacker) => ({
                                    killmail_id: km.killmail_id,
                                    character_id: attacker.character_id || null,
                                    corporation_id: attacker.corporation_id || null,
                                    alliance_id: attacker.alliance_id || null,
                                    faction_id: attacker.faction_id || null,
                                    ship_type_id: attacker.ship_type_id || null,
                                    weapon_type_id: attacker.weapon_type_id || null,
                                    damage_done: attacker.damage_done,
                                    final_blow: attacker.final_blow,
                                    security_status: attacker.security_status || 0,
                                })),
                            });
                        }

                        // 4. Create item records (if any)
                        if (detail.victim.items && detail.victim.items.length > 0) {
                            await tx.killmailItem.createMany({
                                data: detail.victim.items.map((item) => ({
                                    killmail_id: km.killmail_id,
                                    item_type_id: item.item_type_id,
                                    flag: item.flag,
                                    quantity_dropped: item.quantity_dropped || null,
                                    quantity_destroyed: item.quantity_destroyed || null,
                                    singleton: item.singleton,
                                })),
                            });
                        }
                    });

                    // Publish GraphQL subscription event for real-time updates
                    try {
                        await pubsub.publish('NEW_KILLMAIL', {
                            killmailId: km.killmail_id,
                        });
                    } catch (pubsubError) {
                        // Don't fail the entire operation if pubsub fails
                        console.error(`     ⚠️  Failed to publish subscription event:`, pubsubError);
                    }

                    savedCount++;
                } catch (createError: any) {
                    // Handle duplicate killmails (already exists in database)
                    if (createError.code === 'P2002') {
                        skippedCount++;
                        // Log first few skipped killmails
                        if (skippedCount <= 3) {
                            console.log(`     ⏭️  Skipped (duplicate): ${km.killmail_id}`);
                        }
                    } else {
                        throw createError;
                    }
                }
            } catch (error: any) {
                errorCount++;
                console.error(`     ❌ Failed to process killmail ${km.killmail_id}:`, error.message);
            }
        }

        // Final summary
        console.log(`\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  ✅ Saved: ${savedCount} new killmails`);
        console.log(`  ⏭️  Skipped: ${skippedCount} (already in database)`);
        console.log(`  ❌ Errors: ${errorCount}`);
        console.log(`  📊 Total processed: ${killmailList.length}`);
        console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    } catch (error: any) {
        console.error(`  ❌ ESI sync failed for ${message.characterName}:`, error.message);
        throw error;
    }
}

/**
 * Graceful shutdown handlers
 */
function setupShutdownHandlers() {
    process.on('SIGINT', () => {
        console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
        process.exit(0);
    });
}

// Start the worker only if run directly (not imported)
if (require.main === module) {
    setupShutdownHandlers();
    esiUserKillmailWorker().catch((error) => {
        console.error('💥 Worker crashed:', error);
        process.exit(1);
    });
}
