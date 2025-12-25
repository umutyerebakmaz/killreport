import { Channel } from 'amqplib';
import logger from './logger';
import { getRabbitMQChannel } from './rabbitmq';

interface QueueMessage<T = any> {
  data: T;
  queuedAt: string;
}

interface QueueOptions {
  durable?: boolean;
  priority?: number;
  maxPriority?: number;
  persistent?: boolean;
}

export class QueueService {
  private static instance: QueueService;
  private channel: Channel | null = null;

  private constructor() {}

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  private async getChannel(): Promise<Channel> {
    if (!this.channel) {
      this.channel = await getRabbitMQChannel();
    }
    return this.channel;
  }

  async assertQueue(
    queueName: string,
    options: QueueOptions = {}
  ): Promise<void> {
    const {
      durable = true,
      maxPriority = 10,
    } = options;

    const channel = await this.getChannel();
    
    await channel.assertQueue(queueName, {
      durable,
      arguments: {
        'x-max-priority': maxPriority,
      },
    });

    logger.debug(`Queue asserted: ${queueName}`);
  }

  async sendToQueue<T>(
    queueName: string,
    data: T,
    options: QueueOptions = {}
  ): Promise<boolean> {
    const {
      priority = 5,
      persistent = true,
    } = options;

    try {
      const channel = await this.getChannel();
      
      await this.assertQueue(queueName);

      const message: QueueMessage<T> = {
        data,
        queuedAt: new Date().toISOString(),
      };

      const result = channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        {
          persistent,
          priority,
        }
      );

      logger.debug(`Message sent to queue: ${queueName}`, { priority });
      return result;
    } catch (error) {
      logger.error(`Failed to send message to queue ${queueName}:`, error);
      throw error;
    }
  }

  async getQueueStats(queueName: string): Promise<{
    queue: string;
    messageCount: number;
    consumerCount: number;
  }> {
    try {
      const channel = await this.getChannel();
      const queueInfo = await channel.checkQueue(queueName);

      return {
        queue: queueName,
        messageCount: queueInfo.messageCount,
        consumerCount: queueInfo.consumerCount,
      };
    } catch (error) {
      logger.error(`Failed to get queue stats for ${queueName}:`, error);
      throw error;
    }
  }

  async purgeQueue(queueName: string): Promise<number> {
    try {
      const channel = await this.getChannel();
      const result = await channel.purgeQueue(queueName);
      
      logger.info(`Purged ${result.messageCount} messages from queue: ${queueName}`);
      return result.messageCount;
    } catch (error) {
      logger.error(`Failed to purge queue ${queueName}:`, error);
      throw error;
    }
  }

  async deleteQueue(queueName: string): Promise<void> {
    try {
      const channel = await this.getChannel();
      await channel.deleteQueue(queueName);
      
      logger.info(`Deleted queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to delete queue ${queueName}:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
      logger.info('Queue service channel closed');
    }
  }
}

export const queueService = QueueService.getInstance();
