import '../config';
import { AllianceService } from '../services/alliance';
import logger from '../services/logger';
import { getRabbitMQChannel } from '../services/rabbitmq';
import { guardCronJob } from '../utils/cron-guard';

const QUEUE_NAME = 'esi_alliance_info_queue';
const BATCH_SIZE = 100;

/**
 * Fetches all alliance IDs from ESI and adds them to RabbitMQ queue
 * These will be processed by worker:info:alliances
 *
 * Scheduled: Weekly on Sunday at 00:00 UTC (cron: '0 0 * * 0')
 */
async function queueAlliances() {
    // Prevent running on PM2 restart - only run on Sundays at midnight UTC
    guardCronJob('queue-alliances', { hour: 0, minute: 0, dayOfWeek: 0 });
    logger.info('Fetching all alliance IDs from ESI...');

    try {
        // Get all alliance IDs from ESI
        const allianceIds = await AllianceService.getAllAllianceIds();

        logger.info(`Found ${allianceIds.length} alliances`);
        logger.info(`Adding to queue: ${QUEUE_NAME}`);

        const channel = await getRabbitMQChannel();

        // Ensure queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        // Add to queue in batches with proper message format
        for (let i = 0; i < allianceIds.length; i += BATCH_SIZE) {
            const batch = allianceIds.slice(i, i + BATCH_SIZE);

            for (const id of batch) {
                const message = {
                    entityId: id,
                    queuedAt: new Date().toISOString(),
                    source: 'queue-alliances',
                };
                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true,
                });
            }

            logger.debug(
                `Queued batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                    allianceIds.length / BATCH_SIZE
                )} (${batch.length} alliances)`
            );
        }

        logger.info(`All ${allianceIds.length} alliances queued successfully!`);
        logger.info('Now run the worker: yarn worker:info:alliances');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to queue alliances', { error });
        process.exit(1);
    }
}

queueAlliances();
