import { publishKillmailDetails } from '../queues/publish-killmail-details';
import { getRabbitMQChannel } from '@services/rabbitmq';
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

    logger.info(`\n📋 Listing ${zkillmails.length} killmails...\n`);

    const queued = await publishKillmailDetails(
      zkillmails.map((z) => ({
        killmail_id: z.killmail_id,
        killmail_hash: z.zkb.hash,
      })),
      // Hand-run historical backfill: quiet, and behind anything live.
      { announce: false, priority: 1 },
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info('\n' + '='.repeat(60));
    logger.info('🎉 SYNC COMPLETED!');
    logger.info('='.repeat(60));
    logger.info(`📤 Queued for detail fetch: ${queued}`);
    logger.info(`⏭️  Already stored: ${zkillmails.length - queued}`);
    logger.info(`📊 Listed: ${zkillmails.length}`);
    logger.info(`⏱️  Duration: ${duration}s`);
    logger.info('='.repeat(60) + '\n');
    logger.info('Now run the worker to write them:');
    logger.info('  yarn worker:killmail-detail\n');

    // Close the channel before exiting. sendToQueue buffers, and
    // process.exit does not flush it — the messages would be counted here and
    // never reach the broker. Every script under src/queues/ closes for the
    // same reason.
    const channel = await getRabbitMQChannel();
    await channel.close();

    await prismaWorker.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('\n❌ Fatal error:', error);
    await prismaWorker.$disconnect();
    process.exit(1);
  }
}

syncCharacterKillmails();
