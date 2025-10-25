import '../config';
import { pool } from '../services/database';
import { esiService } from '../services/esi';
import { QueueType, rabbitmqService } from '../services/rabbitmq-enhanced';

interface WorkerConfig {
  queueType: QueueType;
  processor: (message: any) => Promise<void>;
}

/**
 * Alliance worker - Alliance bilgilerini ESI'den çeker ve database'e kaydeder
 */
async function processAllianceMessage(message: any) {
  const allianceId = typeof message === 'number' ? message : message.id;

  try {
    console.log(`[Alliance Worker] Processing alliance ID: ${allianceId}`);

    const allianceData = await esiService.getAlliance(allianceId);

    const query = `
      INSERT INTO "Alliance" (id, name, ticker, date_founded, creator_corporation_id, creator_id, executor_corporation_id, faction_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        ticker = EXCLUDED.ticker,
        date_founded = EXCLUDED.date_founded,
        creator_corporation_id = EXCLUDED.creator_corporation_id,
        creator_id = EXCLUDED.creator_id,
        executor_corporation_id = EXCLUDED.executor_corporation_id,
        faction_id = EXCLUDED.faction_id,
        updated_at = NOW();
    `;

    const values = [
      allianceId,
      allianceData.name,
      allianceData.ticker,
      allianceData.date_founded,
      allianceData.creator_corporation_id,
      allianceData.creator_id,
      allianceData.executor_corporation_id,
      allianceData.faction_id || null,
    ];

    await pool.query(query, values);
    console.log(`[Alliance Worker] ✓ Saved alliance ${allianceId} - ${allianceData.name}`);
  } catch (error: any) {
    console.error(`[Alliance Worker] ✗ Error processing alliance ${allianceId}:`, error.message);
    throw error;
  }
}

/**
 * Corporation worker - Corporation bilgilerini ESI'den çeker ve database'e kaydeder
 */
async function processCorporationMessage(message: any) {
  const corporationId = typeof message === 'number' ? message : message.id;

  try {
    console.log(`[Corporation Worker] Processing corporation ID: ${corporationId}`);

    const corpData = await esiService.getCorporation(corporationId);

    const query = `
      INSERT INTO "Corporation" (id, name, ticker, member_count, ceo_id, creator_id, date_founded,
                                 description, alliance_id, faction_id, home_station_id, shares, tax_rate, url, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        ticker = EXCLUDED.ticker,
        member_count = EXCLUDED.member_count,
        ceo_id = EXCLUDED.ceo_id,
        alliance_id = EXCLUDED.alliance_id,
        tax_rate = EXCLUDED.tax_rate,
        updated_at = NOW();
    `;

    const values = [
      corporationId,
      corpData.name,
      corpData.ticker,
      corpData.member_count,
      corpData.ceo_id,
      corpData.creator_id,
      corpData.date_founded || null,
      corpData.description || null,
      corpData.alliance_id || null,
      corpData.faction_id || null,
      corpData.home_station_id || null,
      corpData.shares || null,
      corpData.tax_rate,
      corpData.url || null,
    ];

    await pool.query(query, values);
    console.log(`[Corporation Worker] ✓ Saved corporation ${corporationId} - ${corpData.name}`);
  } catch (error: any) {
    console.error(`[Corporation Worker] ✗ Error processing corporation ${corporationId}:`, error.message);
    throw error;
  }
}

/**
 * Character worker - Character bilgilerini ESI'den çeker ve database'e kaydeder
 */
async function processCharacterMessage(message: any) {
  const characterId = typeof message === 'number' ? message : message.id;

  try {
    console.log(`[Character Worker] Processing character ID: ${characterId}`);

    const charData = await esiService.getCharacter(characterId);

    const query = `
      INSERT INTO "Character" (id, name, corporation_id, alliance_id, birthday, bloodline_id,
                              race_id, gender, security_status, description, title, faction_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        corporation_id = EXCLUDED.corporation_id,
        alliance_id = EXCLUDED.alliance_id,
        security_status = EXCLUDED.security_status,
        title = EXCLUDED.title,
        updated_at = NOW();
    `;

    const values = [
      characterId,
      charData.name,
      charData.corporation_id,
      charData.alliance_id || null,
      charData.birthday,
      charData.bloodline_id,
      charData.race_id,
      charData.gender,
      charData.security_status || null,
      charData.description || null,
      charData.title || null,
      charData.faction_id || null,
    ];

    await pool.query(query, values);
    console.log(`[Character Worker] ✓ Saved character ${characterId} - ${charData.name}`);
  } catch (error: any) {
    console.error(`[Character Worker] ✗ Error processing character ${characterId}:`, error.message);
    throw error;
  }
}

/**
 * Worker yapılandırmaları
 */
const WORKER_CONFIGS: WorkerConfig[] = [
  {
    queueType: QueueType.ALLIANCE,
    processor: processAllianceMessage,
  },
  {
    queueType: QueueType.CORPORATION,
    processor: processCorporationMessage,
  },
  {
    queueType: QueueType.CHARACTER,
    processor: processCharacterMessage,
  },
];

/**
 * Worker'ı başlatır
 */
async function startWorker() {
  try {
    console.log('🚀 Starting ESI Worker...');
    console.log('================================');

    // Hangi worker'ların çalışacağını belirle (environment variable ile)
    const workerTypes = process.env.WORKER_TYPES?.split(',') || ['ALLIANCE'];

    console.log(`Worker types: ${workerTypes.join(', ')}`);

    // Her worker tipi için consumer başlat
    for (const config of WORKER_CONFIGS) {
      const queueName = config.queueType.toString();

      if (workerTypes.includes(queueName.replace('_sync_queue', '').toUpperCase())) {
        await rabbitmqService.consume(config.queueType, async (message, channel, msg) => {
          try {
            await config.processor(message);
            channel.ack(msg);
          } catch (error) {
            console.error(`Error in ${config.queueType} processor:`, error);
            // Hatalı mesajları tekrar kuyruğa ekleme
            channel.nack(msg, false, false);
          }
        });
      }
    }

    console.log('================================');
    console.log('✓ Workers are ready and waiting for messages...');
    console.log('================================\n');

    // ESI rate limit durumunu periyodik olarak göster
    setInterval(() => {
      const status = esiService.getRateLimitStatus();
      console.log(`[Rate Limit] Remaining: ${status.errorLimitRemaining}/100, Queue: ${status.queueLength} pending`);
    }, 30000); // Her 30 saniyede bir

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down worker...');
      await rabbitmqService.close();
      await pool.end();
      console.log('✓ Worker stopped gracefully');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\nShutting down worker...');
      await rabbitmqService.close();
      await pool.end();
      console.log('✓ Worker stopped gracefully');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();
