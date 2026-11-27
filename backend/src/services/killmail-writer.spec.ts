import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KillmailDetail } from '@services/killmail/killmail.service';

/**
 * The one place a killmail is written.
 *
 * Six live paths used to do this themselves and had drifted: two never
 * published NEW_KILLMAIL, one wrote no attacker rows, and the user sync wrote
 * neither the leaderboard aggregates nor the filter row — which is how 3,847
 * killmails in production ended up counted nowhere (#245).
 */

const {
  prismaMock,
  txMock,
  updateDailyAggregatesRealtime,
  insertKillmailFilter,
  calculateKillmailValues,
  publish,
  publishToQueue,
  loggerMock,
} = vi.hoisted(() => {
  const txMock = {
    killmail: { createMany: vi.fn() },
    victim: { create: vi.fn() },
    attacker: { createMany: vi.fn() },
    killmailItem: { createMany: vi.fn() },
  };
  return {
    txMock,
    prismaMock: {
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(txMock),
      ),
    },
    updateDailyAggregatesRealtime: vi.fn(),
    insertKillmailFilter: vi.fn(),
    calculateKillmailValues: vi.fn(async () => ({
      totalValue: 1000,
      destroyedValue: 600,
      droppedValue: 400,
    })),
    publish: vi.fn(),
    publishToQueue: vi.fn(),
    loggerMock: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));
vi.mock('@services/logger', () => ({ default: loggerMock }));
vi.mock('@services/rabbitmq', () => ({ publishToQueue }));
vi.mock('@services/pubsub', () => ({ pubsub: { publish } }));
vi.mock('@services/kill-stats-realtime', () => ({
  updateDailyAggregatesRealtime,
}));
vi.mock('@services/killmail-filters-realtime', () => ({
  insertKillmailFilter,
}));
vi.mock('@helpers/calculate-killmail-values', () => ({
  calculateKillmailValues,
}));

import { saveKillmail } from './killmail-writer';

const HASH = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

function detail(overrides: Partial<KillmailDetail> = {}): KillmailDetail {
  return {
    killmail_id: 128431979,
    killmail_time: '2026-09-19T14:03:22Z',
    solar_system_id: 30002187,
    victim: {
      character_id: 95465499,
      corporation_id: 98000001,
      alliance_id: 99005338,
      ship_type_id: 670,
      damage_taken: 1200,
      items: [],
    },
    attackers: [
      {
        character_id: 90000001,
        corporation_id: 98000002,
        alliance_id: 99000002,
        ship_type_id: 17738,
        damage_done: 1200,
        final_blow: true,
        security_status: -1.2,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  txMock.killmail.createMany.mockResolvedValue({ count: 1 });
});

describe('already stored', () => {
  it('returns false and writes nothing more when createMany skips the duplicate', async () => {
    // The claim is the transaction's first statement: ON CONFLICT DO NOTHING
    // decides between two writers, and the loser writes nothing else.
    txMock.killmail.createMany.mockResolvedValue({ count: 0 });

    const saved = await saveKillmail(detail(), HASH);

    expect(saved).toBe(false);
    expect(txMock.victim.create).not.toHaveBeenCalled();
    expect(txMock.attacker.createMany).not.toHaveBeenCalled();
    expect(updateDailyAggregatesRealtime).not.toHaveBeenCalled();
    expect(insertKillmailFilter).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(publishToQueue).not.toHaveBeenCalled();
  });
});

describe('writing a new killmail', () => {
  it('writes the killmail, victim and attackers in one transaction', async () => {
    const saved = await saveKillmail(detail(), HASH);

    expect(saved).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.killmail.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          killmail_id: 128431979,
          killmail_hash: HASH,
          killmail_time: new Date('2026-09-19T14:03:22Z'),
          solar_system_id: 30002187,
          total_value: 1000,
          destroyed_value: 600,
          dropped_value: 400,
          attacker_count: 1,
        }),
      ],
      skipDuplicates: true,
    });
    expect(txMock.victim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        killmail_id: 128431979,
        character_id: 95465499,
        corporation_id: 98000001,
        alliance_id: 99005338,
        ship_type_id: 670,
        damage_taken: 1200,
      }),
    });
    expect(txMock.attacker.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('updates the daily aggregates inside that transaction', async () => {
    await saveKillmail(detail(), HASH);

    expect(updateDailyAggregatesRealtime).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        killmail_time: new Date('2026-09-19T14:03:22Z'),
        character_ids: [90000001],
      }),
    );
  });

  it('writes the filter row inside the transaction, with tx', async () => {
    await saveKillmail(detail(), HASH);

    expect(insertKillmailFilter).toHaveBeenCalledWith(
      expect.objectContaining({ killmail_id: 128431979n, attacker_count: 1 }),
      txMock,
    );
  });
});

describe('a failing transaction', () => {
  it('rethrows anything else so the shared failure path can route it', async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error('pool timeout'));

    await expect(saveKillmail(detail(), HASH)).rejects.toThrow('pool timeout');
  });
});

