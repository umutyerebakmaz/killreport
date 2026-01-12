/**
 * Queue Alliance Corporations Script
 * Fetches all alliance IDs from database and adds them to alliance_corporation_queue
 *
 * Usage: yarn queue:alliance-corporations
 */

import '../config';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_alliance_corporations_queue';
const BATCH_SIZE = 100;

interface EntityQueueMessage {
    entityId: number;
    queuedAt: string;
    source: string;
}

/**
 * Fetches all alliance IDs from database and adds them to RabbitMQ queue
 */
async function queueAllianceCorporations() {
    logger.info('Alliance Corporation Queue Script Started');
    logger.info('━'.repeat(70));

    try {
        // Get all alliance IDs from database
        logger.info('Fetching alliance IDs from database...');
        const alliances = await prismaWorker.alliance.findMany({
            select: { id: true, name: true },
            orderBy: { id: 'asc' },
        });

        if (alliances.length === 0) {
            logger.warn('No alliances found in database');
            logger.info('Run yarn queue:alliances and yarn worker:info:alliances first');
            process.exit(0);
        }

        logger.info(`Found ${alliances.length} alliances in database`);
        logger.info('━'.repeat(70));

        // Connect to RabbitMQ
        const channel = await getRabbitMQChannel();

        // Assert queue exists
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        logger.info('Connected to RabbitMQ');
        logger.info(`Queue: ${QUEUE_NAME}`);
        logger.info('Adding alliances to queue...');

        // Add to queue in batches
        let queuedCount = 0;
        for (let i = 0; i < alliances.length; i += BATCH_SIZE) {
            const batch = alliances.slice(i, i + BATCH_SIZE);

            for (const alliance of batch) {
                const message: EntityQueueMessage = {
                    entityId: alliance.id,
                    queuedAt: new Date().toISOString(),
                    source: 'esi_alliance_corporations_queue',
                };

                channel.sendToQueue(
                    QUEUE_NAME,
                    Buffer.from(JSON.stringify(message)),
                    {
                        persistent: true,
                        priority: 5,
                    }
                );

                queuedCount++;
            }

            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(alliances.length / BATCH_SIZE);
            logger.debug(
                `Batch ${batchNum}/${totalBatches}: ${batch.length} alliances queued`
            );
        }

        logger.info('━'.repeat(70));
        logger.info(`Successfully queued ${queuedCount} alliances!`);
        logger.info('━'.repeat(70));
        logger.info('Next Steps:');
        logger.info('  1. Start worker: yarn worker:alliance-corporations');
        logger.info('  2. Start enrichment: yarn worker:info:corporations');

        await channel.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to queue alliance corporations', { error });
        process.exit(1);
    }
}

queueAllianceCorporations();
