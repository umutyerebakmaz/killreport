/**
 * zKillboard R2Z2 Real-Time Stream Worker
 *
 * Continuously polls zKillboard's R2Z2 API for new killmails as they happen.
 * This provides real-time killmail sync without waiting for manual character syncs.
 *
 * NOTE: The old RedisQ service (zkillredisq.stream/listen.php) was sunset on
 * May 31, 2026 and its hostname now resolves to 127.0.0.1 (dead). R2Z2 is the
 * official replacement. See https://github.com/zKillboard/zKillboard/wiki/API-(R2Z2)
 *
 * How it works:
 * 1. Resume from the saved `stream_cursors` row, or start at the head from
 *    /ephemeral/sequence.json when there is none
 * 2. Poll /ephemeral/{sequence}.json, incrementing sequence on each hit
 *    - 200 → killmail payload (killmail_id + hash + esi + zkb), advance sequence
 *    - 404 → no killmail at this sequence yet, wait >= 6s and retry same sequence;
 *      a number the head has passed is skipped after three tries (stream-cursor.ts)
 *    The sequence is saved after every settled killmail, so a restart loses none.
 * 3. Use the ESI killmail already embedded in the payload; fall back to fetching
 *    it from ESI by ID+hash only if that embedded copy is missing or malformed
 * 4. Save to database with attacker info; one that cannot be written goes to
 *    killmail_refs for the detail pipeline. If even that fails, the sequence
 *    stays where it is and the killmail is read again.
 * 5. Repeat indefinitely
 *
 * Rate Limits:
 * - R2Z2: 15 requests per second per IP (aggressive polling risks HTTP 403)
 * - ESI: no fixed ceiling; esiClient and the limiter pace requests from its headers
 *
 * Usage:
 *   yarn worker:redisq
 */

import { characterTitleFields } from '@helpers/character-achievement';
import { AllianceService } from '@services/alliance/alliance.service';
import { CharacterService } from '@services/character/character.service';
import { CorporationService } from '@services/corporation/corporation.service';
import { setEsiMaxWait, setEsiPriority } from '@services/esi-client';
import { KillmailDetail, KillmailService } from '@services/killmail';
import { recordRefs } from '@services/killmail-refs';
import { saveKillmail } from '@services/killmail-writer';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { pubsub } from '@services/pubsub';
import {
  emptyGap,
  loadCursor,
  onFound,
  onNotFound,
  saveCursor,
} from '@services/redisq/stream-cursor';
import { TypeService } from '@services/type/type.service';

// Feature flag to disable enrichment (to prevent connection pool exhaustion)
const ENABLE_ENRICHMENT = process.env.REDISQ_ENABLE_ENRICHMENT !== 'false';

// Debug: Verify pubsub is loaded
logger.debug('debug: pubsub type: ' + typeof pubsub);
if (!pubsub) {
  logger.error('critical: pubsub is not defined at module load time!');
  process.exit(1);
}

const R2Z2_BASE = 'https://r2z2.zkillboard.com/ephemeral';
const SEQUENCE_URL = `${R2Z2_BASE}/sequence.json`;
const BACKLOG_DELAY = 100; // 100ms between hits while draining backlog (~10 req/sec < 15 limit)
const EMPTY_DELAY = 6000; // >= 6s wait on 404 (no new killmail yet), per R2Z2 docs
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
  /**
   * The full ESI killmail, as shipped inside the R2Z2 payload. Present in
   * normal operation; absent only if the payload shape changes, in which case
   * processKillmail falls back to fetching it from ESI.
   */
  esi?: KillmailDetail;
}

// R2Z2 /ephemeral/{sequence}.json payload
interface R2Z2Killmail {
  killmail_id: number;
  hash: string;
  esi: unknown; // validated in pollR2Z2 before being passed on
  zkb: RedisQPackage['zkb'];
  uploaded_at?: string;
  sequence_id: number;
}

// Shutdown flag
let isShuttingDown = false;

