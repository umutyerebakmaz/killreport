import type amqp from 'amqplib';
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

/**
 * Publish one persistent `{ entityId, queuedAt, source }` message per ID on a
 * long-lived confirm channel the caller owns, and resolve once the broker
 * has acked every one of them. Each message waits for its own confirm, so
 * concurrent callers on the same channel do not wait for each other, which
 * `waitForConfirms()` would make them do.
 *
 * A nack rejects. So does the channel closing or erroring before every
 * confirm is in: the pending sends are not assumed to be settled by the
 * library. The channel is left open.
 */
export async function sendEntitiesConfirmed(
  channel: amqp.ConfirmChannel,
  queue: string,
  source: string,
  ids: number[],
): Promise<number> {
  if (ids.length === 0) return 0;

  let onLost: (err?: unknown) => void = () => {};
  const lost = new Promise<never>((_, reject) => {
    onLost = (err?: unknown) =>
      reject(
        err instanceof Error
          ? err
          : new Error('confirm channel closed before every confirm came in'),
      );
  });
  channel.once('close', onLost);
  channel.once('error', onLost);

  try {
    const confirms = ids.map(
      (entityId) =>
        new Promise<void>((resolve, reject) => {
          const message = {
            entityId,
            queuedAt: new Date().toISOString(),
            source,
          };
          channel.sendToQueue(
            queue,
            Buffer.from(JSON.stringify(message)),
            { persistent: true },
            (err) => (err ? reject(err) : resolve()),
          );
        }),
    );
    await Promise.race([Promise.all(confirms), lost]);
    return ids.length;
  } finally {
    channel.removeListener('close', onLost);
    channel.removeListener('error', onLost);
  }
}