describe('data ESI really sends', () => {
  it('skips items with a null item_type_id instead of failing the write', async () => {
    const saved = await saveKillmail(
      detail({
        victim: {
          character_id: 95465499,
          corporation_id: 98000001,
          ship_type_id: 670,
          damage_taken: 1200,
          items: [
            { item_type_id: 34, flag: 5, singleton: 0, quantity_dropped: 3 },
            {
              item_type_id: null as unknown as number,
              flag: 5,
              singleton: 0,
            },
          ],
        },
      }),
      HASH,
    );

    expect(saved).toBe(true);
    expect(txMock.killmailItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ item_type_id: 34 })],
      }),
    );
  });

  it('keeps a victim coordinate of exactly 0 rather than nulling it', async () => {
    await saveKillmail(
      detail({
        victim: {
          character_id: 95465499,
          corporation_id: 98000001,
          ship_type_id: 670,
          damage_taken: 1200,
          position: { x: 0, y: -1.5e11, z: 4.2e10 },
          items: [],
        },
      }),
      HASH,
    );

    expect(txMock.victim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        position_x: 0,
        position_y: -1.5e11,
        position_z: 4.2e10,
      }),
    });
  });

  it('stores no position when ESI sends none', async () => {
    await saveKillmail(
      detail({
        victim: {
          character_id: 95465499,
          corporation_id: 98000001,
          ship_type_id: 670,
          damage_taken: 1200,
          items: [],
        },
      }),
      HASH,
    );

    expect(txMock.victim.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        position_x: null,
        position_y: null,
        position_z: null,
      }),
    });
  });

  it('refuses a killmail with no attackers', async () => {
    // Writing attacker_count 0 and counting nobody silently produces a wrong
    // killmail; the source has to fetch it again.
    await expect(saveKillmail(detail({ attackers: [] }), HASH)).rejects.toThrow(
      /no attackers/i,
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('the publish option', () => {
  it('publishes by default', async () => {
    await saveKillmail(detail(), HASH);

    expect(publish).toHaveBeenCalledWith('NEW_KILLMAIL', {
      killmailId: 128431979,
    });
  });

  it('stays quiet when the caller is backfilling', async () => {
    await saveKillmail(detail(), HASH, { publish: false });

    expect(publish).not.toHaveBeenCalled();
    // The write path runs unchanged; only the announcement is silent.
    expect(txMock.killmail.createMany).toHaveBeenCalled();
    expect(insertKillmailFilter).toHaveBeenCalled();
  });
});

describe('the discord webhook queue', () => {
  it('publishes to discord_webhook_queue when publish is true', async () => {
    await saveKillmail(detail(), HASH);

    expect(publishToQueue).toHaveBeenCalledWith(
      'discord_webhook_queue',
      JSON.stringify({ killmailId: 128431979 }),
    );
  });

  it('does not publish to discord_webhook_queue when publish is false', async () => {
    await saveKillmail(detail(), HASH, { publish: false });

    expect(publishToQueue).not.toHaveBeenCalled();
  });

  it('does not publish to discord_webhook_queue for an already-stored killmail', async () => {
    txMock.killmail.createMany.mockResolvedValue({ count: 0 });

    await expect(saveKillmail(detail(), HASH)).resolves.toBe(false);
    expect(publishToQueue).not.toHaveBeenCalled();
  });
});

describe('the filter row and the announcement', () => {
  it('writes the filter row before NEW_KILLMAIL goes out', async () => {
    // Awaiting the filter insert is the whole reason it is not
    // fire-and-forget: a subscriber that queries on the event must find the
    // row. Ordering is the contract, so ordering is what this asserts.
    const order: string[] = [];
    insertKillmailFilter.mockImplementationOnce(async () => {
      order.push('filter');
    });
    publish.mockImplementationOnce(async () => {
      order.push('publish');
    });

    await saveKillmail(detail(), HASH);

    expect(order).toEqual(['filter', 'publish']);
  });

  it('rejects when the filter row fails, and announces nothing', async () => {
    // The filter row is written in the transaction now: its failure rolls
    // the killmail back, so it is fetched again rather than left without a
    // filter row that no later writer would ever add.
    insertKillmailFilter.mockRejectedValueOnce(
      new Error('filter insert failed'),
    );

    await expect(saveKillmail(detail(), HASH)).rejects.toThrow(
      'filter insert failed',
    );
    expect(publish).not.toHaveBeenCalled();
    expect(publishToQueue).not.toHaveBeenCalled();
  });
});

describe('a detail whose attackers key is missing entirely', () => {
  it('refuses it the same way as an empty list, not with a TypeError', async () => {
    // The user worker used to read `detail.attackers?.length || 0`, so someone
    // once met a payload without the key. Without the optional chain the guard
    // throws "Cannot read properties of undefined" instead of saying why.
    const withoutAttackers = {
      ...detail(),
      attackers: undefined,
    } as unknown as KillmailDetail;

    await expect(saveKillmail(withoutAttackers, HASH)).rejects.toThrow(
      /no attackers/i,
    );
  });
});
