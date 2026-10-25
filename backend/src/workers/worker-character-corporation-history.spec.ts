import { beforeEach, describe, expect, it, vi } from 'vitest';
import type amqp from 'amqplib';

/**
 * One character's history: fetch from ESI, save, then queue the corporations
 * whose names are not in the database yet — closed ones included, ESI still
 * answers for those.
 */

const { getCorporationHistory, saveCorporationHistory, findMissing } =
  vi.hoisted(() => ({
    getCorporationHistory: vi.fn(),
    saveCorporationHistory: vi.fn(),
    findMissing: vi.fn(),
  }));

vi.mock('@services/character', () => ({
  CharacterService: { getCorporationHistory },
}));
vi.mock('@services/character/character-corporation-history-writer', () => ({
  saveCorporationHistory,
  findMissingCorporationIds: findMissing,
}));
vi.mock('@services/prisma-worker', () => ({ default: {} }));
vi.mock('@services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/rabbitmq', () => ({
  ensureAllQueuesExist: vi.fn(),
  getRabbitMQChannel: vi.fn(),
}));

import { processCharacter } from './worker-character-corporation-history';

const channel = { sendToQueue: vi.fn() } as unknown as amqp.Channel;

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
    expect(channel.sendToQueue).toHaveBeenCalledTimes(1);
    const [queue, body, options] = vi.mocked(channel.sendToQueue).mock.calls[0];
    expect(queue).toBe('esi_corporation_info_queue');
    expect(JSON.parse(body.toString())).toMatchObject({
      entityId: 109299958,
      source: 'worker-character-corporation-history',
    });
    expect(options).toEqual({ persistent: true });
    expect(result).toEqual({ records: 3, missingCorporations: 1 });
  });

  it('queues nothing when every corporation is known', async () => {
    getCorporationHistory.mockResolvedValue(RECORDS);
    findMissing.mockResolvedValue([]);

    await processCharacter(channel, 42);

    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('saves nothing and rethrows when ESI fails, leaving it to handleWorkerError', async () => {
    getCorporationHistory.mockRejectedValue(new Error('ESI 502'));

    await expect(processCharacter(channel, 42)).rejects.toThrow('ESI 502');
    expect(saveCorporationHistory).not.toHaveBeenCalled();
  });
});
