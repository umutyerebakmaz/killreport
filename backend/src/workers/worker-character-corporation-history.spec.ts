import { beforeEach, describe, expect, it, vi } from 'vitest';
import type amqp from 'amqplib';

/**
 * One character's history: fetch from ESI, save, then queue the corporations
 * whose names are not in the database yet — closed ones included, ESI still
 * answers for those.
 */

const {
  getCorporationHistory,
  saveCorporationHistory,
  findMissing,
  sendEntitiesConfirmed,
} = vi.hoisted(() => ({
  getCorporationHistory: vi.fn(),
  saveCorporationHistory: vi.fn(),
  findMissing: vi.fn(),
  sendEntitiesConfirmed: vi.fn(async (_c, _q, _s, ids: number[]) => ids.length),
}));

vi.mock('@services/character', () => ({
  CharacterService: { getCorporationHistory },
}));
vi.mock('@services/character/character-corporation-history-writer', () => ({
  saveCorporationHistory,
  findMissingCorporationIds: findMissing,
}));
// The real module validates the environment and exits where there is no .env,
// as in CI
vi.mock('@config/config', () => ({
  config: { esi: { prefetch: 25, maxRequestsPerSecond: 50 } },
}));
vi.mock('@services/prisma-worker', () => ({ default: {} }));
vi.mock('@services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/rabbitmq', () => ({
  ensureAllQueuesExist: vi.fn(),
  getRabbitMQChannel: vi.fn(),
  getRabbitMQConfirmChannel: vi.fn(),
}));
vi.mock('../queues/publish-entities', () => ({ sendEntitiesConfirmed }));

import { EventEmitter } from 'node:events';
import {
  processCharacter,
  runConsumeTurn,
} from './worker-character-corporation-history';

const channel = {} as unknown as amqp.ConfirmChannel;

const RECORDS = [
  {
    corporation_id: 98221968,
    record_id: 3,
    start_date: '2026-06-05T14:57:00Z',
  },
  {
    corporation_id: 109299958,
    record_id: 2,
    start_date: '2015-03-24T11:44:00Z',
  },
  { corporation_id: 1000171, record_id: 1, start_date: '2015-03-24T11:37:00Z' },
];

beforeEach(() => vi.clearAllMocks());

describe('processCharacter', () => {
  it('saves the history and queues the one corporation missing from the database', async () => {
    getCorporationHistory.mockResolvedValue(RECORDS);
    findMissing.mockResolvedValue([109299958]);

    const result = await processCharacter(channel, 42);

    expect(saveCorporationHistory).toHaveBeenCalledWith(
      42,
      RECORDS,
      expect.any(Date),
    );
    expect(findMissing).toHaveBeenCalledWith([98221968, 109299958, 1000171]);
    expect(sendEntitiesConfirmed).toHaveBeenCalledWith(
      channel,
      'esi_corporation_info_queue',
      'worker-character-corporation-history',
      [109299958],
    );
    expect(result).toEqual({ records: 3, missingCorporations: 1 });
  });

  it('queues nothing when every corporation is known', async () => {
    getCorporationHistory.mockResolvedValue(RECORDS);
    findMissing.mockResolvedValue([]);

    await processCharacter(channel, 42);

    expect(sendEntitiesConfirmed).not.toHaveBeenCalled();
  });

  it('does not resolve before the corporation messages are confirmed', async () => {
    getCorporationHistory.mockResolvedValue(RECORDS);
    findMissing.mockResolvedValue([109299958]);
    let confirm!: (n: number) => void;
    sendEntitiesConfirmed.mockReturnValueOnce(
      new Promise<number>((resolve) => (confirm = resolve)),
    );

    let settled = false;
    const done = processCharacter(channel, 42).then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 0));
    expect(settled).toBe(false);

    confirm(1);
    await done;
    expect(settled).toBe(true);
  });

  it('rejects when publishing fails, so the character is not acked', async () => {
    getCorporationHistory.mockResolvedValue(RECORDS);
    findMissing.mockResolvedValue([109299958]);
    sendEntitiesConfirmed.mockRejectedValueOnce(new Error('nack'));

    await expect(processCharacter(channel, 42)).rejects.toThrow('nack');
  });

  it('saves nothing and rethrows when ESI fails, leaving it to handleWorkerError', async () => {
    getCorporationHistory.mockRejectedValue(new Error('ESI 502'));

    await expect(processCharacter(channel, 42)).rejects.toThrow('ESI 502');
    expect(saveCorporationHistory).not.toHaveBeenCalled();
  });
});

