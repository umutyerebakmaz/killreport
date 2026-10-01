/**
 * Single Killmail Fetcher
 * ESI'den belirli bir killmail ID'sini çeker ve database'e kaydeder
 *
 * Usage: ts-node src/workers/fetch-single-killmail.ts <killmail_id> <killmail_hash>
 * Example: ts-node src/workers/fetch-single-killmail.ts 131757087 abc123...
 */
import { saveKillmail } from '@services/killmail-writer';
import { KillmailService } from '@services/killmail';
import prismaWorker from '@services/prisma-worker';

async function fetchSingleKillmail(killmailId: number, killmailHash: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 fetching killmail: ${killmailId}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // 1. Fetch from ESI
    console.log(`📡 fetching from ESI...`);
    const detail = await KillmailService.getKillmailDetail(
      killmailId,
      killmailHash,
    );

    console.log(`✅ received killmail data`);
    console.log(`   time: ${detail.killmail_time}`);
    console.log(`   system: ${detail.solar_system_id}`);
    console.log(`   victim: ${detail.victim.character_id || 'NPC'}`);
    console.log(`   attackers: ${detail.attackers.length}`);
    console.log(`   items: ${detail.victim.items?.length || 0}`);

    // 2. Save to database
    console.log(`\n💾 saving to database...`);
    const isNew = await saveKillmail(detail, killmailHash);

    if (!isNew) {
      console.log(`⚠️  killmail ${killmailId} already exists in database`);
      return;
    }

    console.log(`✅ successfully saved killmail ${killmailId}`);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✨ done!`);
    console.log(`${'='.repeat(60)}\n`);

    // Enrichment bilgisi
    console.log(
      `💡 tip: run enrichment to fetch missing character/corp/type data:`,
    );
    console.log(`   yarn scan:entities`);
    console.log(`   yarn worker:info:characters`);
    console.log(`   yarn worker:info:corporations`);
    console.log(`   yarn worker:info:types\n`);
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log(`⚠️  killmail ${killmailId} already exists (duplicate key)`);
    } else if (error.response?.status === 404) {
      console.error(`❌ killmail ${killmailId} not found on ESI`);
      console.error(`   make sure the killmail ID and hash are correct`);
    } else if (error.response?.status === 422) {
      console.error(`❌ invalid killmail hash for ID ${killmailId}`);
      console.error(`   the hash does not match this killmail`);
    } else {
      console.error(`❌ error fetching killmail:`, error);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(
    `\n❌ usage: ts-node fetch-single-killmail.ts <killmail_id> <killmail_hash>`,
  );
  console.error(
    `   example: ts-node fetch-single-killmail.ts 131757087 abc123def456...\n`,
  );
  console.error(`💡 you can get killmail hash from:`);
  console.error(`   - zKillboard: https://zkillboard.com/kill/131757087/`);
  console.error(`   - ESI: check the killmail detail endpoint\n`);
  process.exit(1);
}

const killmailId = parseInt(args[0], 10);
const killmailHash = args[1];

if (isNaN(killmailId) || killmailId <= 0) {
  console.error(`\n❌ invalid killmail ID: ${args[0]}`);
  console.error(`   killmail ID must be a positive number\n`);
  process.exit(1);
}

if (!killmailHash || killmailHash.length < 10) {
  console.error(`\n❌ invalid killmail hash: ${killmailHash}`);
  console.error(`   hash should be a 40-character hexadecimal string\n`);
  process.exit(1);
}

// Run the fetcher
fetchSingleKillmail(killmailId, killmailHash)
  .then(() => {
    prismaWorker.$disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n💥 fatal error:`, error);
    prismaWorker.$disconnect();
    process.exit(1);
  });
