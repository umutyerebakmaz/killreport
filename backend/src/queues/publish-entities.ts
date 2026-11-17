import { getRabbitMQConfirmChannel } from '@services/rabbitmq';

/** IDs per progress report, as the queue scripts have always counted. */
const BATCH_SIZE = 100;

export interface PublishEntitiesOptions {
  /** Written only when given; most info publishers send none. */
  priority?: number;
  /** After each batch of 100 is sent: batch counts from 1. */
  onBatch?: (batch: number, totalBatches: number, size: number) => void;
}

/**
 * Publish one persistent `{ entityId, queuedAt, source }` message per ID onto
 * `queue`, in order, and resolve only once the broker has confirmed them all.
 * The Node counterpart of the Rust `mq::publish_entities`. A nack rejects.
 * Returns how many messages were published.
 */
export async function publishEntitiesConfirmed(
  queue: string,
  source: string,
  ids: number[],
  options: PublishEntitiesOptions = {},
): Promise<number> {
  const { priority, onBatch } = options;
  const publishOptions =
    priority === undefined
      ? { persistent: true }
      : { persistent: true, priority };
  const totalBatches = Math.ceil(ids.length / BATCH_SIZE);

  const channel = await getRabbitMQConfirmChannel();
  try {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      for (const entityId of batch) {
        const message = {
          entityId,
          queuedAt: new Date().toISOString(),
          source,
        };
        channel.sendToQueue(
          queue,
          Buffer.from(JSON.stringify(message)),
          publishOptions,
        );
      }
      onBatch?.(i / BATCH_SIZE + 1, totalBatches, batch.length);
    }
    await channel.waitForConfirms();
  } finally {
    // On a channel that has already died, close() rejects as well; letting
    // that through would replace the confirm error, which is the real cause.
    await channel.close().catch(() => {});
  }
  return ids.length;
}