// R2Z2 sequence cursor: the next number to read, mirrored in stream_cursors
let currentSequence: number | null = null;
// The run of 404s the head has passed (stream-cursor.ts)
const gap = emptyGap();

// Statistics
let stats = {
  received: 0,
  saved: 0,
  skipped: 0,
  errors: 0,
  enriched: 0, // New: number of entities enriched
  enrichmentFailed: 0, // Number of failed enrichments
  startTime: new Date(),
};

/**
 * Main worker loop
 */
export async function redisQStreamWorker() {
  // Live stream: a killmail must not stall behind a long ESI brake (10 s cap),
  // and draws the shared ESI budget ahead of bulk work.
  setEsiMaxWait(10_000);
  setEsiPriority('live');

  while (!isShuttingDown) {
    logger.info('🌊 R2Z2 stream worker started');
    logger.info(`📡 endpoint: ${R2Z2_BASE}/{sequence}.json`);
    logger.info(
      `⏱️  poll rate: ${BACKLOG_DELAY}ms while draining (~${Math.floor(1000 / BACKLOG_DELAY)} req/sec, limit 15)`,
    );
    logger.info(`⏳ idle wait: ${EMPTY_DELAY}ms on 404 (no new killmail)`);
    logger.info(
      `🔧 enrichment: ${ENABLE_ENRICHMENT ? 'enabled' : 'disabled'}\n`,
    );
    logger.info('━'.repeat(60));

    // Initialize sequence cursor from R2Z2 (only once; survives reconnect loops)
    if (currentSequence === null) {
      await initSequence();
    }

    logger.info(
      `🎯 listening for killmails from sequence ${currentSequence}...\n`,
    );

    let consecutiveErrors = 0;

    try {
      while (!isShuttingDown) {
        try {
          const delay = await step();
          consecutiveErrors = 0; // Reset error counter on success
          await sleep(delay);
        } catch (error) {
          consecutiveErrors++;
          stats.errors++;
          logger.error(
            `❌ error in main loop (${consecutiveErrors} consecutive):`,
            error,
          );

          // If too many consecutive errors, back off longer
          if (consecutiveErrors >= 5) {
            logger.warn(
              `⚠️  too many errors, backing off for ${RETRY_DELAY}ms...`,
            );
            await sleep(RETRY_DELAY);
            consecutiveErrors = 0;
          } else {
            await sleep(BACKLOG_DELAY);
          }
        }
      }
    } catch (error) {
      if (isShuttingDown) break;
      logger.error('💥 worker connection lost, reconnecting in 5s...', error);
      await sleep(5000);
    }
  }

  // Cleanup
  logger.info('🧹 worker cleanup completed');
  await prismaWorker.$disconnect();
}

const R2Z2_HEADERS = {
  'User-Agent':
    'Killreport Real-Time Sync - github.com/umutyerebakmaz/killreport',
};

/** The newest sequence R2Z2 has published. */
async function fetchHead(): Promise<number> {
  const response = await fetch(SEQUENCE_URL, { headers: R2Z2_HEADERS });
  if (!response.ok) {
    throw new Error(
      `sequence.json error: ${response.status} ${response.statusText}`,
    );
  }
  const data = (await response.json()) as { sequence: number };
  return data.sequence;
}

/**
 * Resume from the saved position, or start at R2Z2's head (saved at once).
 * Retries a few times so a transient hiccup doesn't crash the worker on boot.
 */
async function initSequence(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const saved = await loadCursor();
      if (saved !== null) {
        currentSequence = saved;
        logger.info(`📍 resuming at sequence ${currentSequence}`);
        return;
      }
      currentSequence = await fetchHead();
      await saveCursor(currentSequence, new Date());
      logger.info(
        `📍 no saved position: starting at the head, ${currentSequence}`,
      );
      return;
    } catch (error) {
      logger.warn(
        `⚠️  failed to fetch starting sequence (attempt ${attempt}/${MAX_RETRIES}): ${error}`,
      );
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY);
    }
  }
  throw new Error('Failed to initialize R2Z2 sequence after retries');
}

