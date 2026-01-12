import '../config';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';
import { guardCronJob } from '../utils/cron-guard';

const QUEUE_NAME = 'esi_character_info_queue';
const BATCH_SIZE = 100;

/**
 * Queues character IDs to update from ESI
 * Usage:
 *   yarn queue:characters              # Queue ALL characters from DB
 *   yarn queue:characters 123 456 789  # Queue specific character IDs
 *
 * Scheduled: Monthly on 1st at 00:00 UTC (cron: '0 0 1 * *')
 */
async function queueCharacters() {
    // Prevent running on PM2 restart - only run on 1st of month at midnight UTC
    const args = process.argv.slice(2);
    if (args.length === 0) {
        // Only check schedule if no arguments (automated run)
        guardCronJob('queue-characters', { hour: 0, minute: 0, dayOfMonth: 1 });
    }
    try {
        // Get character IDs from command line arguments or database
        const args = process.argv.slice(2);
        let characterIds: number[] = [];

        if (args.length > 0) {
            // Queue specific character IDs from arguments
            characterIds = args.map((arg) => parseInt(arg, 10)).filter((id) => !isNaN(id));

            if (characterIds.length === 0) {
                logger.error('Invalid character IDs provided');
                process.exit(1);
            }

            logger.info(`Queueing ${characterIds.length} specific character(s): ${characterIds.join(', ')}`);
        } else {
            // Queue all characters from database
            logger.info('Fetching all character IDs from database...');
            const characters = await prismaWorker.character.findMany({
                select: { id: true },
                orderBy: { id: 'asc' },
            });
            characterIds = characters.map((c) => c.id);
            logger.info(`Found ${characterIds.length} characters in database`);
        }

        logger.info(`Adding to queue: ${QUEUE_NAME}`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        // Add to queue in batches with proper message format
        let queuedCount = 0;
        for (let i = 0; i < characterIds.length; i += BATCH_SIZE) {
            const batch = characterIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                const message = {
                    entityId: id,
                    queuedAt: new Date().toISOString(),
                    source: 'queue-characters',
                };
                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
                queuedCount++;
            }

            if (characterIds.length > 100) {
                logger.debug(
                    `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                        characterIds.length / BATCH_SIZE
                    )} (${batch.length} characters)`
                );
            }
        }

        logger.info(`✅ All ${queuedCount} character(s) queued successfully!`);
        logger.info('Now run the worker: yarn worker:info:characters');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to queue characters', { error });
        process.exit(1);
    }
}

queueCharacters();
