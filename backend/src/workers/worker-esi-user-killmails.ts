import '../config';
import { CharacterService } from '../services/character/character.service';
import { KillmailService } from '../services/killmail/killmail.service';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { pubsub } from '../services/pubsub';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_user_killmails_queue';
const PREFETCH_COUNT = 1; // Process 1 user at a time to avoid rate limiting
const BATCH_SIZE = 3; // Process killmails in batches of 3 (reduced for safety)
const BATCH_DELAY_MS = 500; // 500ms delay between batches
const PAGE_FETCH_DELAY_MS = 2000; // 2 second delay after fetching killmail list
const KILLMAIL_DETAIL_DELAY_MS = 250; // 250ms delay after EACH killmail detail fetch (max ~4 req/sec)

// Shutdown flag and interval tracking
let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

interface UserKillmailMessage {
  userId: number;
  characterId: number;
  characterName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  queuedAt: string;
  lastKillmailId?: number; // For incremental sync optimization
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
  while (!isShuttingDown) {
    logger.info('🔄 ESI User Killmail Worker Started');
    logger.info(`📦 Queue: ${QUEUE_NAME}`);
    logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent users`);
    logger.info(`🌐 Data Source: ESI API (direct, no zKillboard)\n`);

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

      logger.info('✅ Connected to RabbitMQ');
      logger.info('⏳ Waiting for user killmail jobs...\n');

      // Add channel error handlers
      channel.on('error', (err) => {
        if (!isShuttingDown) {
          logger.error('💥 Channel error:', err);
        }
      });

      channel.on('close', () => {
        if (!isShuttingDown) {
          logger.warn('⚠️  Channel closed unexpectedly');
        }
      });

      // Consume messages
      await channel.consume(
        QUEUE_NAME,
        async (msg) => {
          if (!msg) {
            logger.warn('⚠️  Received null message from RabbitMQ');
            return;
          }

          logger.info('📨 Received message from queue!');

          try {
            const message: UserKillmailMessage = JSON.parse(msg.content.toString());

            logger.info(`\n${'━'.repeat(70)}`);
            logger.info(`👤 Processing: ${message.characterName} (ID: ${message.characterId})`);
            logger.info(`🆔 User ID: ${message.userId}`);
            logger.info(`📅 Queued at: ${message.queuedAt}`);
            logger.info('━'.repeat(70));

            // Validate token exists
            if (!message.accessToken || !message.refreshToken) {
              logger.error(`  ❌ No valid tokens available for user ${message.characterName}`);
              logger.error(`  ⏭️  Skipping user - requires re-login via SSO`);
              channel.ack(msg); // Acknowledge to remove from queue (don't retry)
              return;
            }

            // Check if token is expired or will expire soon (5 min buffer)
            const tokenExpiresAt = new Date(message.expiresAt);
            const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

            if (tokenExpiresAt <= fiveMinutesFromNow) {
              logger.info(`  ⚠️  Token expired or expiring soon, refreshing...`);
              logger.info(`     Expires at: ${tokenExpiresAt.toISOString()}`);
              logger.info(`     Current time: ${new Date().toISOString()}`);

              try {
                const { refreshAccessToken } = await import('../services/eve-sso.js');
                const newTokenData = await refreshAccessToken(message.refreshToken);

                const newExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000);

                // Update token in database
                await prismaWorker.user.update({
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

                logger.info(`  ✅ Token refreshed successfully`);
                logger.info(`     New expiry: ${newExpiresAt.toISOString()}`);
              } catch (error: any) {
                logger.error(`  ❌ Failed to refresh token:`, error.message);
                logger.error(`  ⏭️  Skipping user - refresh token invalid, requires re-login`);
                channel.ack(msg); // Acknowledge to remove from queue (don't retry)
                return;
              }
            } else {
              logger.info(`  ✅ Token is valid (expires: ${tokenExpiresAt.toISOString()})`);
            }

            // Token is now guaranteed to be valid - proceed with ESI sync
            await syncUserKillmailsFromESI(message, message.lastKillmailId);

            // Acknowledge message
            channel.ack(msg);
            logger.info(`✅ Completed: ${message.characterName}\n`);
          } catch (error: any) {
            logger.error(`❌ Failed to process message:`, error.message);

            // Handle rate limit errors - don't requeue to prevent infinite loop
            if (error.message.includes('429') || error.message.includes('Rate limit')) {
              logger.warn(`  ⏭️  Skipping user due to rate limit - will retry on next cron cycle`);
              channel.ack(msg); // Acknowledge to prevent infinite retry loop
              return;
            }

            // Only requeue if it's a transient error (network, database, etc.)
            // Don't requeue auth errors
            if (error.message.includes('Token') ||
              error.message.includes('403') ||
              error.message.includes('401')) {
              logger.error(`  ⏭️  Skipping user - authentication error`);
              channel.ack(msg); // Don't retry auth errors
            } else {
              logger.error(`  🔄 Requeuing for retry...`);
              channel.nack(msg, false, true); // Requeue for transient errors
            }
          }
        },
        { noAck: false }
      );

      logger.info(`📢 Consumer started`);
      logger.info(`📊 Ready to process messages from ${QUEUE_NAME}\n`);

      // Wait indefinitely (until error or shutdown)
      await new Promise(() => { });
    } catch (error) {
      if (isShuttingDown) break;
      logger.error('💥 Worker connection lost, reconnecting in 5s...', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Cleanup
  logger.info('🧹 Worker cleanup completed');
  await prismaWorker.$disconnect();
}

/**
 * Fetch killmails from ESI for a single user
 */
async function syncUserKillmailsFromESI(
  message: UserKillmailMessage,
  lastKillmailId?: number
): Promise<void> {
  try {
    if (lastKillmailId) {
      logger.info(`  📡 [${message.characterName}] Fetching NEW killmails from ESI (incremental sync)...`);
      logger.info(`     🔍 Will stop at killmail ID: ${lastKillmailId}`);
      logger.info(`     📄 Max pages: 50 (will stop earlier if last synced killmail is found)`);
    } else {
      logger.info(`  📡 [${message.characterName}] Fetching killmails from ESI (full sync)...`);
      logger.info(`     📄 Max pages: 50 (2,500 killmails max - 50 per page)`);
    }

    // Fetch killmail list from ESI (max 50 pages = 2500 killmails, 50 per page)
    // ESI returns killmails in reverse chronological order (newest first)
    const killmailList = await CharacterService.getCharacterKillmails(
      message.characterId,
      message.accessToken,
      50, // Max pages (50 killmails per page)
      lastKillmailId // Stop when we hit this ID (incremental sync)
    );

    // Add delay after fetching killmail list to prevent rate limiting on detail fetches
    logger.debug(`  ⏸️  Waiting ${PAGE_FETCH_DELAY_MS}ms before processing killmails...`);
    await new Promise(resolve => setTimeout(resolve, PAGE_FETCH_DELAY_MS));

    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    logger.info(`  💾 Processing killmails in batches of ${BATCH_SIZE} (${BATCH_DELAY_MS}ms delay)...\n`);

    // Helper function for delay
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Process killmails in batches to avoid rate limiting
    for (let batchStart = 0; batchStart < killmailList.length; batchStart += BATCH_SIZE) {
      const batch = killmailList.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(killmailList.length / BATCH_SIZE);

      logger.debug(`     📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} killmails...`);

      // Process batch sequentially (not parallel to respect rate limits)
      for (const km of batch) {
        try {
          // Fetch full details from ESI (public endpoint, no token needed)
          const detail = await KillmailService.getKillmailDetail(
            km.killmail_id,
            km.killmail_hash
          );

          // Add delay after EACH detail fetch to prevent rate limiting
          // This is critical when multiple workers or batches run concurrently
          await sleep(KILLMAIL_DETAIL_DELAY_MS);

          // Check if killmail already exists to avoid duplicate constraint errors
          const existingKillmail = await prismaWorker.killmail.findUnique({
            where: { killmail_id: km.killmail_id },
            select: { killmail_id: true },
          });

          if (existingKillmail) {
            skippedCount++;
            continue; // Skip to next killmail
          }

          // Save to database in a transaction
          try {
            await prismaWorker.$transaction(async (tx) => {
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

            try {
              await pubsub.publish('NEW_KILLMAIL', {
                killmailId: km.killmail_id,
              });
              savedCount++;
            } catch (pubsubError) {
              // Don't fail the entire operation if pubsub fails
              logger.error(`     ⚠️  Failed to publish subscription event:`, pubsubError);
              savedCount++;
            }
          } catch (createError: any) {
            // Handle duplicate killmails (already exists in database)
            if (createError.code === 'P2002') {
              skippedCount++;
            } else {
              throw createError;
            }
          }
        } catch (error: any) {
          errorCount++;
          logger.error(`     ❌ Failed to process killmail ${km.killmail_id}:`, error.message);
        }
      }

      // Delay between batches to respect rate limits
      if (batchStart + BATCH_SIZE < killmailList.length) {
        logger.debug(`     ⏸️  Batch ${batchNum} done (Saved: ${savedCount}, Skipped: ${skippedCount}) - waiting ${BATCH_DELAY_MS}ms...`);
        await sleep(BATCH_DELAY_MS);
      }
    }

    // Final summary
    logger.info(`\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`  ✅ Saved: ${savedCount} new killmails`);
    logger.info(`  ⏭️  Skipped: ${skippedCount} (already in database)`);
    logger.info(`  ❌ Errors: ${errorCount}`);
    logger.info(`  📊 Total processed: ${killmailList.length}`);
    logger.info(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Update user's last sync info for incremental syncs
    if (killmailList.length > 0) {
      const latestKillmailId = Math.max(...killmailList.map(km => km.killmail_id));
      await prismaWorker.user.update({
        where: { id: message.userId },
        data: {
          last_killmail_sync_at: new Date(),
          last_killmail_id: latestKillmailId,
        },
      });
      logger.info(`  💾 Updated last sync info (latest killmail ID: ${latestKillmailId})`);
    } else {
      // Even if no killmails, update sync timestamp to avoid repeated empty checks
      await prismaWorker.user.update({
        where: { id: message.userId },
        data: {
          last_killmail_sync_at: new Date(),
        },
      });
      logger.info(`  💾 Updated last sync timestamp (no killmails found)`);
    }
  } catch (error: any) {
    logger.error(`  ❌ ESI sync failed for ${message.characterName}:`, error.message);
    throw error;
  }
}

/**
 * Graceful shutdown handlers
 */
function setupShutdownHandlers() {
  const shutdown = async () => {
    isShuttingDown = true;
    if (emptyCheckInterval) {
      clearInterval(emptyCheckInterval);
      emptyCheckInterval = null;
    }
    logger.warn('\n⚠️  Received shutdown signal, shutting down gracefully...');
    await prismaWorker.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the worker only if run directly (not imported)
if (require.main === module) {
  setupShutdownHandlers();
  esiUserKillmailWorker().catch((error) => {
    logger.error('💥 Worker crashed:', error);
    process.exit(1);
  });
}
