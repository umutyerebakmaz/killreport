/**
 * Dogma Effect Info Worker
 * Fetches dogma effect information from ESI and saves to database
 */

import '../config';
import { DogmaEffectService } from '../services/dogma';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_dogma_effect_info_queue';
const PREFETCH_COUNT = 50; // Process 50 effects concurrently (max ESI rate limit)

interface EntityQueueMessage {
    entityId: number;
    queuedAt: string;
    source: string;
}

async function dogmaEffectInfoWorker() {
    logger.info('🔶 Dogma Effect Info Worker Started');
    logger.info(`📦 Queue: ${QUEUE_NAME}`);
    logger.info(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

    try {
        const channel = await getRabbitMQChannel();

        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: { 'x-max-priority': 10 },
        });

        channel.prefetch(PREFETCH_COUNT);

        logger.info('✅ Connected to RabbitMQ');
        logger.info('⏳ Waiting for dogma effects...\n');

        let totalProcessed = 0;
        let totalAdded = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let lastMessageTime = Date.now();

        // Check if queue is empty every 5 seconds
        const emptyCheckInterval = setInterval(async () => {
            const timeSinceLastMessage = Date.now() - lastMessageTime;
            if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
                logger.info('\n' + '━'.repeat(60));
                logger.info('✅ Queue completed!');
                logger.info(
                    `📊 Final: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`
                );
                logger.info('━'.repeat(60) + '\n');
                logger.info('⏳ Waiting for new messages...\n');
            }
        }, 5000);

        channel.consume(
            QUEUE_NAME,
            async (msg) => {
                if (msg) lastMessageTime = Date.now();
                if (!msg) return;

                const message: EntityQueueMessage = JSON.parse(msg.content.toString());
                const effectId = message.entityId;

                try {
                    // Check if already exists
                    const existing = await prismaWorker.dogmaEffect.findUnique({
                        where: { id: effectId },
                    });

                    // Dogma effects are static data, but we'll fetch to ensure completeness
                    if (existing) {
                        // Effect already exists, skip (dogma effects are static data)
                        channel.ack(msg);
                        totalSkipped++;
                        totalProcessed++;
                        logger.info(`  - [${totalProcessed}] Effect ${effectId} (exists)`);
                        return;
                    }

                    // Fetch from ESI
                    const effectInfo = await DogmaEffectService.getEffectInfo(effectId);

                    // Save to database (upsert to prevent race condition)
                    const result = await prismaWorker.dogmaEffect.upsert({
                        where: { id: effectId },
                        create: {
                            id: effectId,
                            name: effectInfo.name,
                            display_name: effectInfo.display_name || null,
                            description: effectInfo.description || null,
                            effect_category: effectInfo.effect_category || null,
                            pre_expression: effectInfo.pre_expression || null,
                            post_expression: effectInfo.post_expression || null,
                            icon_id: effectInfo.icon_id || null,
                            published: effectInfo.published ?? true,
                            is_offensive: effectInfo.is_offensive ?? false,
                            is_assistance: effectInfo.is_assistance ?? false,
                            disallow_auto_repeat: effectInfo.disallow_auto_repeat ?? false,
                        },
                        update: {}, // Dogma effects are static data, no updates needed
                    });

                    totalAdded++;
                    channel.ack(msg);
                    totalProcessed++;
                    logger.info(
                        `  ✓ [${totalProcessed}] ${effectInfo.name} (${effectInfo.display_name || 'N/A'})`
                    );

                    if (totalProcessed % 100 === 0) {
                        logger.info(
                            `📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`
                        );
                    }
                } catch (error: any) {
                    totalErrors++;
                    totalProcessed++;

                    if (error.message?.includes('404')) {
                        logger.warn(`  ! [${totalProcessed}] Effect ${message.entityId} (404)`);
                        channel.ack(msg);
                    } else {
                        logger.error(
                            `  × [${totalProcessed}] Effect ${message.entityId}: ${error.message}`
                        );
                        channel.nack(msg, false, true);
                    }

                    if (totalProcessed % 100 === 0) {
                        logger.info(
                            `📊 Summary: ${totalProcessed} processed (${totalAdded} added, ${totalSkipped} skipped, ${totalErrors} errors)`
                        );
                    }
                }
            },
            { noAck: false }
        );
    } catch (error) {
        logger.error('💥 Worker failed to start:', error);
        await prismaWorker.$disconnect();
        process.exit(1);
    }
}

function setupShutdownHandlers() {
    const shutdown = async () => {
        logger.warn('\n\n⚠️  Shutting down...');
        await prismaWorker.$disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

setupShutdownHandlers();
dogmaEffectInfoWorker();
