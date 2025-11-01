import axios from 'axios';
import '../config';
import prisma from '../services/prisma';
import { getRabbitMQChannel } from '../services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'corporation_sync_queue';
const RATE_LIMIT_DELAY = 100; // Wait 100ms between each request (10 requests per second)

/**
 * Checks if the corporation exists in the database
 */
async function corporationExists(corporationId: number): Promise<boolean> {
    const corporation = await prisma.corporation.findUnique({
        where: { id: corporationId },
        select: { id: true }, // Only select id for performance
    });
    return !!corporation;
}

/**
 * Fetches corporation information from ESI and saves it to the database
 * Returns true if processed, false if skipped
 */
async function processCorporation(corporationId: number): Promise<boolean> {
    try {
        console.log(`📥 Processing corporation ${corporationId}...`);

        // Fetch corporation information from ESI
        const response = await axios.get(
            `${ESI_BASE_URL}/corporations/${corporationId}/`
        );
        const data = response.data;

        // Check rate limit headers
        const errorLimitRemain = response.headers['x-esi-error-limit-remain'];
        if (errorLimitRemain && parseInt(errorLimitRemain) < 20) {
            console.log(
                `⚠️  Error limit low (${errorLimitRemain}/100), slowing down...`
            );
            await sleep(2000); // Wait 2 seconds
        }

        // Save to database using Prisma
        await prisma.corporation.upsert({
            where: { id: corporationId },
            update: {
                name: data.name,
                ticker: data.ticker,
                member_count: data.member_count,
                ceo_id: data.ceo_id,
                creator_id: data.creator_id,
                date_founded: data.date_founded ? new Date(data.date_founded) : null,
                description: data.description || null,
                alliance_id: data.alliance_id || null,
                faction_id: data.faction_id || null,
                home_station_id: data.home_station_id || null,
                shares: data.shares ? BigInt(data.shares) : null,
                tax_rate: data.tax_rate,
                url: data.url || null,
            },
            create: {
                id: corporationId,
                name: data.name,
                ticker: data.ticker,
                member_count: data.member_count,
                ceo_id: data.ceo_id,
                creator_id: data.creator_id,
                date_founded: data.date_founded ? new Date(data.date_founded) : null,
                description: data.description || null,
                alliance_id: data.alliance_id || null,
                faction_id: data.faction_id || null,
                home_station_id: data.home_station_id || null,
                shares: data.shares ? BigInt(data.shares) : null,
                tax_rate: data.tax_rate,
                url: data.url || null,
            },
        });

        console.log(`✅ Saved corporation ${corporationId} - ${data.name}`);

        // Short wait for rate limiting - sadece başarılı ESI çağrılarında bekle
        await sleep(RATE_LIMIT_DELAY);
        return true;
    } catch (error: any) {
        if (error.response?.status === 404) {
            console.log(`⚠️  Corporation ${corporationId} not found (404)`);
        } else if (error.response?.status === 420) {
            console.log(`🛑 Error limited (420)! Waiting 60 seconds...`);
            await sleep(60000);
            throw error; // Requeue the message
        } else {
            console.error(
                `❌ Error processing corporation ${corporationId}:`,
                error.message
            );
        }
        throw error;
    }
}

/**
 * Worker - Receives and processes messages from RabbitMQ
 */
async function startWorker() {
    try {
        const channel = await getRabbitMQChannel();

        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let startTime = Date.now();

        console.log('🚀 Corporation Worker Started');
        console.log('==========================');
        console.log(`📡 Listening to queue: ${QUEUE_NAME}`);
        console.log(`⏱️  Rate limit: ${1000 / RATE_LIMIT_DELAY} requests/second\n`);

        // Check initial queue status
        const queueInfo = await channel.checkQueue(QUEUE_NAME);
        console.log(`📊 Queue status: ${queueInfo.messageCount} messages waiting\n`);

        // Process only 1 message at a time
        channel.prefetch(1);

        channel.consume(
            QUEUE_NAME,
            async (msg) => {
                if (!msg) return;

                const corporationId = parseInt(msg.content.toString());

                if (isNaN(corporationId)) {
                    console.error('❌ Invalid corporation ID:', msg.content.toString());
                    channel.ack(msg);
                    errorCount++;
                    return;
                }

                try {
                    // Check if corporation already exists in database
                    const exists = await corporationExists(corporationId);

                    if (exists) {
                        // Skip if already exists - no ESI call needed
                        skippedCount++;
                        console.log(
                            `⏭️  Corporation ${corporationId} already exists, skipping... (Processed: ${processedCount}, Skipped: ${skippedCount})`
                        );
                        channel.ack(msg);

                        // Check if queue is empty
                        const currentQueue = await channel.checkQueue(QUEUE_NAME);
                        if (currentQueue.messageCount === 0) {
                            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                            console.log('\n' + '='.repeat(60));
                            console.log('🎉 ALL TASKS COMPLETED!');
                            console.log('='.repeat(60));
                            console.log(`✅ Processed: ${processedCount}`);
                            console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
                            console.log(`❌ Errors: ${errorCount}`);
                            console.log(
                                `📊 Total: ${processedCount + skippedCount + errorCount}`
                            );
                            console.log(`⏱️  Duration: ${duration}s`);
                            console.log('='.repeat(60));
                            console.log('\n💡 Queue is empty, waiting for new messages...');
                            console.log('   Press CTRL+C to stop.\n');
                        }
                        return;
                    }

                    // New corporation - fetch from ESI and save
                    await processCorporation(corporationId);
                    processedCount++;
                    console.log(
                        `   Progress: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`
                    );
                    channel.ack(msg);

                    // Check if queue is empty
                    const currentQueue = await channel.checkQueue(QUEUE_NAME);
                    if (currentQueue.messageCount === 0) {
                        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                        console.log('\n' + '='.repeat(60));
                        console.log('🎉 ALL TASKS COMPLETED!');
                        console.log('='.repeat(60));
                        console.log(`✅ Processed: ${processedCount}`);
                        console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
                        console.log(`❌ Errors: ${errorCount}`);
                        console.log(
                            `📊 Total: ${processedCount + skippedCount + errorCount}`
                        );
                        console.log(`⏱️  Duration: ${duration}s`);
                        console.log('='.repeat(60));
                        console.log('\n💡 Queue is empty, waiting for new messages...');
                        console.log('   Press CTRL+C to stop.\n');
                    }
                } catch (error) {
                    errorCount++;
                    console.log(
                        `   Progress: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`
                    );
                    channel.nack(msg, false, false);
                }
            },
            { noAck: false }
        );

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down worker...');
            await channel.close();
            await prisma.$disconnect();
            console.log('✅ Worker stopped gracefully');
            process.exit(0);
        });
    } catch (error) {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

startWorker();