/**
 * R2Z2 ships the complete ESI killmail alongside the zkb block, so the worker does
 * not have to fetch it again. Guard the shape anyway: if the feed ever changes,
 * processKillmail falls back to ESI rather than saving a half-formed killmail.
 */
function isUsableEsiKillmail(esi: unknown): esi is KillmailDetail {
  if (!esi || typeof esi !== 'object') return false;
  const k = esi as Partial<KillmailDetail>;
  return (
    typeof k.killmail_id === 'number' &&
    typeof k.killmail_time === 'string' &&
    typeof k.solar_system_id === 'number' &&
    !!k.victim &&
    typeof k.victim.ship_type_id === 'number' &&
    typeof k.victim.corporation_id === 'number' &&
    typeof k.victim.damage_taken === 'number' &&
    Array.isArray(k.attackers) &&
    k.attackers.length > 0 &&
    k.attackers.every(
      (a) =>
        typeof a?.damage_done === 'number' &&
        typeof a?.final_blow === 'boolean',
    )
  );
}

/** Move the cursor and save it. */
async function moveTo(sequence: number): Promise<void> {
  await saveCursor(sequence, new Date());
  currentSequence = sequence;
}

/**
 * Read the file at the current sequence and settle it; returns how long to
 * wait before the next step. A transport error, a 5xx, or a killmail written
 * nowhere throws, and the sequence stays where it is.
 * - 200 → process, then advance and save
 * - 200 without a killmail ID or hash → log, advance and save
 * - 404 → wait, or skip a number the head has passed (stream-cursor.ts)
 * - 403/429 → back off, do not advance
 */
async function step(): Promise<number> {
  if (currentSequence === null) {
    await initSequence();
  }
  const current = currentSequence!;
  const response = await fetch(`${R2Z2_BASE}/${current}.json`, {
    headers: R2Z2_HEADERS,
  });

  if (response.status === 404) {
    const head = await fetchHead();
    const next = onNotFound(gap, current, head);
    if (next.kind === 'wait') return EMPTY_DELAY;
    logger.warn(
      next.kind === 'skip'
        ? `⚠️  sequence ${current} missing with the head at ${head}; skipped`
        : `⚠️  sequence ${current} is out of R2Z2's range; jumping to the head, ${next.next}`,
    );
    await moveTo(next.next);
    return BACKLOG_DELAY;
  }
  if (response.status === 429 || response.status === 403) {
    logger.warn(
      `⚠️  rate limited by R2Z2 (${response.status}), backing off...`,
    );
    return RETRY_DELAY;
  }
  if (!response.ok) {
    throw new Error(`R2Z2 error: ${response.status} ${response.statusText}`);
  }

  const pkg = parsePackage(await response.text());
  if (typeof pkg === 'string') {
    logger.error(`❌ sequence ${current}: unreadable (${pkg}); skipped`);
  } else {
    stats.received++;
    await processKillmail(pkg);
  }
  onFound(gap);
  await moveTo(current + 1);
  return BACKLOG_DELAY;
}

/**
 * A 200's body as a package, or why it is not one. Only the ID and hash are
 * required; an embedded ESI killmail of the wrong shape is dropped and
 * fetched instead.
 */
function parsePackage(body: string): RedisQPackage | string {
  let data: R2Z2Killmail;
  try {
    data = JSON.parse(body) as R2Z2Killmail;
  } catch {
    return 'the body is not JSON';
  }
  if (typeof data?.killmail_id !== 'number') return 'no killmail_id';
  const hash = data.zkb?.hash ?? data.hash;
  if (typeof hash !== 'string') return `killmail ${data.killmail_id}: no hash`;
  return {
    killID: data.killmail_id,
    zkb: { ...data.zkb, hash },
    esi: isUsableEsiKillmail(data.esi) ? data.esi : undefined,
  } as RedisQPackage;
}

