import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Publishing entity IDs on a confirm channel. Its reason for existing: a
 * queue script that `process.exit`s right after `sendToQueue` can lose
 * whatever the broker had not taken yet, while still logging success.
 */

const { channel, getRabbitMQConfirmChannel } = vi.hoisted(() => {
  const channel = {
    sendToQueue: vi.fn(),
    waitForConfirms: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  return { channel, getRabbitMQConfirmChannel: vi.fn(async () => channel) };
});

vi.mock('@services/rabbitmq', () => ({ getRabbitMQConfirmChannel }));

import { EventEmitter } from 'node:events';
import type amqp from 'amqplib';
import {
  publishEntitiesConfirmed,
  sendEntitiesConfirmed,
} from './publish-entities';

const QUEUE = 'esi_corporation_info_queue';
const SOURCE = 'queue-character-corporations';

beforeEach(() => {
  vi.clearAllMocks();
  channel.waitForConfirms.mockResolvedValue(undefined);
});

describe('publishEntitiesConfirmed', () => {
  it('publishes one persistent message per id, in order', async () => {
    const published = await publishEntitiesConfirmed(QUEUE, SOURCE, [7, 8]);

    expect(published).toBe(2);
    expect(channel.sendToQueue).toHaveBeenCalledTimes(2);
    const [queue, content, options] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe(QUEUE);
    expect(JSON.parse(content.toString())).toEqual({
      entityId: 7,
      queuedAt: expect.any(String),
      source: SOURCE,
    });
    expect(options).toEqual({ persistent: true });
    expect(
      JSON.parse(channel.sendToQueue.mock.calls[1][1].toString()).entityId,
    ).toBe(8);
  });

  it('passes priority when given', async () => {
    await publishEntitiesConfirmed(QUEUE, SOURCE, [7], { priority: 5 });

    expect(channel.sendToQueue.mock.calls[0][2]).toEqual({
      persistent: true,
      priority: 5,
    });
  });

  it('reports batches of 100', async () => {
    const onBatch = vi.fn();
    const ids = Array.from({ length: 250 }, (_, i) => i + 1);

    await publishEntitiesConfirmed(QUEUE, SOURCE, ids, { onBatch });

    expect(onBatch.mock.calls).toEqual([
      [1, 3, 100],
      [2, 3, 100],
      [3, 3, 50],
    ]);
  });

  it('waits for confirms before resolving', async () => {
    await publishEntitiesConfirmed(QUEUE, SOURCE, [7]);

    expect(channel.waitForConfirms).toHaveBeenCalledTimes(1);
  });

  it('rejects when the broker nacks', async () => {
    const nack = new Error('message(s) nacked');
    channel.waitForConfirms.mockRejectedValueOnce(nack);

    await expect(publishEntitiesConfirmed(QUEUE, SOURCE, [7])).rejects.toBe(
      nack,
    );
  });

  it('keeps the confirm error when closing the dead channel fails too', async () => {
    const lost = new Error('channel closed');
    channel.waitForConfirms.mockRejectedValueOnce(lost);
    channel.close.mockRejectedValueOnce(new Error('Channel closed'));

    await expect(publishEntitiesConfirmed(QUEUE, SOURCE, [7])).rejects.toBe(
      lost,
    );
  });

  it('closes the confirm channel even on nack', async () => {
    channel.waitForConfirms.mockRejectedValueOnce(new Error('nacked'));

    await publishEntitiesConfirmed(QUEUE, SOURCE, [7]).catch(() => {});

    expect(channel.close).toHaveBeenCalledTimes(1);
  });
});

/**
 * A long-lived confirm channel whose confirms the test settles by hand:
 * every sendToQueue callback waits in `callbacks` until the test calls it.
 */
function confirmChannel() {
  const emitter = new EventEmitter();
  const callbacks: Array<(err: unknown) => void> = [];
  const fake = Object.assign(emitter, {
    sendToQueue: vi.fn(
      (_q: string, _b: Buffer, _o: unknown, cb: (err: unknown) => void) => {
        callbacks.push(cb);
        return true;
      },
    ),
    close: vi.fn(async () => {}),
  });
  return { channel: fake as unknown as amqp.ConfirmChannel, fake, callbacks };
}

describe('sendEntitiesConfirmed', () => {
  it('resolves once every send is acked', async () => {
    const { channel, fake, callbacks } = confirmChannel();

    const sent = sendEntitiesConfirmed(channel, QUEUE, SOURCE, [7, 8]);
    callbacks.forEach((cb) => cb(null));

    await expect(sent).resolves.toBe(2);
    const [queue, content, options] = fake.sendToQueue.mock.calls[0];
    expect(queue).toBe(QUEUE);
    expect(JSON.parse(content.toString())).toEqual({
      entityId: 7,
      queuedAt: expect.any(String),
      source: SOURCE,
    });
    expect(options).toEqual({ persistent: true });
  });

  it('rejects when one send is nacked', async () => {
    const { channel, callbacks } = confirmChannel();

    const sent = sendEntitiesConfirmed(channel, QUEUE, SOURCE, [7, 8]);
    callbacks[0](null);
    callbacks[1](new Error('nack'));

    await expect(sent).rejects.toThrow('nack');
  });

  it('rejects pending sends when the channel closes', async () => {
    const { channel, fake } = confirmChannel();

    const sent = sendEntitiesConfirmed(channel, QUEUE, SOURCE, [7]);
    fake.emit('close');

    await expect(sent).rejects.toThrow();
  });

  it('sends nothing for an empty list', async () => {
    const { channel, fake } = confirmChannel();

    await expect(
      sendEntitiesConfirmed(channel, QUEUE, SOURCE, []),
    ).resolves.toBe(0);
    expect(fake.sendToQueue).not.toHaveBeenCalled();
  });

  it('does not close the channel', async () => {
    const { channel, fake, callbacks } = confirmChannel();

    const sent = sendEntitiesConfirmed(channel, QUEUE, SOURCE, [7]);
    callbacks[0](null);
    await sent;

    expect(fake.close).not.toHaveBeenCalled();
  });

  it('stops listening once it has settled', async () => {
    const { channel, fake, callbacks } = confirmChannel();

    const sent = sendEntitiesConfirmed(channel, QUEUE, SOURCE, [7]);
    callbacks[0](null);
    await sent;

    expect(fake.listenerCount('close')).toBe(0);
    expect(fake.listenerCount('error')).toBe(0);
  });
});
