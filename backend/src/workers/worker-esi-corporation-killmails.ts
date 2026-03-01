import { calculateKillmailValues } from '@helpers/calculate-killmail-values';
import { CorporationService } from '@services/corporation/corporation.service';
import { updateDailyAggregatesRealtime } from '@services/kill-stats-realtime';
import { insertKillmailFilter } from '@services/killmail-filters-realtime';
import { KillmailService } from '@services/killmail/killmail.service';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { pubsub } from '@services/pubsub';
import { getRabbitMQChannel } from '@services/rabbitmq';

const QUEUE_NAME = 'esi_corporation_killmails_queue';
const PREFETCH_COUNT = 1; // Process 1 corporation at a time to avoid rate limiting

interface CorporationKillmailMessage {
  userId: number;
  characterId: number;
  characterName: string;
  corporationId: number;
  corporationName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  queuedAt: string;
  lastKillmailId?: number; // For incremental sync optimization
}

/**
 * ESI Corporation Killmail Worker
 *
 * This worker fetches corporation killmails directly from ESI API using user's access token.
 * Requires: Director/CEO role + esi-killmails.read_corporation_killmails.v1 scope
 *
 * Features:
 * - Fetches corporation killmails from ESI (up to 50 pages = 2500 killmails)
 * - Automatically enriches related entities (characters, corps, etc.)
 * - Publishes GraphQL subscription events for real-time updates
 * - Handles duplicates gracefully
 * - Respects ESI rate limits
 *
 * Usage: yarn worker:corporation-killmails
 */
