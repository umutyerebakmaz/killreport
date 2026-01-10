/**
 * Corporation Info Worker
 * Fetches corporation information from ESI and saves to database
 */

import '../config';
import { CorporationService } from '../services/corporation';
import logger from '../services/logger';
import prismaWorker from '../services/prisma-worker';
import { getRabbitMQChannel } from '../services/rabbitmq';

const QUEUE_NAME = 'esi_corporation_info_queue';
const PREFETCH_COUNT = 5; // Process 5 corporations concurrently

interface EntityQueueMessage {
    entityId: number;
    queuedAt: string;
    source: string;
}

async function corporationInfoWorker() {
    logger.info('🏢 Corporation Info Worker Started');
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
        logger.info('⏳ Waiting for corporations...\n');

        let totalProcessed = 0;
        let totalCreated = 0;
        let totalUpdated = 0;
        let totalErrors = 0;
        let lastMessageTime = Date.now();

        // Check if queue is empty every 5 seconds
        const emptyCheckInterval = setInterval(async () => {
            const timeSinceLastMessage = Date.now() - lastMessageTime;
            if (timeSinceLastMessage > 5000 && totalProcessed > 0) {
                logger.info('\n' + '━'.repeat(60));
                logger.info('✅ Queue completed!');
                logger.info(`📊 Final: ${totalProcessed} processed (${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors)`);
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
                const corporationId = message.entityId;

                try {

                    // Check if already exists
                    const existing = await prismaWorker.corporation.findUnique({
                        where: { id: corporationId },
                    });

                    // Fetch from ESI (her zaman güncel bilgiyi al)
                    const corpInfo = await CorporationService.getCorporationInfo(corporationId);

                    // Save to database (upsert to prevent race condition)
                    await prismaWorker.corporation.upsert({
                        where: { id: corporationId },
                        create: {
                            id: corporationId,
                            name: corpInfo.name,
                            ticker: corpInfo.ticker,
                            member_count: corpInfo.member_count,
                            ceo_id: corpInfo.ceo_id,
                            creator_id: corpInfo.creator_id,
                            date_founded: corpInfo.date_founded ? new Date(corpInfo.date_founded) : null,
                            description: corpInfo.description,
                            alliance_id: corpInfo.alliance_id, // ESI'den gelen değer direkt
                            faction_id: corpInfo.faction_id,
                            home_station_id: corpInfo.home_station_id,
                            shares: corpInfo.shares,
                            tax_rate: corpInfo.tax_rate,
                            url: corpInfo.url,
                        },
                        update: {
                            // ✅ Güncel bilgileri güncelle
                            name: corpInfo.name,
                            ticker: corpInfo.ticker,
                            member_count: corpInfo.member_count,
                            ceo_id: corpInfo.ceo_id,
                            alliance_id: corpInfo.alliance_id, // ESI'den gelen değer direkt
                            tax_rate: corpInfo.tax_rate,
                            description: corpInfo.description,
                            url: corpInfo.url,
                            // date_founded, creator_id değişmez, güncellemeye gerek yok
                        },
                    });

                    if (existing) {
                        totalUpdated++;
                        logger.info(`  ✅ [${totalProcessed + 1}][${corporationId}] ${corpInfo.name} [${corpInfo.ticker}] \x1b[36m(updated)\x1b[0m`);
                    } else {
                        totalCreated++;
                        logger.info(`  ✅ [${totalProcessed + 1}][${corporationId}] ${corpInfo.name} [${corpInfo.ticker}] \x1b[32m(created)\x1b[0m`);
                    } channel.ack(msg);
                    totalProcessed++;

                } catch (error: any) {
                    totalErrors++;
                    totalProcessed++;

                    const errorMsg = error.message || String(error);

                    // 404: Corporation doesn't exist (NPC corp or deleted) - skip it
                    if (errorMsg.includes('404')) {
                        logger.warn(`  ! [${totalProcessed}] Corporation ${message.entityId} (404 - not found)`);
                        channel.ack(msg);
                    }
                    // 5xx: Server errors (504 Gateway Timeout, 502 Bad Gateway, 503 Service Unavailable)
                    // These are temporary ESI issues - retry after delay
                    else if (errorMsg.includes('504') || errorMsg.includes('502') || errorMsg.includes('503')) {
                        logger.warn(`  ⏳ [${totalProcessed}] Corporation ${message.entityId}: ${errorMsg} - retrying in 5s...`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        channel.nack(msg, false, true); // Requeue
                    }
                    // Other errors: log and requeue (might be transient)
                    else {
                        logger.error(`  × [${totalProcessed}] Corporation ${message.entityId}: ${errorMsg}`);
                        channel.nack(msg, false, true);
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
corporationInfoWorker();
