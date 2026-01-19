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
import { AllianceService } from '../services/alliance/alliance.service';
import { CharacterService } from '../services/character/character.service';
import { CorporationService } from '../services/corporation/corporation.service';
import { KillmailDetail, KillmailService } from '../services/killmail';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { pubsub } from '../services/pubsub';
import { TypeService } from '../services/type/type.service';

// Feature flag to disable enrichment (to prevent connection pool exhaustion)
const ENABLE_ENRICHMENT = process.env.REDISQ_ENABLE_ENRICHMENT !== 'false';

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

// Shutdown flag and interval tracking
let isShuttingDown = false;
let emptyCheckInterval: NodeJS.Timeout | null = null;

// Statistics
let stats = {
  received: 0,
  saved: 0,
  skipped: 0,
  errors: 0,
  enriched: 0, // Yeni: enrichment yapılan entity sayısı
  enrichmentFailed: 0, // Başarısız enrichment sayısı
  startTime: new Date(),
};

/**
 * Main worker loop
 */
export async function redisQStreamWorker() {
  while (!isShuttingDown) {
    logger.info('🌊 RedisQ Stream Worker Started');
    logger.info(`📡 Endpoint: ${REDISQ_URL}`);
    logger.info(`🆔 Queue ID: ${QUEUE_ID}`);
    logger.info(`⏱️  Poll Rate: ${REQUEST_DELAY}ms (~${Math.floor(1000 / REQUEST_DELAY)} req/sec)`);
    logger.info(`⏳ Timeout: ${TIME_TO_WAIT} seconds`);
    logger.info(`🔧 Enrichment: ${ENABLE_ENRICHMENT ? 'ENABLED' : 'DISABLED'}\n`);
    logger.info('━'.repeat(60));
    logger.info('🎯 Listening for killmails...\n');

    let consecutiveErrors = 0;

    try {
      while (!isShuttingDown) {
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
    } catch (error) {
      if (isShuttingDown) break;
      logger.error('💥 Worker connection lost, reconnecting in 5s...', error);
      await sleep(5000);
    }
  }

  // Cleanup
  logger.info('🧹 Worker cleanup completed');
  await prismaWorker.$disconnect();
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

    // 🚀 YENİ: Killmail'i kaydetmeden önce eksik entity'leri ESI'dan çek
    // Can be disabled with REDISQ_ENABLE_ENRICHMENT=false to reduce DB load
    if (ENABLE_ENRICHMENT) {
      await enrichMissingEntities(killmail);
    } else {
      logger.debug('⚠️  Enrichment disabled (REDISQ_ENABLE_ENRICHMENT=false)');
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
      `Stats: ${stats.saved} saved, ${stats.skipped} skipped, ` +
      `${stats.enriched} enriched (${stats.enrichmentFailed} failed), ${stats.errors} errors ` +
      `(${runtime}s runtime)`
    );
  } catch (error: any) {
    stats.errors++;
    logger.error(`❌ Failed to process killmail ${killID}:`, error);
    // Don't re-throw - continue processing next killmail
  }
}

/**
 * Enrich missing entities (character, corporation, alliance, type) before saving killmail
 * Bu fonksiyon transaction öncesinde çalışır ve tüm eksik entity'leri ESI'dan çeker
 */
