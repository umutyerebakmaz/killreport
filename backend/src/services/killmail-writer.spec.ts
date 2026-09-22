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