/**
 * One consume turn: it lasts until the consume channel or the confirm channel
 * fails, and on the way out it cancels its consumer and closes the confirm
 * channel. The consume channel is cached by rabbitmq.ts and outlives the
 * turn, so a turn that left its consumer behind would be consumed twice by
 * the next one, and one that left its confirm channel open would leak it.
 */
describe('runConsumeTurn', () => {
  function fakes(consume?: () => Promise<{ consumerTag: string }>) {
    const deliveries: Array<(msg: unknown) => unknown> = [];
    const consumeChannel = Object.assign(new EventEmitter(), {
      consume: vi.fn(async (_q: string, cb: (msg: unknown) => unknown) => {
        deliveries.push(cb);
        return consume ? consume() : { consumerTag: 'tag-1' };
      }),
      cancel: vi.fn(async () => {}),
    });
    const confirmChannel = Object.assign(new EventEmitter(), {
      close: vi.fn(async () => {}),
    });
    return {
      consumeChannel,
      confirmChannel,
      deliveries,
      run: (onMessage = vi.fn(async () => {})) =>
        runConsumeTurn(
          consumeChannel as unknown as amqp.Channel,
          confirmChannel as unknown as amqp.ConfirmChannel,
          onMessage,
        ),
    };
  }

  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('closes the confirm channel when consume fails', async () => {
    const f = fakes(async () => {
      throw new Error('406');
    });

    await expect(f.run()).rejects.toThrow('406');
    expect(f.confirmChannel.close).toHaveBeenCalledTimes(1);
    expect(f.consumeChannel.cancel).not.toHaveBeenCalled();
  });

  it('ends the turn when the confirm channel closes, cancelling the consumer', async () => {
    const f = fakes();
    const turn = f.run();
    await tick();

    f.confirmChannel.emit('close');

    await expect(turn).rejects.toThrow('confirm channel closed');
    expect(f.consumeChannel.cancel).toHaveBeenCalledWith('tag-1');
    expect(f.confirmChannel.close).toHaveBeenCalledTimes(1);
  });

  it('ends the turn when the consume channel closes', async () => {
    const f = fakes();
    const turn = f.run();
    await tick();

    f.consumeChannel.emit('close');

    await expect(turn).rejects.toThrow('channel closed');
    expect(f.confirmChannel.close).toHaveBeenCalledTimes(1);
  });

  it('lifts the listener limit on the confirm channel', async () => {
    const f = fakes();
    const turn = f.run();
    await tick();

    expect(f.confirmChannel.getMaxListeners()).toBe(0);
    f.confirmChannel.emit('close');
    await turn.catch(() => {});
  });

  it('removes its listeners from the cached consume channel', async () => {
    const f = fakes();
    const turn = f.run();
    await tick();

    f.confirmChannel.emit('close');
    await turn.catch(() => {});

    expect(f.consumeChannel.listenerCount('close')).toBe(0);
    expect(f.consumeChannel.listenerCount('error')).toBe(0);
  });

  it('hands every delivery to onMessage', async () => {
    const f = fakes();
    const onMessage = vi.fn(async () => {});
    const turn = f.run(onMessage);
    await tick();

    const msg = { content: Buffer.from('{}') };
    await f.deliveries[0](msg);

    expect(onMessage).toHaveBeenCalledWith(msg);
    f.confirmChannel.emit('close');
    await turn.catch(() => {});
  });
});
