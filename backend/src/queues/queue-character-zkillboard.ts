import '../config';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'zkillboard_character_queue';

/**
 * Queue a specific character for killmail sync (without authentication)
 * Usage: ts-node src/workers/queue-character-zkillboard.ts <characterId> <characterName>
 */
async function queueCharacter() {
    const characterId = parseInt(process.argv[2]);
    const characterName = process.argv[3];

    if (!characterId || !characterName) {
        logger.error('Usage: yarn queue:character:zkillboard <characterId> <characterName>');
        logger.error('  Example: yarn queue:character:zkillboard 95465499 "Foo Bar"');
        process.exit(1);
    }

    logger.info('Queueing character for killmail sync...');
    logger.info(`Character: ${characterName} (${characterId})`);

    try {
        const channel = await getRabbitMQChannel();

        const message = {
            userId: 0, // No user ID (external character)
            characterId: characterId,
            characterName: characterName,
            queuedAt: new Date().toISOString(),
        };

        channel.sendToQueue(
            QUEUE_NAME,
            Buffer.from(JSON.stringify(message)),
            {
                persistent: true, // Survive RabbitMQ restarts
                priority: 5, // Default priority
            }
        );

        logger.info('Character queued successfully!');
        logger.info('Now run the worker to process: yarn worker:zkillboard');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to queue character', { error });
        process.exit(1);
    }
}

queueCharacter();
