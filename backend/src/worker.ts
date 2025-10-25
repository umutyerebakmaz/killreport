import axios from 'axios';
import { getRabbitMQChannel } from './services/rabbitmq';
import { pool } from './services/database';
import './config'; // Load environment variables

const ALLIANCE_TABLE = 'alliances';

async function processMessage(msg: import('amqplib').ConsumeMessage | null) {
  if (msg === null) {
    return;
  }

  const channel = await getRabbitMQChannel();
  const allianceId = parseInt(msg.content.toString());

  if (isNaN(allianceId)) {
    console.error('Received invalid alliance ID:', msg.content.toString());
    channel.ack(msg);
    return;
  }

  try {
    console.log(`Processing alliance ID: ${allianceId}`);

    // 1. Fetch alliance details from ESI
    const response = await axios.get(`https://esi.evetech.net/latest/alliances/${allianceId}/`);
    const allianceData = response.data;

    // 2. Save to PostgreSQL database (using UPSERT)
    const query = `
      INSERT INTO ${ALLIANCE_TABLE} (id, name, ticker, date_founded, creator_corporation_id, creator_id, executor_corporation_id, faction_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
    console.log(`Successfully saved alliance ${allianceId} - ${allianceData.name}`);

    // Acknowledge the message
    channel.ack(msg);

  } catch (error) {
    console.error(`Error processing alliance ID ${allianceId}:`, error);
    // In case of error, reject the message but don't requeue it to avoid infinite loops
    // for messages that will always fail.
    channel.nack(msg, false, false);
  }
}

async function startWorker() {
  try {
    const channel = await getRabbitMQChannel();
    const queue = 'alliance_sync_queue';

    console.log(`Worker is waiting for messages in queue: ${queue}`);

    // Set prefetch to 1 to ensure only one message is processed at a time by this worker
    channel.prefetch(1);

    channel.consume(queue, processMessage, { noAck: false });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Closing RabbitMQ channel and connection...');
      await channel.close();
      await pool.end();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();
