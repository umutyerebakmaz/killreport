/**
 * Backfill Killmail Values Queue Script
 *
 * Finds killmails and queues them for value calculation based on mode
 * This is used for historical killmails or to recalculate existing values
 *
 * Usage: yarn queue:backfill-values [--limit=10000] [--mode=null|zero|all]
 * 
 * Modes:
 * - null: Only killmails where total_value IS NULL (default)
 * - zero: Only killmails where total_value = 0
 * - all: All killmails (recalculate everything)
 */

import '../config';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'backfill_killmail_values_queue';
const BATCH_SIZE = 500; // Process in batches of 500

type BackfillMode = 'null' | 'zero' | 'all';

interface BackfillMessage {
    killmailId: number;
    queuedAt: string;
    source: string;
    mode?: BackfillMode;
}

function getWhereClause(mode: BackfillMode) {
    switch (mode) {
        case 'null':
            return { total_value: null };
        case 'zero':
            return { total_value: 0 };
        case 'all':
            return {}; // No filter, all killmails
        default:
            return { total_value: null };
    }
}

function getModeDescription(mode: BackfillMode): string {
    switch (mode) {
        case 'null':
            return 'NULL values (not calculated yet)';
        case 'zero':
            return 'ZERO values (calculated as 0)';
        case 'all':
            return 'ALL killmails (recalculate everything)';
        default:
            return 'NULL values';
    }
}

async function queueBackfillValues() {
    const args = process.argv.slice(2);
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

    const modeArg = args.find(arg => arg.startsWith('--mode='));
    const mode: BackfillMode = (modeArg?.split('=')[1] as BackfillMode) || 'null';

    // Validate mode
    if (!['null', 'zero', 'all'].includes(mode)) {
        logger.error(`❌ Invalid mode: ${mode}`);
        logger.info('Valid modes: null, zero, all');
        process.exit(1);
    }

    logger.info('🔄 Backfill Killmail Values - Queue Script');
    logger.info('━'.repeat(60));
    logger.info(`📋 Mode: ${getModeDescription(mode)}`);

    try {
        const whereClause = getWhereClause(mode);

        // Count total killmails matching the criteria
        const totalCount = await prismaWorker.killmail.count({
            where: whereClause
        });

        if (totalCount === 0) {
            logger.info('✅ No killmails found matching the criteria!');
            logger.info('Nothing to backfill.');
            process.exit(0);
        }

        const toProcess = limit ? Math.min(limit, totalCount) : totalCount;

        logger.info(`📊 Found ${totalCount.toLocaleString()} killmails matching criteria`);
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
                where: whereClause,
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
                    source: 'queue-backfill-values',
                    mode
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
        logger.info(`📋 Mode: ${getModeDescription(mode)}`);
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
