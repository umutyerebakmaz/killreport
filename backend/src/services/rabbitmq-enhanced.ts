import amqp, { Connection } from 'amqplib';
import { config } from '../config';

export enum QueueType {
    ALLIANCE = 'alliance_sync_queue',
    CORPORATION = 'corporation_sync_queue',
    CHARACTER = 'character_sync_queue',
    KILLMAIL = 'killmail_sync_queue',
}

interface QueueConfig {
    name: string;
    durable: boolean;
    prefetch: number;
}

const QUEUE_CONFIGS: Record<QueueType, QueueConfig> = {
    [QueueType.ALLIANCE]: {
        name: QueueType.ALLIANCE,
        durable: true,
        prefetch: 1,
    },
    [QueueType.CORPORATION]: {
        name: QueueType.CORPORATION,
        durable: true,
        prefetch: 1,
    },
    [QueueType.CHARACTER]: {
        name: QueueType.CHARACTER,
        durable: true,
        prefetch: 2, // Characters daha hızlı işlenebilir
    },
    [QueueType.KILLMAIL]: {
        name: QueueType.KILLMAIL,
        durable: true,
        prefetch: 1,
    },
};

class RabbitMQService {
    private connection: Connection | null = null;
    private channels: Map<QueueType, amqp.Channel> = new Map();

    /**
     * RabbitMQ bağlantısını başlatır
     */
    async connect(): Promise<void> {
        if (this.connection) {
            return;
        }

        try {
            const conn = await amqp.connect(config.rabbitmq.url);
            this.connection = conn;
            console.log('✓ Connected to RabbitMQ');

            // Bağlantı hatalarını dinle
            conn.on('error', (err) => {
                console.error('RabbitMQ connection error:', err);
                this.connection = null;
                this.channels.clear();
            });

            conn.on('close', () => {
                console.log('RabbitMQ connection closed');
                this.connection = null;
                this.channels.clear();
            });
        } catch (error) {
            console.error('Failed to connect to RabbitMQ:', error);
            throw error;
        }
    }

    /**
     * Belirtilen queue için channel oluşturur veya mevcut olanı döndürür
     */
    async getChannel(queueType: QueueType): Promise<amqp.Channel> {
        if (this.channels.has(queueType)) {
            return this.channels.get(queueType)!;
        }

        await this.connect();

        if (!this.connection) {
            throw new Error('RabbitMQ connection not established');
        }

        const config = QUEUE_CONFIGS[queueType];
        const channel = await this.connection.createChannel();

        await channel.assertQueue(config.name, { durable: config.durable });
        await channel.prefetch(config.prefetch);

        this.channels.set(queueType, channel);
        console.log(`✓ Channel created for queue: ${config.name}`);

        return channel;
    }

    /**
     * Queue'ya mesaj gönderir
     */
    async publish(queueType: QueueType, message: any): Promise<void> {
        try {
            const channel = await this.getChannel(queueType);
            const config = QUEUE_CONFIGS[queueType];

            const messageBuffer = Buffer.from(JSON.stringify(message));
            channel.sendToQueue(config.name, messageBuffer, { persistent: true });
        } catch (error) {
            console.error(`Failed to publish message to ${queueType}:`, error);
            throw error;
        }
    }

    /**
     * Toplu mesaj gönderimi (batch publishing)
     */
    async publishBatch(queueType: QueueType, messages: any[]): Promise<void> {
        try {
            const channel = await this.getChannel(queueType);
            const config = QUEUE_CONFIGS[queueType];

            for (const message of messages) {
                const messageBuffer = Buffer.from(JSON.stringify(message));
                channel.sendToQueue(config.name, messageBuffer, { persistent: true });
            }

            console.log(`✓ Published ${messages.length} messages to ${queueType}`);
        } catch (error) {
            console.error(`Failed to publish batch to ${queueType}:`, error);
            throw error;
        }
    }

    /**
     * Queue'dan mesaj tüketir
     */
    async consume(
        queueType: QueueType,
        onMessage: (message: any, channel: amqp.Channel, msg: amqp.ConsumeMessage) => Promise<void>
    ): Promise<void> {
        try {
            const channel = await this.getChannel(queueType);
            const config = QUEUE_CONFIGS[queueType];

            console.log(`Worker started consuming from queue: ${config.name}`);

            await channel.consume(
                config.name,
                async (msg) => {
                    if (!msg) {
                        return;
                    }

                    try {
                        const message = JSON.parse(msg.content.toString());
                        await onMessage(message, channel, msg);
                    } catch (error) {
                        console.error(`Error processing message from ${queueType}:`, error);
                        // Hatalı mesajları tekrar kuyruğa ekleme
                        channel.nack(msg, false, false);
                    }
                },
                { noAck: false }
            );
        } catch (error) {
            console.error(`Failed to consume from ${queueType}:`, error);
            throw error;
        }
    }

    /**
     * Queue'daki mesaj sayısını döndürür
     */
    async getQueueMessageCount(queueType: QueueType): Promise<number> {
        try {
            const channel = await this.getChannel(queueType);
            const config = QUEUE_CONFIGS[queueType];
            const queueInfo = await channel.checkQueue(config.name);
            return queueInfo.messageCount;
        } catch (error) {
            console.error(`Failed to get message count for ${queueType}:`, error);
            return 0;
        }
    }

    /**
     * Tüm queue'ları temizler
     */
    async purgeAllQueues(): Promise<void> {
        for (const queueType of Object.values(QueueType)) {
            try {
                const channel = await this.getChannel(queueType);
                const config = QUEUE_CONFIGS[queueType];
                await channel.purgeQueue(config.name);
                console.log(`✓ Purged queue: ${config.name}`);
            } catch (error) {
                console.error(`Failed to purge queue ${queueType}:`, error);
            }
        }
    }

    /**
     * Bağlantıyı kapatır
     */
    async close(): Promise<void> {
        try {
            for (const channel of this.channels.values()) {
                await channel.close();
            }
            this.channels.clear();

            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
            console.log('✓ RabbitMQ connection closed');
        } catch (error) {
            console.error('Error closing RabbitMQ connection:', error);
        }
    }
}

// Singleton instance
export const rabbitmqService = new RabbitMQService();

// Legacy support - eski kodu bozmamak için
let legacyChannel: amqp.Channel | null = null;

export async function getRabbitMQChannel(): Promise<amqp.Channel> {
    if (!legacyChannel) {
        legacyChannel = await rabbitmqService.getChannel(QueueType.ALLIANCE);
    }
    return legacyChannel;
}

export async function publishToQueue(message: string) {
    await rabbitmqService.publish(QueueType.ALLIANCE, message);
}
