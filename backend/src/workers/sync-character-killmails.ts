import { saveKillmail } from '@services/killmail-writer';
import { KillmailService } from '@services/killmail';
import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { getCharacterKillmailsFromZKill } from '@services/zkillboard';

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
        // Ask before fetching. saveKillmail answers the same question, but
        // only after the ESI detail call has already been paid for — and a
        // re-sync of an already-stored character is almost entirely
        // duplicates. zKillboard hands back up to 200,000 ids here.
        const existing = await prismaWorker.killmail.findUnique({
          where: { killmail_id: zkill.killmail_id },
          select: { killmail_id: true },
        });

        if (existing) {
          skippedCount++;
          if (i % 100 === 0) {
            logger.debug(
              `  ⏭️  [${i + 1}/${zkillmails.length}] Already exists, skipping...`,
            );
          }
          continue;
        }

        // Fetch full details from ESI
        const details = await KillmailService.getKillmailDetail(
          zkill.killmail_id,
          zkill.zkb.hash,
        );

        // Hand-run historical backfill: no NEW_KILLMAIL, for the same reason
        // worker-zkillboard-sync passes false. `yarn sync:character <id> 999`
        // would otherwise push a character's whole history into every open
        // killmails page as if it had just happened.
        const isNew = await saveKillmail(details, zkill.zkb.hash, {
          publish: false,
        });
        if (!isNew) {
          skippedCount++;
          continue;
        }

        processedCount++;

        if (i % 10 === 0) {
          logger.debug(
            `  ✅ [${i + 1}/${zkillmails.length}] Saved killmail ${zkill.killmail_id}`,
          );
        }

        // Rate limit: ~100ms per killmail
        await sleep(100);
      } catch (error: any) {
        errorCount++;
        logger.error(
          `  ❌ [${i + 1}/${zkillmails.length}] Error:`,
          error.message,
        );
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

    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('\n❌ Fatal error:', error);
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

syncCharacterKillmails();
