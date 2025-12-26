import '../config';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'zkillboard_character_queue';

/**
 * Queue specific character IDs for killmail sync
 * Usage: yarn queue:character <characterId1> <characterId2> ...
 *
 * This allows you to sync killmails for ANY character from zKillboard,
 * not just logged-in users. No authentication required.
 *
 * Examples:
 *   yarn queue:character 95465499                    # Single character
 *   yarn queue:character 95465499 123456 789012     # Multiple characters
 */
async function queueSpecificCharacters() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        logger.error('Usage: yarn queue:character <characterId1> <characterId2> ...');
        logger.info('Examples:');
        logger.info('  yarn queue:character 95465499');
        logger.info('  yarn queue:character 95465499 123456789 987654321');
        logger.info('Then start the worker:');
        logger.info('  yarn worker:killmails');
        process.exit(1);
    }

    logger.info('Queueing specific characters for killmail sync...');

    try {
        const channel = await getRabbitMQChannel();
        let successCount = 0;
        let errorCount = 0;

        for (const arg of args) {
            const characterId = parseInt(arg);

            if (isNaN(characterId)) {
                logger.warn(`Skipping invalid ID: ${arg}`);
                errorCount++;
                continue;
            }

            const message = {
                userId: null, // No user ID for external characters
                characterId: characterId,
                characterName: `Character_${characterId}`, // Will be resolved from ESI later
                queuedAt: new Date().toISOString(),
            };

            channel.sendToQueue(
                QUEUE_NAME,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );

            logger.debug(`Queued character ID: ${characterId}`);
            successCount++;
        }

        logger.info(`Successfully queued ${successCount} character(s)`);
        if (errorCount > 0) {
            logger.warn(`Skipped ${errorCount} invalid ID(s)`);
        }
        logger.info('Now run the worker to process them:');
        logger.info('  yarn worker:killmails');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to queue characters', { error });
        process.exit(1);
    }
}

queueSpecificCharacters();
