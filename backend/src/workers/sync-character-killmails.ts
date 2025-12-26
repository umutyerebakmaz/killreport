import '../config';
import { KillmailService } from '../services/killmail';
import logger from '../services/logger';
import prisma from '../services/prisma';
import { pubsub } from '../services/pubsub';
import { getCharacterKillmailsFromZKill } from '../services/zkillboard';

const MAX_PAGES = 50; // Configurable

/**
 * Sync killmails for a specific character ID directly
 * Usage: ts-node src/workers/sync-character-killmails.ts <characterId> [maxPages]
 */
async function syncCharacterKillmails() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    logger.info('❌ Usage: yarn sync:character <characterId> [maxPages]');
    logger.info('\nExamples:');
    logger.info('  yarn sync:character 123456789           # Default 50 pages');
    logger.info('  yarn sync:character 123456789 10        # Only 10 pages');
    logger.info('  yarn sync:character 123456789 999       # ALL history\n');
    process.exit(1);
  }

  const characterId = parseInt(args[0]);
  const maxPages = args[1] ? parseInt(args[1]) : MAX_PAGES;

  if (isNaN(characterId)) {
    logger.error('❌ Invalid character ID');
    process.exit(1);
  }

  logger.info('🚀 Character Killmail Sync Started');
  logger.info('==================================');
  logger.info(`📝 Character ID: ${characterId}`);
  logger.info(`📄 Max Pages: ${maxPages} (${maxPages * 200} killmails max)\n`);

  const startTime = Date.now();
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // Fetch killmails from zKillboard
    logger.info(`📡 Fetching killmails from zKillboard...\n`);
    const zkillmails = await getCharacterKillmailsFromZKill(characterId, {
      maxPages,
      characterName: `Character_${characterId}`,
    });

    if (zkillmails.length === 0) {
      logger.warn('⚠️  No killmails found for this character\n');
      process.exit(0);
    }

    logger.info(`\n💾 Processing ${zkillmails.length} killmails...\n`);

    // Process each killmail
    for (let i = 0; i < zkillmails.length; i++) {
      const zkill = zkillmails[i];

      try {
        // Check if already exists
        const existing = await prisma.killmail.findUnique({
          where: { killmail_id: zkill.killmail_id },
        });

        if (existing) {
          skippedCount++;
          if (i % 100 === 0) {
            logger.debug(`  ⏭️  [${i + 1}/${zkillmails.length}] Already exists, skipping...`);
          }
          continue;
        }

        // Fetch full details from ESI
        const details = await KillmailService.getKillmailDetail(zkill.killmail_id, zkill.zkb.hash);

        // Save to database with items
        const savedKillmail = await prisma.killmail.create({
          data: {
            killmail_id: zkill.killmail_id,
            killmail_hash: zkill.zkb.hash,
            killmail_time: new Date(details.killmail_time),
            solar_system_id: details.solar_system_id,
            victim: {
              create: {
                character_id: details.victim.character_id || null,
                corporation_id: details.victim.corporation_id,
                alliance_id: details.victim.alliance_id || null,
                ship_type_id: details.victim.ship_type_id,
                damage_taken: details.victim.damage_taken,
              },
            },
            attackers: {
              create: details.attackers.map((attacker) => ({
                character_id: attacker.character_id || null,
                corporation_id: attacker.corporation_id || null,
                alliance_id: attacker.alliance_id || null,
                ship_type_id: attacker.ship_type_id || null,
                weapon_type_id: attacker.weapon_type_id || null,
                damage_done: attacker.damage_done,
                final_blow: attacker.final_blow,
                security_status: attacker.security_status,
              })),
            },
            items: {
              create: (details.victim.items || []).map((item) => ({
                item_type_id: item.item_type_id,
                flag: item.flag,
                quantity_dropped: item.quantity_dropped || null,
                quantity_destroyed: item.quantity_destroyed || null,
                singleton: item.singleton,
              })),
            },
          },
        });

        // Publish new killmail event to subscribers (only ID - resolver will fetch full data)
        await pubsub.publish('NEW_KILLMAIL', {
          killmailId: savedKillmail.killmail_id,
        });

        processedCount++;

        if (i % 10 === 0) {
          logger.debug(
            `  ✅ [${i + 1}/${zkillmails.length}] Saved killmail ${zkill.killmail_id}`
          );
        }

        // Rate limit: ~100ms per killmail
        await sleep(100);
      } catch (error: any) {
        errorCount++;
        logger.error(`  ❌ [${i + 1}/${zkillmails.length}] Error:`, error.message);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info('\n' + '='.repeat(60));
    logger.info('🎉 SYNC COMPLETED!');
    logger.info('='.repeat(60));
    logger.info(`✅ Processed: ${processedCount}`);
    logger.info(`⏭️  Skipped (already exists): ${skippedCount}`);
    logger.info(`❌ Errors: ${errorCount}`);
    logger.info(`📊 Total: ${processedCount + skippedCount + errorCount}`);
    logger.info(`⏱️  Duration: ${duration}s`);
    logger.info('='.repeat(60) + '\n');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('\n❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

syncCharacterKillmails();
