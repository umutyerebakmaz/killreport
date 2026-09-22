import { beforeEach, describe, expect, it, vi } from 'vitest';
import type amqp from 'amqplib';
import { RETRY_TOPOLOGY } from '@services/queue-names';
import {
  deathCount,
  handleWorkerError,
  isForbidden,
  MAX_ATTEMPTS,
} from './worker-error';

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

    // The timer is the behaviour in this branch: without the await on
    // sleep(), the function would fall straight through to nack, and the
    // assertions below would pass whether or not the wait happened.
    expect(channel.nack).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    await done;
    vi.useRealTimers();

    // requeue: true — back to the head of its own queue, no DLX hop, so the
    // attempt counter does not move. Being error-limited is not a defect in
    // the message.
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('waits and requeues on 429 without burning an attempt', async () => {
    vi.useFakeTimers();
    const error = { response: { status: 429 } };
    const done = handleWorkerError(
      channel,
      message(4),
      'esi_type_info_queue',
      error,
      logger,
    );

    // Same shape as the 420 assertion above: without the await on sleep(),
    // this would fall straight through to nack, and the assertions below
    // would pass whether or not the wait happened.
    expect(channel.nack).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    await done;
    vi.useRealTimers();

    // requeue: true — back to the head of its own queue, no DLX hop, so the
    // attempt counter does not move. 429 is the same signal as 420 with a
    // different number.
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('waits and requeues on a 420 detected from the error message', async () => {
    vi.useFakeTimers();
    // The shape thrown by zkillboard.ts / killmail.service.ts /
    // character.service.ts: a fetch() caller with no `response.status`,
    // the code only in the message text.
    const error = new Error('zKillboard API error: 420');
    const done = handleWorkerError(
      channel,
      message(4),
      'esi_type_info_queue',
      error,
      logger,
    );

    // Same shape as the response.status assertion above: without the await
    // on sleep(), this would fall straight through to nack, and the
    // assertions below would pass whether or not the wait happened.
    expect(channel.nack).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    await done;
    vi.useRealTimers();

    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('waits and requeues on a 429 detected from the error message', async () => {
    vi.useFakeTimers();
    const error = new Error(
      'Failed to fetch character killmails: 429 - Too Many Requests',
    );
    const done = handleWorkerError(
      channel,
      message(4),
      'esi_type_info_queue',
      error,
      logger,
    );

    expect(channel.nack).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    await done;
    vi.useRealTimers();

    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('does not treat a status-like substring as a rate limit (word boundary)', async () => {
    // A message containing "1420" or "4291" must not match \b(420|429)\b.
    await handleWorkerError(
      channel,
      message(1),
      'esi_type_info_queue',
      new Error('ESI error 1420 while fetching type'),
      logger,
    );

    // Falls through to the ordinary failure path: nack without requeue.
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
  });

  it('acks a 404 detected from the error message', async () => {
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

  it('acks a 404 detected from response.status, regardless of the message text', async () => {
    await handleWorkerError(
      channel,
      message(),
      'esi_type_info_queue',
      { message: 'Not Found', response: { status: 404 } },
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

  it('parks on exactly the MAX_ATTEMPTS-th delivery, not the one before it', async () => {
    // deathCount MAX_ATTEMPTS - 2 is the (MAX_ATTEMPTS - 1)th delivery: still
    // under the limit, so it retries rather than parking.
    await handleWorkerError(
      channel,
      message(MAX_ATTEMPTS - 2),
      'esi_type_info_queue',
      new Error('ESI 500'),
      logger,
    );
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(channel.publish).not.toHaveBeenCalled();

    vi.clearAllMocks();

    // deathCount MAX_ATTEMPTS - 1 is the MAX_ATTEMPTS-th delivery: this is
    // the one that parks. A message gets MAX_ATTEMPTS deliveries in total.
    await handleWorkerError(
      channel,
      message(MAX_ATTEMPTS - 1),
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

  it('forwards x-death on the parked message so an operator can read its origin', async () => {
    // backend/docs/ops/rabbitmq.md has an operator open a parked message and
    // read its origin queue, failure reason and hop count out of x-death —
    // that only works if parking preserves the header instead of dropping it.
    const msg = message(MAX_ATTEMPTS - 1);

    await handleWorkerError(
      channel,
      msg,
      'esi_type_info_queue',
      new Error('ESI 500'),
      logger,
    );

    expect(channel.publish).toHaveBeenCalledWith(
      '',
      RETRY_TOPOLOGY.parking,
      expect.any(Buffer),
      expect.objectContaining({ headers: msg.properties.headers }),
    );
  });

  it('settles the message exactly once on every path', async () => {
    for (const deaths of [0, 1, MAX_ATTEMPTS - 1]) {
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

describe('isForbidden', () => {
  it('is true for a 403 on the errors response', () => {
    expect(isForbidden({ response: { status: 403 } })).toBe(true);
  });

  it('is true for a 403 that only appears in the message text', () => {
    expect(isForbidden(new Error('ESI returned 403 Forbidden'))).toBe(true);
  });

  it('does not treat a status-like substring as a 403 (word boundary)', () => {
    expect(isForbidden(new Error('corporation 4030 has no killmails'))).toBe(
      false,
    );
  });

  it('is false for the other statuses this module already routes', () => {
    expect(isForbidden({ response: { status: 404 } })).toBe(false);
    expect(isForbidden({ response: { status: 420 } })).toBe(false);
    expect(isForbidden(new Error('boom'))).toBe(false);
  });
});