async function enrichMissingEntities(killmail: KillmailDetail): Promise<void> {
  const enrichmentStart = Date.now();

  // Local counters for this enrichment run
  let enrichedCount = 0;
  let failedCount = 0;

  // 1. Tüm unique ID'leri topla
  const characterIds = new Set<number>();
  const corporationIds = new Set<number>();
  const allianceIds = new Set<number>();
  const typeIds = new Set<number>();

  // Victim'dan ID'leri topla
  if (killmail.victim.character_id) characterIds.add(killmail.victim.character_id);
  if (killmail.victim.corporation_id) corporationIds.add(killmail.victim.corporation_id);
  if (killmail.victim.alliance_id) allianceIds.add(killmail.victim.alliance_id);
  if (killmail.victim.ship_type_id) typeIds.add(killmail.victim.ship_type_id);

  // Attackers'dan ID'leri topla
  killmail.attackers.forEach((attacker) => {
    if (attacker.character_id) characterIds.add(attacker.character_id);
    if (attacker.corporation_id) corporationIds.add(attacker.corporation_id);
    if (attacker.alliance_id) allianceIds.add(attacker.alliance_id);
    if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id);
    if (attacker.weapon_type_id) typeIds.add(attacker.weapon_type_id);
  });

  // Items'dan type ID'leri topla (including nested items in containers)
  if (killmail.victim.items) {
    killmail.victim.items.forEach((item) => {
      if (item.item_type_id) typeIds.add(item.item_type_id);

      // Handle nested items (cargo containers, ships with items inside)
      if (item.items && Array.isArray(item.items)) {
        item.items.forEach((nestedItem) => {
          if (nestedItem.item_type_id) typeIds.add(nestedItem.item_type_id);
        });
      }
    });
  }

  const allCharacterIds = Array.from(characterIds);

  logger.debug(
    `🔍 Checking entities: ${allCharacterIds.length} chars, ${corporationIds.size} corps, ` +
    `${allianceIds.size} alliances, ${typeIds.size} types`
  );

  // 2. Database'de eksik olanları bul
  const [existingChars, existingCorps, existingAlliances, existingTypes] = await Promise.all([
    allCharacterIds.length > 0
      ? prismaWorker.character.findMany({
        where: { id: { in: allCharacterIds } },
        select: { id: true },
      })
      : [],
    corporationIds.size > 0
      ? prismaWorker.corporation.findMany({
        where: { id: { in: Array.from(corporationIds) } },
        select: { id: true },
      })
      : [],
    allianceIds.size > 0
      ? prismaWorker.alliance.findMany({
        where: { id: { in: Array.from(allianceIds) } },
        select: { id: true },
      })
      : [],
    typeIds.size > 0
      ? prismaWorker.type.findMany({
        where: { id: { in: Array.from(typeIds) } },
        select: { id: true },
      })
      : [],
  ]);

  const existingCharIds = new Set(existingChars.map((c) => c.id));
  const existingCorpIds = new Set(existingCorps.map((c) => c.id));
  const existingAllianceIds = new Set(existingAlliances.map((a) => a.id));
  const existingTypeIds = new Set(existingTypes.map((t) => t.id));

  const missingCharIds = allCharacterIds.filter((id) => !existingCharIds.has(id));
  const missingCorpIds = Array.from(corporationIds).filter((id) => !existingCorpIds.has(id));
  const missingAllianceIds = Array.from(allianceIds).filter((id) => !existingAllianceIds.has(id));
  const missingTypeIds = Array.from(typeIds).filter((id) => !existingTypeIds.has(id));

  const totalMissing =
    missingCharIds.length + missingCorpIds.length + missingAllianceIds.length + missingTypeIds.length;

  if (totalMissing === 0) {
    logger.info('✅ All entities exist in database');
    return;
  }

  logger.info(
    `🔧 Enriching ${totalMissing} missing entities: ` +
    `${missingCharIds.length} chars, ${missingCorpIds.length} corps, ` +
    `${missingAllianceIds.length} alliances, ${missingTypeIds.length} types`
  );

  // 3. ESI'dan eksik entity'leri çek ve kaydet (batch processing)
  // Process 10 items at a time for better performance
  const BATCH_SIZE = 10;

  // Helper function for batch processing
  async function processBatch<T>(items: T[], processor: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(processor));
    }
  }

  // ⚠️ IMPORTANT: Process in dependency order
  // 1. Alliances first (no dependencies)
  // 2. Corporations second (may depend on alliances)
  // 3. Characters third (may depend on corporations)
  // 4. Types last (no dependencies)

  // Alliances (batch processing) - FIRST!
  await processBatch(missingAllianceIds, async (allianceId) => {
    try {
      const allianceInfo = await AllianceService.getAllianceInfo(allianceId);
      await prismaWorker.alliance.upsert({
        where: { id: allianceId },
        create: {
          id: allianceId,
          name: allianceInfo.name,
          ticker: allianceInfo.ticker,
          date_founded: new Date(allianceInfo.date_founded),
          creator_corporation_id: allianceInfo.creator_corporation_id,
          creator_id: allianceInfo.creator_id,
          executor_corporation_id: allianceInfo.executor_corporation_id,
          faction_id: allianceInfo.faction_id || null,
        },
        update: {},
      });
      enrichedCount++;
      stats.enriched++;
      logger.info(`  ✓ Alliance ${allianceId} enriched`);
    } catch (error: any) {
      failedCount++;
      stats.enrichmentFailed++;
      const statusCode = error?.response?.status || 'unknown';
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      logger.warn(`  ✗ Alliance ${allianceId} failed (${statusCode}): ${errorMsg}`);
    }
  });

  // Corporations (batch processing) - SECOND!
  await processBatch(missingCorpIds, async (corpId) => {
    try {
      logger.debug(`  🔄 Fetching corporation ${corpId} from ESI...`);
      const corpInfo = await CorporationService.getCorporationInfo(corpId);

      logger.debug(`  💾 Saving corporation ${corpId} to database...`);
      await prismaWorker.corporation.upsert({
        where: { id: corpId },
        create: {
          id: corpId,
          name: corpInfo.name,
          ticker: corpInfo.ticker,
          alliance_id: corpInfo.alliance_id || null,
          ceo_id: corpInfo.ceo_id,
          creator_id: corpInfo.creator_id,
          date_founded: new Date(corpInfo.date_founded),
          member_count: corpInfo.member_count,
          tax_rate: corpInfo.tax_rate || 0,
        },
        update: {},
      });
      enrichedCount++;
      stats.enriched++;
      logger.info(`  ✓ Corporation ${corpId} (${corpInfo.name} [${corpInfo.ticker}]) enriched successfully`);
    } catch (error: any) {
      failedCount++;
      stats.enrichmentFailed++;

      // Detaylı error logging
      const statusCode = error?.response?.status || error?.code || 'unknown';
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';

      logger.error(`  ✗ Corporation ${corpId} FAILED:`);
      logger.error(`     Status: ${statusCode}`);
      logger.error(`     Message: ${errorMsg}`);

      // Database constraint error'ları için özel handling
      if (error?.code === 'P2003') {
        logger.error(`     Type: Foreign key constraint violation`);
        logger.error(`     Meta: ${JSON.stringify(error?.meta || {})}`);
      } else if (error?.code?.startsWith('P')) {
        logger.error(`     Type: Prisma error (${error.code})`);
        logger.error(`     Meta: ${JSON.stringify(error?.meta || {})}`);
      } else if (error?.response?.status === 404) {
        logger.error(`     Type: Corporation not found in ESI (deleted/NPC)`);
      } else if (error?.response?.status === 429) {
        logger.error(`     Type: ESI rate limit exceeded`);
      } else {
        logger.error(`     Type: Unknown error`);
        logger.error(`     Stack: ${error?.stack?.split('\n')[0]}`);
      }
    }
  });

  // Characters (batch processing) - THIRD!
  await processBatch(missingCharIds, async (charId) => {
    try {
      const charInfo = await CharacterService.getCharacterInfo(charId);
      await prismaWorker.character.upsert({
        where: { id: charId },
        create: {
          id: charId,
          name: charInfo.name,
          corporation_id: charInfo.corporation_id,
          alliance_id: charInfo.alliance_id || null,
          birthday: new Date(charInfo.birthday),
          bloodline_id: charInfo.bloodline_id,
          race_id: charInfo.race_id,
          gender: charInfo.gender,
          security_status: charInfo.security_status || 0,
        },
        update: {},
      });
      enrichedCount++;
      stats.enriched++;
      logger.debug(`  ✓ Character ${charId} enriched`);
    } catch (error: any) {
      failedCount++;
      stats.enrichmentFailed++;
      const statusCode = error?.response?.status || 'unknown';
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      logger.warn(`  ✗ Character ${charId} failed (${statusCode}): ${errorMsg}`);
    }
  });

  // Types (batch processing) - FOURTH!
  await processBatch(missingTypeIds, async (typeId) => {
    try {
      const typeInfo = await TypeService.getTypeInfo(typeId);
      await prismaWorker.type.upsert({
        where: { id: typeId },
        create: {
          id: typeId,
          name: typeInfo.name,
          description: typeInfo.description || '',
          published: typeInfo.published,
          group_id: typeInfo.group_id,
          mass: typeInfo.mass || null,
          volume: typeInfo.volume || null,
          capacity: typeInfo.capacity || null,
        },
        update: {},
      });
      enrichedCount++;
      stats.enriched++;
      logger.debug(`  ✓ Type ${typeId} enriched`);
    } catch (error: any) {
      failedCount++;
      stats.enrichmentFailed++;
      const statusCode = error?.response?.status || 'unknown';
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      logger.warn(`  ✗ Type ${typeId} failed (${statusCode}): ${errorMsg}`);
    }
  });

  const enrichmentTime = Date.now() - enrichmentStart;
  logger.info(
    `✅ Enrichment completed in ${enrichmentTime}ms ` +
    `(${enrichedCount} succeeded, ${failedCount} failed)`
  );
}

