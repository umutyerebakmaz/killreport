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
  loggerMock,
} = vi.hoisted(() => {
  const txMock = {
    killmail: { create: vi.fn() },
    victim: { create: vi.fn() },
    attacker: { createMany: vi.fn() },
    killmailItem: { createMany: vi.fn() },
  };
  return {
    txMock,
    prismaMock: {
      killmail: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) =>
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
  prismaMock.killmail.findUnique.mockResolvedValue(null);
});

describe('already stored', () => {
  it('returns false and writes nothing', async () => {
    prismaMock.killmail.findUnique.mockResolvedValue({
      killmail_id: 128431979,
    });

    const saved = await saveKillmail(detail(), HASH);

    expect(saved).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(calculateKillmailValues).not.toHaveBeenCalled();
    expect(insertKillmailFilter).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('the existence check', () => {
  it('asks about the killmail row, which is the unique key that would throw', async () => {
    await saveKillmail(detail(), HASH);

    expect(prismaMock.killmail.findUnique).toHaveBeenCalledWith({
      where: { killmail_id: 128431979 },
      select: { killmail_id: true },
    });
  });
});

describe('writing a new killmail', () => {
  it('writes the killmail, victim and attackers in one transaction', async () => {
    const saved = await saveKillmail(detail(), HASH);

    expect(saved).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.killmail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        killmail_id: 128431979,
        killmail_hash: HASH,
        killmail_time: new Date('2026-09-19T14:03:22Z'),
        solar_system_id: 30002187,
        total_value: 1000,
        destroyed_value: 600,
        dropped_value: 400,
        attacker_count: 1,
      }),
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

  it('writes the filter row after the transaction, awaited', async () => {
    await saveKillmail(detail(), HASH);

    expect(insertKillmailFilter).toHaveBeenCalledWith(
      expect.objectContaining({ killmail_id: 128431979n, attacker_count: 1 }),
    );
  });
});

describe('a second writer that got there first', () => {
  it('turns P2002 into false rather than throwing', async () => {
    prismaMock.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    await expect(saveKillmail(detail(), HASH)).resolves.toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });

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

  it('refuses a killmail with no attackers', async () => {
    // attacker_count 0 yazmak ve kimseyi saymamak, sessizce yanlış bir
    // killmail üretir; kaynağın onu yeniden çekmesi gerekir.
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
    // Yazma yolu aynen işler; sessiz olan yalnızca duyuru.
    expect(txMock.killmail.create).toHaveBeenCalled();
    expect(insertKillmailFilter).toHaveBeenCalled();
  });
});

describe('a filter row that could not be written', () => {
  it('still reports the killmail as saved', async () => {
    // insertKillmailFilter kendi hatasını loglayıp yutuyor; yazıcı bunu
    // göremez. Kabul edilen davranış: killmail yazıldı, filtre satırı eksik
    // kaldı ve repair:killmail-derived onu bulur.
    insertKillmailFilter.mockResolvedValueOnce(undefined);

    await expect(saveKillmail(detail(), HASH)).resolves.toBe(true);
  });
});
