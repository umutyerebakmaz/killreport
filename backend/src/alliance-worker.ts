import axios from 'axios';
import './config';
import { pool } from './services/database';
import { getRabbitMQChannel } from './services/rabbitmq';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const QUEUE_NAME = 'alliance_sync_queue';
const RATE_LIMIT_DELAY = 100; // Her istek arası 100ms bekle (saniyede 10 istek)

/**
 * Alliance'ın veritabanında olup olmadığını kontrol eder
 */
async function allianceExists(allianceId: number): Promise<boolean> {
    const result = await pool.query('SELECT id FROM "Alliance" WHERE id = $1', [
        allianceId,
    ]);
    return result.rows.length > 0;
}

/**
 * Alliance bilgilerini ESI'den çeker ve veritabanına kaydeder
 */
async function processAlliance(allianceId: number) {
    try {
        // Önce veritabanında var mı kontrol et
        const exists = await allianceExists(allianceId);

        if (exists) {
            console.log(`⏭️  Alliance ${allianceId} already exists, skipping...`);
            return;
        }

        console.log(`📥 Processing alliance ${allianceId}...`);

        // ESI'den alliance bilgilerini çek
        const response = await axios.get(`${ESI_BASE_URL}/alliances/${allianceId}/`);
        const data = response.data;

        // Rate limit header'larını kontrol et
        const errorLimitRemain = response.headers['x-esi-error-limit-remain'];
        if (errorLimitRemain && parseInt(errorLimitRemain) < 20) {
            console.log(
                `⚠️  Error limit low (${errorLimitRemain}/100), slowing down...`
            );
            await sleep(2000); // 2 saniye bekle
        }

        // Veritabanına kaydet
        const query = `
      INSERT INTO "Alliance" (
        id, name, ticker, date_founded,
        creator_corporation_id, creator_id, executor_corporation_id, faction_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

        await pool.query(query, [
            allianceId,
            data.name,
            data.ticker,
            data.date_founded,
            data.creator_corporation_id,
            data.creator_id,
            data.executor_corporation_id,
            data.faction_id || null,
        ]);

        console.log(`✅ Saved alliance ${allianceId} - ${data.name}`);

        // Rate limit için kısa bekle
        await sleep(RATE_LIMIT_DELAY);
    } catch (error: any) {
        if (error.response?.status === 404) {
            console.log(`⚠️  Alliance ${allianceId} not found (404)`);
        } else if (error.response?.status === 420) {
            console.log(`🛑 Error limited (420)! Waiting 60 seconds...`);
            await sleep(60000);
            throw error; // Mesajı tekrar kuyruğa al
        } else {
            console.error(`❌ Error processing alliance ${allianceId}:`, error.message);
        }
        throw error;
    }
}

/**
 * Worker - RabbitMQ'dan mesaj alır ve işler
 */
async function startWorker() {
    try {
        const channel = await getRabbitMQChannel();

        console.log('🚀 Alliance Worker Started');
        console.log('==========================');
        console.log(`📡 Listening to queue: ${QUEUE_NAME}`);
        console.log(`⏱️  Rate limit: ${1000 / RATE_LIMIT_DELAY} requests/second\n`);

        // Aynı anda sadece 1 mesaj işle
        channel.prefetch(1);

        channel.consume(
            QUEUE_NAME,
            async (msg) => {
                if (!msg) return;

                const allianceId = parseInt(msg.content.toString());

                if (isNaN(allianceId)) {
                    console.error('❌ Invalid alliance ID:', msg.content.toString());
                    channel.ack(msg);
                    return;
                }

                try {
                    await processAlliance(allianceId);
                    channel.ack(msg); // Başarılı, mesajı onayla
                } catch (error) {
                    // Hata varsa mesajı tekrar kuyruğa ekleme (sonsuz döngü önleme)
                    channel.nack(msg, false, false);
                }
            },
            { noAck: false }
        );

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down worker...');
            await channel.close();
            await pool.end();
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