/**
 * Flatten nested items (containers, cargo holds, etc.)
 * ESI returns items in a tree structure where containers have nested items.
 * We need to flatten this to save all items to the database.
 */
function flattenItems(items: KillmailDetail['victim']['items']): NonNullable<KillmailDetail['victim']['items']> {
  if (!items || items.length === 0) return [];

  const flatItems: NonNullable<KillmailDetail['victim']['items']> = [];

  items.forEach((item) => {
    // Add the main item
    flatItems.push(item);

    // Recursively flatten nested items (cargo, modules with charges, etc.)
    if (item.items && Array.isArray(item.items)) {
      const nestedFlat = flattenItems(item.items);
      flatItems.push(...nestedFlat);
    }
  });

  return flatItems;
}

/**
 * Save killmail to database with attackers and victim
 * Returns true if new killmail was created, false if already existed
 */
async function saveKillmail(killmail: KillmailDetail, hash: string): Promise<boolean> {
  const { victim, attackers, killmail_time, solar_system_id } = killmail;

  try {
    // Check if already exists BEFORE transaction (cheaper)
    const existing = await prismaWorker.victim.findUnique({
      where: { killmail_id: killmail.killmail_id },
      select: { killmail_id: true },
    });

    if (existing) {
      return false; // Already exists
    }

    // Create killmail with attackers and victim in a transaction
    await prismaWorker.$transaction(async (tx) => {
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

      // Create items (dropped/destroyed) - including nested items
      if (victim.items && victim.items.length > 0) {
        // Flatten nested items (cargo containers, fitted modules with charges, etc.)
        const allItems = flattenItems(victim.items);

        // ⚠️ Filter out items with null/undefined item_type_id (invalid data from ESI)
        const validItems = allItems.filter((item) => item.item_type_id != null);
        const invalidItemsCount = allItems.length - validItems.length;

        if (invalidItemsCount > 0) {
          logger.warn(
            `   ⚠️  Skipping ${invalidItemsCount} invalid items (null item_type_id) for killmail ${killmail.killmail_id}`
          );
        }

        if (validItems.length > 0) {
          logger.debug(
            `   💾 Saving ${validItems.length} items (${victim.items.length} top-level, ` +
            `${validItems.length - victim.items.length} nested) for killmail ${killmail.killmail_id}`
          );
          await tx.killmailItem.createMany({
            skipDuplicates: true,
            data: validItems.map((item) => ({
              killmail_id: killmail.killmail_id,
              item_type_id: item.item_type_id,
              flag: item.flag,
              quantity_dropped: item.quantity_dropped || null,
              quantity_destroyed: item.quantity_destroyed || null,
              singleton: item.singleton,
            })),
          });
        } else {
          logger.debug(`   ℹ️  No valid items to save for killmail ${killmail.killmail_id}`);
        }
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

    // Log detailed error for debugging
    logger.error(`❌ Transaction failed for killmail ${killmail.killmail_id}:`);
    logger.error(`   Error code: ${error?.code || 'unknown'}`);
    logger.error(`   Error message: ${error?.message || 'unknown'}`);
    if (error?.meta) {
      logger.error(`   Error meta: ${JSON.stringify(error.meta)}`);
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
function setupShutdownHandlers() {
  const shutdown = async () => {
    isShuttingDown = true;
    if (emptyCheckInterval) {
      clearInterval(emptyCheckInterval);
      emptyCheckInterval = null;
    }
    logger.info('\n\n🛑 Shutting down RedisQ stream worker...');
    logger.info('\n📊 Final Statistics:');
    logger.info(`   Received: ${stats.received}`);
    logger.info(`   Saved: ${stats.saved}`);
    logger.info(`   Skipped: ${stats.skipped}`);
    logger.info(`   Enriched: ${stats.enriched} (${stats.enrichmentFailed} failed)`);
    logger.info(`   Errors: ${stats.errors}`);
    const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
    logger.info(`   Runtime: ${runtime} seconds`);
    await prismaWorker.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

setupShutdownHandlers();

// Start the worker
redisQStreamWorker().catch((error) => {
  logger.error('💥 Worker crashed:', error);
  process.exit(1);
});
