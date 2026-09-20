import { beforeEach, describe, expect, it, vi } from 'vitest';
import type amqp from 'amqplib';
import { RETRY_TOPOLOGY } from '@services/queue-names';
import { deathCount, handleWorkerError, MAX_ATTEMPTS } from './worker-error';

const channel = {
  nack: vi.fn(),
  ack: vi.fn(),
  publish: vi.fn(),
} as unknown as amqp.Channel;

const logger = { warn: vi.fn(), error: vi.fn() };

/** A delivery, with however many dead-letter hops RabbitMQ has recorded. */
function message(deaths?: number): amqp.ConsumeMessage {
  return {
    content: Buffer.from('4321'),
    fields: {},
    properties: {
      headers:
        deaths === undefined
          ? {}
          : { 'x-death': [{ count: deaths, queue: 'esi_type_info_queue' }] },
    },
  } as unknown as amqp.ConsumeMessage;
}

beforeEach(() => vi.clearAllMocks());

describe('deathCount', () => {
  it('is 0 on a first delivery, which carries no x-death', () => {
    expect(deathCount(message())).toBe(0);
  });

  it('reads the brokers own counter', () => {
    expect(deathCount(message(3))).toBe(3);
  });
});

describe('handleWorkerError', () => {
  it('waits and requeues on 420 without burning an attempt', async () => {
    vi.useFakeTimers();
    const error = { response: { status: 420 } };
    const done = handleWorkerError(
      channel,
      message(4),
      'esi_type_info_queue',
      error,
      logger,
    );
    await vi.advanceTimersByTimeAsync(60_000);
    await done;
    vi.useRealTimers();

    // requeue: true — back to the head of its own queue, no DLX hop, so the
    // attempt counter does not move. Being error-limited is not a defect in
    // the message.
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('acks a 404 rather than retrying something that will never exist', async () => {
    await handleWorkerError(
      channel,
      message(),
      'esi_type_info_queue',
      new Error('Request failed with status code 404'),
      logger,
    );

    expect(channel.ack).toHaveBeenCalledOnce();
    expect(channel.nack).not.toHaveBeenCalled();
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('nacks without requeue so the message takes the DLX path', async () => {
    await handleWorkerError(
      channel,
      message(1),
      'esi_type_info_queue',
      new Error('ESI 500'),
      logger,
    );

    // requeue: false is what sends it to killreport.dlx -> wait -> back.
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('parks the message once it has used every attempt', async () => {
    await handleWorkerError(
      channel,
      message(MAX_ATTEMPTS),
      'esi_type_info_queue',
      new Error('ESI 500'),
      logger,
    );

    expect(channel.publish).toHaveBeenCalledWith(
      '',
      RETRY_TOPOLOGY.parking,
      expect.any(Buffer),
      expect.objectContaining({ persistent: true }),
    );
    expect(channel.ack).toHaveBeenCalledOnce();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('settles the message exactly once on every path', async () => {
    for (const deaths of [0, 1, MAX_ATTEMPTS]) {
      vi.clearAllMocks();
      await handleWorkerError(
        channel,
        message(deaths),
        'esi_type_info_queue',
        new Error('boom'),
        logger,
      );
      const settled =
        (channel.ack as ReturnType<typeof vi.fn>).mock.calls.length +
        (channel.nack as ReturnType<typeof vi.fn>).mock.calls.length;
      // A message settled twice is a channel error; settled zero times is a
      // worker that stops consuming once prefetch fills.
      expect(settled).toBe(1);
    }
  });
});
