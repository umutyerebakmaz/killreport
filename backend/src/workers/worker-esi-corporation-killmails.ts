import type amqp from 'amqplib';
import { calculateKillmailValues } from '@helpers/calculate-killmail-values';
import { CorporationService } from '@services/corporation/corporation.service';
import { updateDailyAggregatesRealtime } from '@services/kill-stats-realtime';
import { insertKillmailFilter } from '@services/killmail-filters-realtime';
import { type KillmailSyncMessage } from '@services/killmail-sync-message';
import { KillmailService } from '@services/killmail/killmail.service';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { pubsub } from '@services/pubsub';
import { ensureAllQueuesExist, getRabbitMQChannel } from '@services/rabbitmq';
import { loadUserCredentials } from '@services/user-credentials';
import { handleWorkerError, isForbidden } from './worker-error';

const QUEUE_NAME = 'esi_corporation_killmails_queue';
const PREFETCH_COUNT = 1; // Process 1 corporation at a time to avoid rate limiting

/** What one corporation sync needs, resolved from the database up front. */
interface CorporationSyncContext {
  userId: number;
  characterName: string;
  corporationId: number;
  corporationName: string;
  accessToken: string;
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
  logger.info(
    `🔐 Required: Director/CEO + esi-killmails.read_corporation_killmails.v1\n`,
  );

  try {
    await ensureAllQueuesExist();
    const channel = await getRabbitMQChannel();

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

        let message: KillmailSyncMessage | undefined;

        try {
          message = JSON.parse(msg.content.toString()) as KillmailSyncMessage;

          logger.info(`\n${'━'.repeat(70)}`);
          logger.info(`🆔 User ID: ${message.userId}`);
          logger.info(`📅 Queued at: ${message.queuedAt}`);
          logger.info('━'.repeat(70));

          const credentials = await loadUserCredentials(
            message.userId,
            prismaWorker,
          );

          if (!credentials.ok) {
            // None of these is retryable: the user has to log in again
            // before any attempt can succeed. Ack and move on.
            logger.error(
              `  ❌ ${credentials.reason} for user ${message.userId}`,
            );
            logger.error(`  ⏭️  Skipping user - requires re-login via SSO`);
            channel.ack(msg);
            return;
          }

          const { user, accessToken } = credentials;

          if (!user.corporation_id) {
            // The publishers filter these out, but the filter is a shortcut,
            // not the rule: a user can leave a corporation between publish
            // and consume.
            logger.warn(
              `  ⏭️  ${user.character_name} has no corporation, skipping`,
            );
            channel.ack(msg);
            return;
          }

          const corporation = await prismaWorker.corporation.findUnique({
            where: { id: user.corporation_id },
            select: { name: true },
          });
          const corporationName =
            corporation?.name ?? `Corporation ${user.corporation_id}`;

          logger.info(
            `🏢 Processing: ${corporationName} (ID: ${user.corporation_id})`,
          );
          logger.info(
            `👤 User: ${user.character_name} (ID: ${user.character_id})`,
          );

          const lastKillmailId = message.fullSync
            ? undefined
            : (user.last_corp_killmail_id ?? undefined);

          await syncCorporationKillmailsFromESI(
            {
              userId: user.id,
              characterName: user.character_name,
              corporationId: user.corporation_id,
              corporationName,
              accessToken,
            },
            lastKillmailId,
          );

          // Acknowledge message
          channel.ack(msg);
          logger.info(`✅ Completed: ${corporationName}\n`);
        } catch (error) {
          // 403 is this worker's own case and is settled before the shared
          // path sees it; everything else falls through unchanged.
          if (
            message !== undefined &&
            (await settleForbidden(channel, msg, message.userId, error))
          ) {
            return;
          }

          // A malformed message throws here too - JSON.parse is inside the
          // try, so it settles through the same shared path rather than
          // escaping the consumer callback unhandled and unsettled.
          // 404, the 420 backoff and the attempt count all live in the
          // shared path now; this worker only says which message it was.
          await handleWorkerError(channel, msg, QUEUE_NAME, error, {
            warn: (m) => logger.warn(`  ${m} (user ${message?.userId})`),
            error: (m, e) =>
              logger.error(`  ${m} (user ${message?.userId})`, e),
          });
        }
      },
      { noAck: false },
    );

    logger.info(`📢 Consumer started with tag: ${consumerTag.consumerTag}`);
    logger.info(`📊 Ready to process messages from ${QUEUE_NAME}\n`);
  } catch (error) {
    logger.error('💥 Worker failed to start:', error);
    process.exit(1);
  }
}

