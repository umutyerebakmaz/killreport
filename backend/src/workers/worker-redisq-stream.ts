/**
 * zKillboard RedisQ Real-Time Stream Worker
 *
 * Continuously polls zkillredisq.stream for new killmails as they happen.
 * This provides real-time killmail sync without waiting for manual character syncs.
 *
 * How it works:
 * 1. Poll RedisQ endpoint every ~1 second
 * 2. Receive killmail ID + hash (no full killmail data after Dec 1, 2025)
 * 3. Fetch full killmail from ESI using ID+hash
 * 4. Save to database with attacker info
 * 5. Repeat indefinitely
 *
 * Rate Limits:
 * - RedisQ: 2 requests per second per IP (CloudFlare enforced)
 * - ESI: 150 req/sec (we use conservative 50 req/sec)
 *
 * Usage:
 *   yarn worker:redisq
 */

import '../config';
import { KillmailDetail, KillmailService } from '../services/killmail';
import logger from '../services/logger';
import prisma from '../services/prisma';
import { pubsub } from '../services/pubsub';

// Debug: Verify pubsub is loaded
logger.debug('Debug: pubsub type: ' + typeof pubsub);
if (!pubsub) {
  logger.error('CRITICAL: pubsub is not defined at module load time!');
  process.exit(1);
}

const REDISQ_URL = 'https://zkillredisq.stream/listen.php';
const QUEUE_ID = 'killreport-stream'; // Unique identifier for our service
const TIME_TO_WAIT = 1; // 1 second timeout if no killmail (min: 1, max: 10)
const REQUEST_DELAY = 500; // 500ms between requests (2 req/sec = CloudFlare limit)
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

interface RedisQPackage {
  killID: number;
  zkb: {
    locationID: number;
    hash: string;
    fittedValue: number;
    droppedValue: number;
    destroyedValue: number;
    totalValue: number;
    points: number;
    npc: boolean;
    solo: boolean;
    awox: boolean;
    labels: string[];
    href: string; // ESI endpoint URL
  };
}

interface RedisQResponse {
  package: RedisQPackage | null;
}

// Statistics
let stats = {
  received: 0,
  saved: 0,
  skipped: 0,
  errors: 0,
  startTime: new Date(),
};

/**
 * Main worker loop
 */
export async function redisQStreamWorker() {
  logger.info('🌊 RedisQ Stream Worker Started');
  logger.info(`📡 Endpoint: ${REDISQ_URL}`);
  logger.info(`🆔 Queue ID: ${QUEUE_ID}`);
  logger.info(`⏱️  Poll Rate: ${REQUEST_DELAY}ms (~${Math.floor(1000 / REQUEST_DELAY)} req/sec)`);
  logger.info(`⏳ Timeout: ${TIME_TO_WAIT} seconds\n`);
  logger.info('━'.repeat(60));
  logger.info('🎯 Listening for killmails...\n');

  let consecutiveErrors = 0;

  while (true) {
    try {
      const killmail = await pollRedisQ();

      if (killmail) {
        stats.received++;
        await processKillmail(killmail);
        consecutiveErrors = 0; // Reset error counter on success
      }

      // Rate limiting: wait before next request
      await sleep(REQUEST_DELAY);
    } catch (error) {
      consecutiveErrors++;
      stats.errors++;
      logger.error(`❌ Error in main loop (${consecutiveErrors} consecutive):`, error);

      // If too many consecutive errors, back off longer
      if (consecutiveErrors >= 5) {
        logger.warn(`⚠️  Too many errors, backing off for ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
        consecutiveErrors = 0;
      } else {
        await sleep(REQUEST_DELAY);
      }
    }
  }
}

/**
 * Poll RedisQ for next killmail
 */
async function pollRedisQ(): Promise<RedisQPackage | null> {
  const url = `${REDISQ_URL}?queueID=${QUEUE_ID}&ttw=${TIME_TO_WAIT}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Killreport Real-Time Sync - github.com/umutyerebakmaz/killreport',
      },
      redirect: 'follow', // Follow redirects to /object.php
    });

    if (!response.ok) {
      if (response.status === 429) {
        logger.warn('⚠️  Rate limited by RedisQ (429), backing off...');
        await sleep(RETRY_DELAY);
        return null;
      }
      throw new Error(`RedisQ error: ${response.status} ${response.statusText}`);
    }

    const data: RedisQResponse = await response.json();
    return data.package;
  } catch (error) {
    throw new Error(`Failed to poll RedisQ: ${error}`);
  }
}

/**
 * Process a killmail package from RedisQ
 */