export async function esiCorporationKillmailWorker() {
  logger.info('🔄 ESI Corporation Killmail Worker Started');
  logger.info(`📦 Queue: ${QUEUE_NAME}`);
  logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent corporations`);
  logger.info(`🏢 Data Source: ESI API (corporation killmails)`);
  logger.info(`🔐 Required: Director/CEO + esi-killmails.read_corporation_killmails.v1\n`);

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
    logger.info('⏳ Waiting for corporation killmail jobs...\n');

    // Consume messages
    const consumerTag = await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) {
          logger.info('⚠️  Received null message from RabbitMQ');
          return;
        }

        logger.info('📨 Received message from queue!');

        try {
          const message: CorporationKillmailMessage = JSON.parse(msg.content.toString());

          logger.info(`\n${'━'.repeat(70)}`);
          logger.info(`🏢 Processing: ${message.corporationName} (ID: ${message.corporationId})`);
          logger.info(`👤 User: ${message.characterName} (ID: ${message.characterId})`);
          logger.info(`🆔 User ID: ${message.userId}`);
          logger.info(`📅 Queued at: ${message.queuedAt}`);
          logger.info('━'.repeat(70));

          // Validate token exists
          if (!message.accessToken || !message.refreshToken) {
            logger.error(`  ❌ No valid tokens available for user ${message.characterName}`);
            logger.error(`  ⏭️  Skipping - requires re-login via SSO`);
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
              logger.error(`  ⏭️  Skipping - refresh token invalid, requires re-login`);
              channel.ack(msg); // Acknowledge to remove from queue (don't retry)
              return;
            }
          } else {
            logger.info(`  ✅ Token is valid (expires: ${tokenExpiresAt.toISOString()})`);
          }

          // Token is now guaranteed to be valid - proceed with ESI sync
          await syncCorporationKillmailsFromESI(message, message.lastKillmailId);

          // Acknowledge message
          channel.ack(msg);
          logger.info(`✅ Completed: ${message.corporationName}\n`);
        } catch (error: any) {
          logger.error(`❌ Failed to process message:`, error.message);

          // Only requeue if it's a transient error (network, database, etc.)
          // Don't requeue auth errors or permission errors
          if (error.message.includes('Token') ||
            error.message.includes('403') ||
            error.message.includes('401') ||
            error.message.includes('Forbidden')) {
            logger.error(`  ⏭️  Skipping - authentication/permission error`);
            channel.ack(msg); // Don't retry auth/permission errors
          } else {
            logger.error(`  🔄 Requeuing for retry...`);
            channel.nack(msg, false, true); // Requeue for transient errors
          }
        }
      },
      { noAck: false }
    );

    logger.info(`📢 Consumer started with tag: ${consumerTag.consumerTag}`);
    logger.info(`📊 Ready to process messages from ${QUEUE_NAME}\n`);
  } catch (error) {
    logger.error('💥 Worker failed to start:', error);
    process.exit(1);
  }
}

/**
 * Fetch corporation killmails from ESI
 */
async function syncCorporationKillmailsFromESI(
  message: CorporationKillmailMessage,
  lastKillmailId?: number
): Promise<void> {
  try {
    if (lastKillmailId) {
      logger.info(`  📡 [${message.corporationName}] Fetching NEW corporation killmails from ESI (incremental sync)...`);
      logger.info(`     🔍 Will stop at killmail ID: ${lastKillmailId}`);
      logger.info(`     📄 Max pages: 50 (will stop earlier if last synced killmail is found)`);
    } else {
      logger.info(`  📡 [${message.corporationName}] Fetching corporation killmails from ESI (full sync)...`);
      logger.info(`     📄 Max pages: 50 (2,500 killmails max - 50 per page)`);
    }

    // Fetch killmail list from ESI (max 50 pages = 2500 killmails, 50 per page)
    // ESI returns killmails in reverse chronological order (newest first)
    const killmailList = await CorporationService.getCorporationKillmails(
      message.corporationId,
      message.accessToken,
      50, // Max pages (50 killmails per page)
      lastKillmailId // Stop when we hit this ID (incremental sync)
    );

    logger.info(`  📥 Total killmails found from ESI: ${killmailList.length}`);

    if (killmailList.length > 0) {
      logger.info(`  📄 First killmail: ID ${killmailList[0].killmail_id}, Hash ${killmailList[0].killmail_hash.substring(0, 10)}...`);
      logger.info(`  📄 Last killmail: ID ${killmailList[killmailList.length - 1].killmail_id}, Hash ${killmailList[killmailList.length - 1].killmail_hash.substring(0, 10)}...`);
    }

    if (killmailList.length === 0) {
      logger.info(`  ℹ️  No killmails found for this corporation`);
      return;
    }

    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    logger.info(`  💾 Processing killmails...\n`);

    // Process each killmail
    for (let i = 0; i < killmailList.length; i++) {
      const km = killmailList[i];

      try {
        // Progress indicator every 10 killmails for better visibility
        if (i > 0 && i % 10 === 0) {
          logger.info(`     📊 Progress: ${i}/${killmailList.length} (Saved: ${savedCount}, Skipped: ${skippedCount}, Errors: ${errorCount})`);
        }

        // Log first 3 killmails being processed
        if (i < 3) {
          logger.info(`     🔍 Processing killmail #${i + 1}: ID ${km.killmail_id}`);
        }

        // Fetch full details from ESI (public endpoint, no token needed)
        const detail = await KillmailService.getKillmailDetail(
          km.killmail_id,
          km.killmail_hash
        );

        // ⚡ Calculate value fields before saving
        const values = await calculateKillmailValues({
          victim: { ship_type_id: detail.victim.ship_type_id },
          items: detail.victim.items?.map(item => ({
            item_type_id: item.item_type_id,
            quantity_destroyed: item.quantity_destroyed,
            quantity_dropped: item.quantity_dropped,
          })) || []
        });

        // Save to database in a transaction
        try {
          await prismaWorker.$transaction(async (tx) => {
            // 1. Create killmail record with cached values
            await tx.killmail.create({
              data: {
                killmail_id: km.killmail_id,
                killmail_hash: km.killmail_hash,
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

              // ⚡ Update daily aggregates in real-time
              await updateDailyAggregatesRealtime(tx, {
                killmail_time: new Date(detail.killmail_time),
                character_ids: detail.attackers.map(a => a.character_id || null),
                corporation_ids: detail.attackers.map(a => a.corporation_id || null),
                alliance_ids: detail.attackers.map(a => a.alliance_id || null),
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

          // ⚡ Insert into killmail_filters for fast GIN queries
          insertKillmailFilter({
            killmail_id: BigInt(km.killmail_id),
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
            logger.error(`Failed to insert killmail_filters for ${km.killmail_id}:`, error);
          });

          // Publish GraphQL subscription event for real-time updates
          try {
            await pubsub.publish('NEW_KILLMAIL', {
              killmailId: km.killmail_id,
            });
          } catch (pubsubError) {
            // Don't fail the entire operation if pubsub fails
            logger.error(`     ⚠️  Failed to publish subscription event:`, pubsubError);
          }

          savedCount++;
        } catch (createError: any) {
          // Handle duplicate killmails (already exists in database)
          if (createError.code === 'P2002') {
            skippedCount++;
            // Log first few skipped killmails
            if (skippedCount <= 3) {
              logger.info(`     ⏭️  Skipped (duplicate): ${km.killmail_id}`);
            }
          } else {
            throw createError;
          }
        }
      } catch (error: any) {
        errorCount++;
        logger.error(`     ❌ Failed to process killmail ${km.killmail_id}:`, error.message);
      }
    }

    // Final summary
    logger.info(`\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`  ✅ Saved: ${savedCount} new killmails`);
    logger.info(`  ⏭️  Skipped: ${skippedCount} (already in database)`);
    logger.info(`  ❌ Errors: ${errorCount}`);
    logger.info(`  📊 Total processed: ${killmailList.length}`);
    logger.info(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Update user's last corporation sync info for incremental syncs
    if (killmailList.length > 0) {
      const latestKillmailId = Math.max(...killmailList.map(km => km.killmail_id));
      await prismaWorker.user.update({
        where: { id: message.userId },
        data: {
          last_corp_killmail_sync_at: new Date(),
          last_corp_killmail_id: latestKillmailId,
        },
      });
      logger.info(`  💾 Updated last corporation sync info (latest killmail ID: ${latestKillmailId})`);
    } else {
      // Even if no killmails, update sync timestamp to avoid repeated empty checks
      await prismaWorker.user.update({
        where: { id: message.userId },
        data: {
          last_corp_killmail_sync_at: new Date(),
        },
      });
      logger.info(`  💾 Updated last corporation sync timestamp (no killmails found)`);
    }
  } catch (error: any) {
    logger.error(`  ❌ ESI sync failed for ${message.corporationName}:`, error.message);
    throw error;
  }
}

/**
 * Graceful shutdown handlers
 */
function setupShutdownHandlers() {
  process.on('SIGINT', () => {
    logger.info('\n⚠️  Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\n⚠️  Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
}

// Start the worker only if run directly (not imported)
if (require.main === module) {
  setupShutdownHandlers();
  esiCorporationKillmailWorker().catch((error) => {
    logger.error('💥 Worker crashed:', error);
    process.exit(1);
  });
}
