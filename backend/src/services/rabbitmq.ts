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