/**
 * Process a killmail package from RedisQ
 */
async function processKillmail(pkg: RedisQPackage): Promise<void> {
  const { killID, zkb } = pkg;

  try {
    // R2Z2 already carries the ESI killmail; only fall back to a fetch if the
    // payload did not carry a usable one.
    let killmail: KillmailDetail;
    if (pkg.esi) {
      logger.info(
        `📥 from payload: ${killID} (${formatISK(zkb.totalValue)} ISK)`,
      );
      killmail = pkg.esi;
    } else {
      logger.info(
        `📥 fetching from ESI: ${killID} (${formatISK(zkb.totalValue)} ISK)`,
      );
      killmail = await KillmailService.getKillmailDetail(killID, zkb.hash);
    }

    // Debug: Log items count
    const itemCount = killmail.victim.items?.length || 0;
    if (itemCount > 0) {
      logger.debug(`   📦 items found: ${itemCount}`);
    }

    // 🚀 NEW: fetch missing entities from ESI before saving the killmail
    // Can be disabled with REDISQ_ENABLE_ENRICHMENT=false to reduce DB load
    if (ENABLE_ENRICHMENT) {
      await enrichMissingEntities(killmail);
    } else {
      logger.debug('⚠️  enrichment disabled (REDISQ_ENABLE_ENRICHMENT=false)');
    }

    // Save to database (upsert handles duplicates)
    const isNew = await saveKillmail(killmail, zkb.hash);

    if (!isNew) {
      stats.skipped++;
      logger.debug(`⏭️  skipped: ${killID} (already exists)`);
      return;
    }

    stats.saved++;

    const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
    logger.info(
      `✅ saved: ${killID} | ` +
        `stats: ${stats.saved} saved, ${stats.skipped} skipped, ` +
        `${stats.enriched} enriched (${stats.enrichmentFailed} failed), ${stats.errors} errors ` +
        `(${runtime}s runtime)`,
    );
  } catch (error: any) {
    stats.errors++;
    logger.error(`❌ failed to process killmail ${killID}:`, error);
    // Hand it to the detail pipeline. If that write fails too, throw: the
    // killmail is written nowhere, so the sequence must not move past it.
    await recordRefs(
      [{ killmail_id: killID, killmail_hash: zkb.hash }],
      'redisq',
      new Date(),
    );
    logger.warn(`   ⚠️  killmail ${killID} recorded in killmail_refs`);
  }
}

/**
 * Enrich missing entities (character, corporation, alliance, type) before saving killmail
 * Runs before the transaction and fetches every missing entity from ESI
 */
