/**
 * Backfill Killmail Values Queue Script
 *
 * Finds all killmails with NULL total_value and queues them for value calculation
 * This is used for historical killmails that were created before value caching was implemented
 *
 * Usage: yarn queue:backfill-values [--limit=10000]
 */

import '../config';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'backfill_killmail_values_queue';
const BATCH_SIZE = 500; // Process in batches of 500

interface BackfillMessage {
    killmailId: number;
    queuedAt: string;
    source: string;
}

async function queueBackfillValues() {
    const args = process.argv.slice(2);
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

    logger.info('🔄 Backfill Killmail Values - Queue Script');
    logger.info('━'.repeat(60));

    try {
        // Count total killmails without values
        const totalCount = await prismaWorker.killmail.count({
            where: { total_value: null }
        });

        if (totalCount === 0) {
            logger.info('✅ All killmails already have values calculated!');
            logger.info('Nothing to backfill.');
            process.exit(0);
        }

        const toProcess = limit ? Math.min(limit, totalCount) : totalCount;

        logger.info(`📊 Found ${totalCount.toLocaleString()} killmails without values`);
        if (limit) {
            logger.info(`🎯 Processing limit: ${toProcess.toLocaleString()} killmails`);
        }
        logger.info(`📦 Queue: ${QUEUE_NAME}`);
        logger.info(`⚙️  Batch size: ${BATCH_SIZE}`);
        logger.info('');

        const channel = await getRabbitMQChannel();

        // Ensure queue exists with priority support
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 }
        });

        logger.info('⏳ Fetching killmail IDs...');

        // Fetch killmail IDs in batches (to avoid loading millions of IDs in memory)
        let queuedCount = 0;
        let batchNumber = 0;

        while (queuedCount < toProcess) {
            const take = Math.min(BATCH_SIZE, toProcess - queuedCount);

            const killmails = await prismaWorker.killmail.findMany({
                where: { total_value: null },
                select: { killmail_id: true },
                orderBy: { killmail_time: 'desc' }, // Process newest first
                skip: batchNumber * BATCH_SIZE,
                take
            });

            if (killmails.length === 0) break;

            // Queue each killmail
            for (const km of killmails) {
                const message: BackfillMessage = {
                    killmailId: km.killmail_id,
                    queuedAt: new Date().toISOString(),
                    source: 'queue-backfill-values'
                };

                channel.sendToQueue(
                    QUEUE_NAME,
                    Buffer.from(JSON.stringify(message)),
                    { persistent: true }
                );

                queuedCount++;
            }

            batchNumber++;
            const progress = ((queuedCount / toProcess) * 100).toFixed(1);
            logger.info(
                `  📤 Queued batch ${batchNumber} ` +
                `(${queuedCount.toLocaleString()}/${toProcess.toLocaleString()} - ${progress}%)`
            );
        }

        logger.info('');
        logger.info('━'.repeat(60));
        logger.info(`✅ Successfully queued ${queuedCount.toLocaleString()} killmails`);
        logger.info('');
        logger.info('🚀 Start the worker with:');
        logger.info('   yarn worker:backfill-values');
        logger.info('');
        logger.info('💡 Multiple workers can run in parallel for faster processing');
        logger.info('━'.repeat(60));

        await channel.close();
        await prismaWorker.$disconnect();
        process.exit(0);

    } catch (error) {
        logger.error('Failed to queue backfill values', { error });
        await prismaWorker.$disconnect();
        process.exit(1);
    }
}

queueBackfillValues();
