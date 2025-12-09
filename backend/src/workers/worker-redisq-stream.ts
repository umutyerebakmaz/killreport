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
import prisma from '../services/prisma';
import { esiRateLimiter } from '../services/rate-limiter';

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

interface ESIKillmail {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    character_id?: number;
    corporation_id: number;
    alliance_id?: number;
    ship_type_id: number;
    damage_taken: number;
    position?: {
      x: number;
      y: number;
      z: number;
    };
  };
  attackers: Array<{
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    ship_type_id?: number;
    weapon_type_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status?: number;
  }>;
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
async function redisQStreamWorker() {
  console.log('🌊 RedisQ Stream Worker Started');
  console.log(`📡 Endpoint: ${REDISQ_URL}`);
  console.log(`🆔 Queue ID: ${QUEUE_ID}`);
  console.log(`⏱️  Poll Rate: ${REQUEST_DELAY}ms (~${Math.floor(1000 / REQUEST_DELAY)} req/sec)`);
  console.log(`⏳ Timeout: ${TIME_TO_WAIT} seconds\n`);
  console.log('━'.repeat(60));
  console.log('🎯 Listening for killmails...\n');

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
      console.error(`❌ Error in main loop (${consecutiveErrors} consecutive):`, error);

      // If too many consecutive errors, back off longer
      if (consecutiveErrors >= 5) {
        console.log(`⚠️  Too many errors, backing off for ${RETRY_DELAY}ms...`);
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
        console.warn('⚠️  Rate limited by RedisQ (429), backing off...');
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
    // Check if killmail already exists
    const existing = await prisma.killmail.findUnique({
      where: { killmail_id: killID },
      select: { killmail_id: true },
    });

    if (existing) {
      stats.skipped++;
      console.log(`⏭️  Skipped: ${killID} (already exists)`);
      return;
    }

    // Fetch full killmail from ESI
    console.log(`📥 Fetching: ${killID} (${formatISK(zkb.totalValue)} ISK)`);
    const killmail = await fetchKillmailFromESI(killID, zkb.hash);

    // Save to database
    await saveKillmail(killmail, zkb.hash);
    stats.saved++;

    const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
    console.log(
      `✅ Saved: ${killID} | ` +
      `Stats: ${stats.saved} saved, ${stats.skipped} skipped, ${stats.errors} errors ` +
      `(${runtime}s runtime)`
    );
  } catch (error) {
    stats.errors++;
    console.error(`❌ Failed to process killmail ${killID}:`, error);
    throw error; // Re-throw to trigger retry logic
  }
}

/**
 * Fetch killmail from ESI using ID and hash
 */
async function fetchKillmailFromESI(killmailId: number, hash: string): Promise<ESIKillmail> {
  const url = `https://esi.evetech.net/latest/killmails/${killmailId}/${hash}/`;

  return esiRateLimiter.execute(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Killreport Real-Time Sync - github.com/umutyerebakmaz/killreport',
      },
    });

    if (!response.ok) {
      throw new Error(`ESI error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  });
}

/**
 * Save killmail to database with attackers and victim
 */
async function saveKillmail(killmail: ESIKillmail, hash: string): Promise<void> {
  const { victim, attackers, killmail_time, solar_system_id } = killmail;

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

    // Create attackers
    await tx.attacker.createMany({
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
  });
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
  console.log('\n\n🛑 Shutting down RedisQ stream worker...');
  console.log('\n📊 Final Statistics:');
  console.log(`   Received: ${stats.received}`);
  console.log(`   Saved: ${stats.saved}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Errors: ${stats.errors}`);
  const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  console.log(`   Runtime: ${runtime} seconds`);
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker
redisQStreamWorker().catch((error) => {
  console.error('💥 Worker crashed:', error);
  process.exit(1);
});