async function enrichMissingEntities(killmail: KillmailDetail): Promise<void> {
  const enrichmentStart = Date.now();

  // Local counters for this enrichment run
  let enrichedCount = 0;
  let failedCount = 0;

  // 1. Collect every unique ID
  const characterIds = new Set<number>();
  const corporationIds = new Set<number>();
  const allianceIds = new Set<number>();
  const typeIds = new Set<number>();

  // Collect IDs from the victim
  if (killmail.victim.character_id)
    characterIds.add(killmail.victim.character_id);
  if (killmail.victim.corporation_id)
    corporationIds.add(killmail.victim.corporation_id);
  if (killmail.victim.alliance_id) allianceIds.add(killmail.victim.alliance_id);
  if (killmail.victim.ship_type_id) typeIds.add(killmail.victim.ship_type_id);

  // Collect IDs from the attackers
  killmail.attackers.forEach((attacker) => {
    if (attacker.character_id) characterIds.add(attacker.character_id);
    if (attacker.corporation_id) corporationIds.add(attacker.corporation_id);
    if (attacker.alliance_id) allianceIds.add(attacker.alliance_id);
    if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id);
    if (attacker.weapon_type_id) typeIds.add(attacker.weapon_type_id);
  });

  // Collect type IDs from the items
  if (killmail.victim.items) {
    killmail.victim.items.forEach((item) => {
      if (item.item_type_id) typeIds.add(item.item_type_id);
    });
  }

  const allCharacterIds = Array.from(characterIds);

  logger.debug(
    `🔍 checking entities: ${allCharacterIds.length} chars, ${corporationIds.size} corps, ` +
      `${allianceIds.size} alliances, ${typeIds.size} types`,
  );

  // 2. Find the ones missing from the database
  const [existingChars, existingCorps, existingAlliances, existingTypes] =
    await Promise.all([
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

  const missingCharIds = allCharacterIds.filter(
    (id) => !existingCharIds.has(id),
  );
  const missingCorpIds = Array.from(corporationIds).filter(
    (id) => !existingCorpIds.has(id),
  );
  const missingAllianceIds = Array.from(allianceIds).filter(
    (id) => !existingAllianceIds.has(id),
  );
  const missingTypeIds = Array.from(typeIds).filter(
    (id) => !existingTypeIds.has(id),
  );

  const totalMissing =
    missingCharIds.length +
    missingCorpIds.length +
    missingAllianceIds.length +
    missingTypeIds.length;

  if (totalMissing === 0) {
    logger.info('✅ all entities exist in database');
    return;
  }

  logger.info(
    `🔧 enriching ${totalMissing} missing entities: ` +
      `${missingCharIds.length} chars, ${missingCorpIds.length} corps, ` +
      `${missingAllianceIds.length} alliances, ${missingTypeIds.length} types`,
  );

  // 3. Fetch the missing entities from ESI and save them (batch processing)
  // Process 10 items at a time for better performance
  const BATCH_SIZE = 10;

  // Helper function for batch processing with proper counting
  async function processBatch<T>(
    items: T[],
    processor: (item: T) => Promise<{ success: boolean }>,
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(processor));

      // Count successes and failures atomically after batch completes
      results.forEach((result) => {
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      });
    }

    return { succeeded, failed };
  }

  // ⚠️ IMPORTANT: Process in dependency order
  // 1. Alliances first (no dependencies)
  // 2. Corporations second (may depend on alliances)
  // 3. Characters third (may depend on corporations)
  // 4. Types last (no dependencies)

  // Alliances (batch processing) - FIRST!
  const allianceResults = await processBatch(
    missingAllianceIds,
    async (allianceId) => {
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
        logger.info(`  ✓ alliance ${allianceId} enriched`);
        return { success: true };
      } catch (error: any) {
        const statusCode = error?.response?.status || 'unknown';
        const errorMsg =
          error?.response?.data?.error || error?.message || 'Unknown error';
        logger.warn(
          `  ✗ alliance ${allianceId} failed (${statusCode}): ${errorMsg}`,
        );
        return { success: false };
      }
    },
  );
  enrichedCount += allianceResults.succeeded;
  failedCount += allianceResults.failed;

  // Corporations (batch processing) - SECOND!
  const corpResults = await processBatch(missingCorpIds, async (corpId) => {
    try {
      logger.debug(`  🔄 fetching corporation ${corpId} from ESI...`);
      const corpInfo = await CorporationService.getCorporationInfo(corpId);

      logger.debug(`  💾 saving corporation ${corpId} to database...`);
      await prismaWorker.corporation.upsert({
        where: { id: corpId },
        create: {
          id: corpId,
          name: corpInfo.name,
          ticker: corpInfo.ticker,
          alliance_id: corpInfo.alliance_id || null,
          ceo_id: corpInfo.ceo_id,
          creator_id: corpInfo.creator_id,
          date_founded: corpInfo.date_founded
            ? new Date(corpInfo.date_founded)
            : null,
          member_count: corpInfo.member_count,
          tax_rate: corpInfo.tax_rate || 0,
        },
        update: {},
      });
      logger.info(
        `  ✓ corporation ${corpId} (${corpInfo.name} [${corpInfo.ticker}]) enriched successfully`,
      );
      return { success: true };
    } catch (error: any) {
      // Detailed error logging
      const statusCode = error?.response?.status || error?.code || 'unknown';
      const errorMsg =
        error?.response?.data?.error || error?.message || 'Unknown error';

      logger.error(`  ✗ corporation ${corpId} failed:`);
      logger.error(`     status: ${statusCode}`);
      logger.error(`     message: ${errorMsg}`);

      // Special handling for database constraint errors
      if (error?.code === 'P2003') {
        logger.error(`     type: foreign key constraint violation`);
        logger.error(`     meta: ${JSON.stringify(error?.meta || {})}`);
      } else if (error?.code?.startsWith('P')) {
        logger.error(`     type: Prisma error (${error.code})`);
        logger.error(`     meta: ${JSON.stringify(error?.meta || {})}`);
      } else if (error?.response?.status === 404) {
        logger.error(`     type: corporation not found in ESI (deleted/NPC)`);
      } else if (error?.response?.status === 429) {
        logger.error(`     type: ESI rate limit exceeded`);
      } else {
        logger.error(`     type: unknown error`);
        logger.error(`     stack: ${error?.stack?.split('\n')[0]}`);
      }
      return { success: false };
    }
  });
  enrichedCount += corpResults.succeeded;
  failedCount += corpResults.failed;

  // Characters (batch processing) - THIRD!
  const charResults = await processBatch(missingCharIds, async (charId) => {
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
          // The same optional fields worker-info-characters writes. Left out,
          // a character first seen on a live kill had no title, description
          // or faction until the monthly character scan came round.
          description: charInfo.description ?? null,
          ...characterTitleFields(charInfo),
          faction_id: charInfo.faction_id ?? null,
        },
        update: {},
      });
      logger.debug(`  ✓ character ${charId} enriched`);
      return { success: true };
    } catch (error: any) {
      const statusCode = error?.response?.status || 'unknown';
      const errorMsg =
        error?.response?.data?.error || error?.message || 'Unknown error';
      logger.warn(
        `  ✗ character ${charId} failed (${statusCode}): ${errorMsg}`,
      );
      return { success: false };
    }
  });
  enrichedCount += charResults.succeeded;
  failedCount += charResults.failed;

  // Types (batch processing) - FOURTH!
  const typeResults = await processBatch(missingTypeIds, async (typeId) => {
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
      logger.debug(`  ✓ type ${typeId} enriched`);
      return { success: true };
    } catch (error: any) {
      const statusCode = error?.response?.status || 'unknown';
      const errorMsg =
        error?.response?.data?.error || error?.message || 'Unknown error';
      logger.warn(`  ✗ type ${typeId} failed (${statusCode}): ${errorMsg}`);
      return { success: false };
    }
  });
  enrichedCount += typeResults.succeeded;
  failedCount += typeResults.failed;

  // Update global stats atomically after all batches complete
  stats.enriched += enrichedCount;
  stats.enrichmentFailed += failedCount;

  const enrichmentTime = Date.now() - enrichmentStart;
  logger.info(
    `✅ enrichment completed in ${enrichmentTime}ms ` +
      `(${enrichedCount} succeeded, ${failedCount} failed)`,
  );
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
    logger.info('\n\n🛑 shutting down RedisQ stream worker...');
    logger.info('\n📊 final statistics:');
    logger.info(`   received: ${stats.received}`);
    logger.info(`   saved: ${stats.saved}`);
    logger.info(`   skipped: ${stats.skipped}`);
    logger.info(
      `   enriched: ${stats.enriched} (${stats.enrichmentFailed} failed)`,
    );
    logger.info(`   errors: ${stats.errors}`);
    const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
    logger.info(`   runtime: ${runtime} seconds`);
    await prismaWorker.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

setupShutdownHandlers();

// Start the worker
redisQStreamWorker().catch((error) => {
  logger.error('💥 worker crashed:', error);
  process.exit(1);
});