async function processKillmail(pkg: RedisQPackage): Promise<void> {
  const { killID, zkb } = pkg;

  try {
    // Fetch full killmail from ESI
    logger.info(`📥 Fetching: ${killID} (${formatISK(zkb.totalValue)} ISK)`);
    const killmail = await KillmailService.getKillmailDetail(killID, zkb.hash);

    // Debug: Log items count
    const itemCount = killmail.victim.items?.length || 0;
    if (itemCount > 0) {
      logger.debug(`   📦 Items found: ${itemCount}`);
    }

    // Save to database (upsert handles duplicates)
    const isNew = await saveKillmail(killmail, zkb.hash);

    if (!isNew) {
      stats.skipped++;
      logger.debug(`⏭️  Skipped: ${killID} (already exists)`);
      return;
    }

    stats.saved++;

    const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
    logger.info(
      `✅ Saved: ${killID} | ` +
      `Stats: ${stats.saved} saved, ${stats.skipped} skipped, ${stats.errors} errors ` +
      `(${runtime}s runtime)`
    );
  } catch (error: any) {
    stats.errors++;
    logger.error(`❌ Failed to process killmail ${killID}:`, error);
    // Don't re-throw - continue processing next killmail
  }
}

/**
 * Save killmail to database with attackers and victim
 * Returns true if new killmail was created, false if already existed
 */
async function saveKillmail(killmail: KillmailDetail, hash: string): Promise<boolean> {
  const { victim, attackers, killmail_time, solar_system_id } = killmail;

  try {
    // Check if already exists BEFORE transaction (cheaper)
    const existing = await prisma.victim.findUnique({
      where: { killmail_id: killmail.killmail_id },
      select: { killmail_id: true },
    });

    if (existing) {
      return false; // Already exists
    }

    // Create killmail with attackers and victim in a transaction
    await prisma.$transaction(async (tx) => {
      // Create the killmail
      await tx.killmail.create({
        data: {
          killmail_id: killmail.killmail_id,
          killmail_hash: hash,
          killmail_time: new Date(killmail_time),
          solar_system_id,
        },
      });

      // Create victim
      await tx.victim.create({
        data: {
          killmail_id: killmail.killmail_id,
          character_id: victim.character_id || null,
          corporation_id: victim.corporation_id,
          alliance_id: victim.alliance_id || null,
          ship_type_id: victim.ship_type_id,
          damage_taken: victim.damage_taken,
          position_x: victim.position?.x || null,
          position_y: victim.position?.y || null,
          position_z: victim.position?.z || null,
          faction_id: null,
        },
      });

      // Create attackers
      if (attackers.length > 0) {
        await tx.attacker.createMany({
          skipDuplicates: true,
          data: attackers.map((attacker) => ({
            killmail_id: killmail.killmail_id,
            character_id: attacker.character_id || null,
            corporation_id: attacker.corporation_id || null,
            alliance_id: attacker.alliance_id || null,
            ship_type_id: attacker.ship_type_id || null,
            weapon_type_id: attacker.weapon_type_id || null,
            damage_done: attacker.damage_done,
            final_blow: attacker.final_blow,
            security_status: attacker.security_status ?? null,
            faction_id: null,
          })),
        });
      }

      // Create items (dropped/destroyed)
      if (victim.items && victim.items.length > 0) {
        logger.debug(`   💾 Saving ${victim.items.length} items for killmail ${killmail.killmail_id}`);
        await tx.killmailItem.createMany({
          skipDuplicates: true,
          data: victim.items.map((item) => ({
            killmail_id: killmail.killmail_id,
            item_type_id: item.item_type_id,
            flag: item.flag,
            quantity_dropped: item.quantity_dropped || null,
            quantity_destroyed: item.quantity_destroyed || null,
            singleton: item.singleton,
          })),
        });
      } else {
        logger.debug(`   ℹ️  No items to save for killmail ${killmail.killmail_id}`);
      }
    });

    // Publish new killmail event to subscribers (only ID - resolver will fetch full data)
    logger.debug('📡 Publishing NEW_KILLMAIL event for killmail: ' + killmail.killmail_id);
    await pubsub.publish('NEW_KILLMAIL', {
      killmailId: killmail.killmail_id,
    });

    return true; // Successfully created new killmail
  } catch (error: any) {
    // If duplicate error, it means race condition happened
    if (error?.code === 'P2002') {
      return false; // Not new, already exists
    }
    throw error; // Re-throw other errors
  }
}

/**
 * Format ISK value for display
 */
function formatISK(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toString();
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  logger.info('\n\n🛑 Shutting down RedisQ stream worker...');
  logger.info('\n📊 Final Statistics:');
  logger.info(`   Received: ${stats.received}`);
  logger.info(`   Saved: ${stats.saved}`);
  logger.info(`   Skipped: ${stats.skipped}`);
  logger.info(`   Errors: ${stats.errors}`);
  const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  logger.info(`   Runtime: ${runtime} seconds`);
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker
redisQStreamWorker().catch((error) => {
  logger.error('💥 Worker crashed:', error);
  process.exit(1);
});