/**
 * Settle a permission failure here rather than through the retry path.
 *
 * ESI answers 403 when the user is not a Director or CEO of the corporation,
 * or logged in without `esi-killmails.read_corporation_killmails.v1`. No
 * number of attempts changes either, and `killmail-sync-cron.ts` re-selects
 * anyone whose `last_corp_killmail_sync_at` is stale — so left to the shared
 * path the same user is queued every tick, burns all five attempts and parks,
 * every ten minutes for as long as they hold an account.
 *
 * Writing the timestamp is what ends that: it is a record that the attempt
 * happened, not a claim that killmails were read, and it drops the user out of
 * the publisher's selection for the next fifteen minutes. That leaves one
 * empty ESI call per user per fifteen minutes, and the user starts syncing on
 * their own the moment they gain the role — no second column to clear.
 *
 * Returns true when the message has been settled here. If the stamp cannot be
 * written the message is left alone and reported false, because acking it
 * without the row would drop the work while the loop it prevents stays.
 */
export async function settleForbidden(
  channel: amqp.Channel,
  msg: amqp.ConsumeMessage,
  userId: number,
  error: unknown,
): Promise<boolean> {
  if (!isForbidden(error)) return false;

  try {
    await prismaWorker.user.update({
      where: { id: userId },
      data: { last_corp_killmail_sync_at: new Date() },
    });
  } catch (stampError) {
    logger.error(
      `  ! could not record the 403 for user ${userId}; leaving the message to the retry path`,
      stampError,
    );
    return false;
  }

  logger.warn(
    `  ! user ${userId}: ESI returned 403 - not a Director/CEO, or missing esi-killmails.read_corporation_killmails.v1. Skipping.`,
  );
  channel.ack(msg);
  return true;
}

/**
 * Fetch corporation killmails from ESI
 */
