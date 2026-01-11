import amqp from 'amqplib';
import { config } from '../config';

let channel: amqp.Channel | null = null;
let connection: amqp.Connection | null = null;

// Shared connection for monitoring to avoid overwhelming RabbitMQ
let monitoringConnection: amqp.Connection | null = null;
let monitoringChannel: amqp.Channel | null = null;
let lastConnectionAttempt = 0;
const CONNECTION_RETRY_DELAY = 2000; // 2 seconds between retry attempts (frontend polls every 5s)

// All queues used in the system
const ALL_QUEUES = [
  // ESI Info Workers (entity enrichment)
  'esi_alliance_info_queue',
  'esi_character_info_queue',
  'esi_corporation_info_queue',
  'esi_type_info_queue',
  'esi_category_info_queue',
  'esi_item_group_info_queue',

  // ESI Sync Workers
  'esi_alliance_corporations_queue',

  // ESI Universe Workers
  'esi_regions_queue',
  'esi_constellations_queue',
  'esi_solar_systems_queue',

  // zKillboard Workers
  'zkillboard_character_queue',
];

export async function getRabbitMQChannel(): Promise<amqp.Channel> {
  if (channel) {
    return channel;
  }

  try {
    const conn = await amqp.connect(config.rabbitmq.url) as unknown as amqp.Connection;
    connection = conn;

    // Handle connection errors
    conn.on('error', (err) => {
      console.error('RabbitMQ connection error:', err.message);
      channel = null;
      connection = null;
    });

    conn.on('close', () => {
      console.log('RabbitMQ connection closed');
      channel = null;
      connection = null;
    });

    const ch = await (conn as any).createChannel() as amqp.Channel;
    channel = ch;
    await ch.assertQueue(config.rabbitmq.queue, { durable: true });
    console.log('Connected to RabbitMQ and channel is ready');
    return ch;
  } catch (error) {
    console.error('Failed to connect to RabbitMQ', error);
    throw error;
  }
}

async function getMonitoringChannel(): Promise<amqp.Channel | null> {
  try {
    // If we have a valid channel, return it
    if (monitoringChannel) {
      return monitoringChannel;
    }

    // If we have a connection but no channel, create channel
    if (monitoringConnection && !monitoringChannel) {
      const ch = await (monitoringConnection as any).createChannel() as amqp.Channel;
      monitoringChannel = ch;
      return ch;
    }

    // Check rate limiting for NEW connections only
    const now = Date.now();
    if (now - lastConnectionAttempt < CONNECTION_RETRY_DELAY) {
      return null;
    }

    // Create new connection if needed
    lastConnectionAttempt = now;
    const conn = await amqp.connect(config.rabbitmq.url) as unknown as amqp.Connection;
    monitoringConnection = conn;

    conn.on('error', () => {
      monitoringConnection = null;
      monitoringChannel = null;
    });

    conn.on('close', () => {
      monitoringConnection = null;
      monitoringChannel = null;
    });

    const ch = await (conn as any).createChannel() as amqp.Channel;
    monitoringChannel = ch;

    return ch;
  } catch (error) {
    lastConnectionAttempt = Date.now();
    monitoringConnection = null;
    monitoringChannel = null;
    return null;
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
 * Ensure all queues exist in RabbitMQ
 * Called on server startup to make queues visible in management UI
 */
export async function ensureAllQueuesExist(): Promise<void> {
  try {
    const ch = await getRabbitMQChannel();

    console.log('📋 Ensuring all RabbitMQ queues exist...');

    for (const queueName of ALL_QUEUES) {
      await ch.assertQueue(queueName, {
        durable: true,
        arguments: { 'x-max-priority': 10 },
      });
    }

    console.log(`✅ All ${ALL_QUEUES.length} queues verified in RabbitMQ`);
  } catch (error) {
    console.error('❌ Failed to ensure queues exist:', error);
    // Don't throw - server should still start
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
  try {
    const ch = await getMonitoringChannel();

    if (!ch) {
      // Connection not available, return zeros silently
      return {
        messageCount: 0,
        consumerCount: 0,
        exists: false,
      };
    }

    // Use checkQueue to get stats without creating queue
    const queueInfo = await ch.checkQueue(queueName);

    return {
      messageCount: queueInfo.messageCount,
      consumerCount: queueInfo.consumerCount,
      exists: true,
    };
  } catch (error: any) {
    // Queue doesn't exist (404) - return zeros silently
    if (error.code === 404) {
      return {
        messageCount: 0,
        consumerCount: 0,
        exists: false,
      };
    }

    // Connection errors - return zeros silently and reset connection
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.syscall === 'read') {
      monitoringConnection = null;
      monitoringChannel = null;
      return {
        messageCount: 0,
        consumerCount: 0,
        exists: false,
      };
    }

    // Other errors - return zeros silently
    return {
      messageCount: 0,
      consumerCount: 0,
      exists: false,
    };
  }
}/**
 * Get all queue statistics
 */
// Track RabbitMQ connection state
let lastConnectionError: Date | null = null;
let connectionErrorLogged = false;

export async function getAllQueueStats(): Promise<Array<{
  name: string;
  messageCount: number;
  consumerCount: number;
  active: boolean;
}>> {
  const queues = [
    // ESI Info Workers (entity enrichment)
    'esi_alliance_info_queue',
    'esi_character_info_queue',
    'esi_corporation_info_queue',
    'esi_type_info_queue',
    'esi_category_info_queue',
    'esi_item_group_info_queue',
    'esi_type_price_queue',

    // ESI Sync Workers
    'esi_alliance_corporations_queue',

    // ESI Universe Workers
    'esi_regions_queue',
    'esi_constellations_queue',
    'esi_solar_systems_queue',

    // zKillboard Workers
    'zkillboard_character_queue',
  ];

  const results: Array<{
    name: string;
    messageCount: number;
    consumerCount: number;
    active: boolean;
  }> = [];

  let hasConnectionError = false;

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

      // Connection successful - reset error tracking
      if (connectionErrorLogged) {
        console.log('✅ RabbitMQ connection restored');
        connectionErrorLogged = false;
      }
    } catch (error: any) {
      hasConnectionError = true;

      // Add queue with zeros if error
      results.push({
        name: queueName,
        messageCount: 0,
        consumerCount: 0,
        active: false,
      });
    }
  }

  // Log connection error only once every 60 seconds
  if (hasConnectionError) {
    const now = new Date();
    if (!lastConnectionError || (now.getTime() - lastConnectionError.getTime()) > 60000) {
      console.warn('⚠️  RabbitMQ connection failed - worker monitoring unavailable (will retry silently)');
      lastConnectionError = now;
      connectionErrorLogged = true;
    }
  }

  return results;
}
