import amqp from 'amqplib';
import { config } from '../config';

let channel: amqp.Channel | null = null;

export async function getRabbitMQChannel(): Promise<amqp.Channel> {
  if (channel) {
    return channel;
  }

  try {
    const connection = await amqp.connect(config.rabbitmq.url);
    channel = await connection.createChannel();
    await channel.assertQueue(config.rabbitmq.queue, { durable: true });
    console.log('Connected to RabbitMQ and channel is ready');
    return channel;
  } catch (error) {
    console.error('Failed to connect to RabbitMQ', error);
    throw error;
  }
}

export async function publishToQueue(message: string) {
  try {
    const ch = await getRabbitMQChannel();
    ch.sendToQueue(config.rabbitmq.queue, Buffer.from(message), { persistent: true });
  } catch (error) {
    console.error('Failed to publish message to queue', error);
  }
}

/**
 * Get queue statistics for monitoring
 * Returns 0s if queue doesn't exist instead of throwing error
 * Uses separate channel to avoid conflicts with main channel
 */
export async function getQueueStats(queueName: string): Promise<{
  messageCount: number;
  consumerCount: number;
  exists: boolean;
}> {
  let connection;
  let ch;

  try {
    // Create separate connection for monitoring
    connection = await amqp.connect(config.rabbitmq.url);
    ch = await connection.createChannel();

    // Use checkQueue which doesn't create queue if it doesn't exist
    const queueInfo = await ch.checkQueue(queueName);

    return {
      messageCount: queueInfo.messageCount,
      consumerCount: queueInfo.consumerCount,
      exists: true,
    };
  } catch (error: any) {
    // Queue doesn't exist (404) - this is OK, just return zeros
    if (error.code === 404) {
      return {
        messageCount: 0,
        consumerCount: 0,
        exists: false,
      };
    }
    // Other errors - log and return zeros
    console.error(`Failed to get queue stats for ${queueName}:`, error.message || error);
    return {
      messageCount: 0,
      consumerCount: 0,
      exists: false,
    };
  } finally {
    // Always close connection to avoid leaks
    try {
      if (ch) await ch.close();
      if (connection) await connection.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}/**
 * Get all queue statistics
 */
export async function getAllQueueStats(): Promise<Array<{
  name: string;
  messageCount: number;
  consumerCount: number;
  active: boolean;
}>> {
  const queues = [
    'esi_alliance_info_queue',
    'esi_character_info_queue',
    'esi_corporation_info_queue',
    'esi_type_info_queue',
    'esi_alliance_corporations_queue',
    'esi_all_alliances_queue',
    'esi_all_corporations_queue',
    'zkillboard_character_queue',
  ];

  const results: Array<{
    name: string;
    messageCount: number;
    consumerCount: number;
    active: boolean;
  }> = [];

  // Check each queue sequentially to avoid connection issues
  for (const queueName of queues) {
    try {
      const { messageCount, consumerCount, exists } = await getQueueStats(queueName);
      results.push({
        name: queueName,
        messageCount,
        consumerCount,
        active: consumerCount > 0 && exists,
      });
    } catch (error) {
      console.error(`Error getting stats for ${queueName}:`, error);
      // Add queue with zeros if error
      results.push({
        name: queueName,
        messageCount: 0,
        consumerCount: 0,
        active: false,
      });
    }
  }

  return results;
}