async function syncCorporationKillmailsFromESI(
  ctx: CorporationSyncContext,
  lastKillmailId?: number,
): Promise<void> {
  try {
    if (lastKillmailId) {
      logger.info(
        `  📡 [${ctx.corporationName}] Fetching NEW corporation killmails from ESI (incremental sync)...`,
      );
      logger.info(`     🔍 Will stop at killmail ID: ${lastKillmailId}`);
      logger.info(
        `     📄 Max pages: 50 (will stop earlier if last synced killmail is found)`,
      );
    } else {
      logger.info(
        `  📡 [${ctx.corporationName}] Fetching corporation killmails from ESI (full sync)...`,
      );
      logger.info(`     📄 Max pages: 50 (2,500 killmails max - 50 per page)`);
    }

    // Fetch killmail list from ESI (max 50 pages = 2500 killmails, 50 per page)
    // ESI returns killmails in reverse chronological order (newest first)
    const killmailList = await CorporationService.getCorporationKillmails(
      ctx.corporationId,
      ctx.accessToken,
      50, // Max pages (50 killmails per page)
      lastKillmailId, // Stop when we hit this ID (incremental sync)
    );

    logger.info(`  📥 Total killmails found from ESI: ${killmailList.length}`);

    if (killmailList.length > 0) {
      logger.info(
        `  📄 First killmail: ID ${killmailList[0].killmail_id}, Hash ${killmailList[0].killmail_hash.substring(0, 10)}...`,
      );
      logger.info(
        `  📄 Last killmail: ID ${killmailList[killmailList.length - 1].killmail_id}, Hash ${killmailList[killmailList.length - 1].killmail_hash.substring(0, 10)}...`,
      );
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
          logger.info(
            `     📊 Progress: ${i}/${killmailList.length} (Saved: ${savedCount}, Skipped: ${skippedCount}, Errors: ${errorCount})`,
          );
        }

        // Log first 3 killmails being processed
        if (i < 3) {
          logger.info(
            `     🔍 Processing killmail #${i + 1}: ID ${km.killmail_id}`,
          );
        }

        // Fetch full details from ESI (public endpoint, no token needed)
        const detail = await KillmailService.getKillmailDetail(
          km.killmail_id,
          km.killmail_hash,
        );

        // ⚡ Calculate value fields before saving
        const values = await calculateKillmailValues({
          victim: { ship_type_id: detail.victim.ship_type_id },
          items:
            detail.victim.items?.map((item) => ({
              item_type_id: item.item_type_id,
              quantity_destroyed: item.quantity_destroyed,
              quantity_dropped: item.quantity_dropped,
              singleton: item.singleton,
            })) || [],
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
                character_ids: detail.attackers.map(
                  (a) => a.character_id || null,
                ),
                corporation_ids: detail.attackers.map(
                  (a) => a.corporation_id || null,
                ),
                alliance_ids: detail.attackers.map(
                  (a) => a.alliance_id || null,
                ),
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
            attacker_ship_type_ids: detail.attackers.map(
              (a) => a.ship_type_id || null,
            ),
            attacker_character_ids: detail.attackers.map(
              (a) => a.character_id || null,
            ),
            attacker_corporation_ids: detail.attackers.map(
              (a) => a.corporation_id || null,
            ),
            attacker_alliance_ids: detail.attackers.map(
              (a) => a.alliance_id || null,
            ),
          }).catch((error) => {
            logger.error(
              `Failed to insert killmail_filters for ${km.killmail_id}:`,
              error,
            );
          });

          // Publish GraphQL subscription event for real-time updates
          try {
            await pubsub.publish('NEW_KILLMAIL', {
              killmailId: km.killmail_id,
            });
          } catch (pubsubError) {
            // Don't fail the entire operation if pubsub fails
            logger.error(
              `     ⚠️  Failed to publish subscription event:`,
              pubsubError,
            );
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
        logger.error(
          `     ❌ Failed to process killmail ${km.killmail_id}:`,
          error.message,
        );
      }
    }

    // Final summary
    logger.info(
      `\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
    logger.info(`  ✅ Saved: ${savedCount} new killmails`);
    logger.info(`  ⏭️  Skipped: ${skippedCount} (already in database)`);
    logger.info(`  ❌ Errors: ${errorCount}`);
    logger.info(`  📊 Total processed: ${killmailList.length}`);
    logger.info(
      `  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
    );

    // Update user's last corporation sync info for incremental syncs
    if (killmailList.length > 0) {
      const latestKillmailId = Math.max(
        ...killmailList.map((km) => km.killmail_id),
      );
      await prismaWorker.user.update({
        where: { id: ctx.userId },
        data: {
          last_corp_killmail_sync_at: new Date(),
          last_corp_killmail_id: latestKillmailId,
        },
      });
      logger.info(
        `  💾 Updated last corporation sync info (latest killmail ID: ${latestKillmailId})`,
      );
    } else {
      // Even if no killmails, update sync timestamp to avoid repeated empty checks
      await prismaWorker.user.update({
        where: { id: ctx.userId },
        data: {
          last_corp_killmail_sync_at: new Date(),
        },
      });
      logger.info(
        `  💾 Updated last corporation sync timestamp (no killmails found)`,
      );
    }
  } catch (error: any) {
    logger.error(
      `  ❌ ESI sync failed for ${ctx.corporationName}:`,
      error.message,
    );
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
