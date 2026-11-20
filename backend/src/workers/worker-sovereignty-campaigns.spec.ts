import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Alerts go out after every write, started campaigns first, and the 25-alert
 * cap covers started and ended together.
 */

const { getSovereigntyCampaigns, prisma, publish } = vi.hoisted(() => ({
  getSovereigntyCampaigns: vi.fn(),
  prisma: {
    sovereigntyCampaign: {
      count: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    campaignParticipant: { upsert: vi.fn() },
    $disconnect: vi.fn(),
  },
  publish: vi.fn(),
}));

vi.mock('@services/sovereignty/sovereignty.service', () => ({
  SovereigntyService: { getSovereigntyCampaigns },
}));
vi.mock('@services/prisma-worker', () => ({ default: prisma }));
vi.mock('@services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/pubsub', () => ({ pubsub: { publish } }));
vi.mock('@services/sovereignty/alert-builder', () => ({
  buildSovereigntyAlert: vi.fn(async (_c, e) => ({ type: e.type })),
}));

import { syncSovereigntyCampaigns } from './worker-sovereignty-campaigns';

const campaign = (campaign_id: number) => ({
  campaign_id,
  constellation_id: 20000001,
  solar_system_id: 30000000 + campaign_id,
  structure_id: 1000000000000 + campaign_id,
  event_type: 'tcu_defense',
  defender_id: 99000000 + campaign_id,
  defender_score: 0.6,
  attackers_score: 0.4,
  start_time: '2026-11-20T10:00:00Z',
  participants: [],
});
const departing = (campaign_id: number) => ({
  campaign_id,
  solar_system_id: 30000000 + campaign_id,
  defender_id: 99000000 + campaign_id,
  defender_score: 0.5,
  attackers_score: 0.5,
});

/** The ids `findMany` returns: stored feed campaigns, then departing ones. */
function stored(existing: number[], gone: number[]) {
  prisma.sovereigntyCampaign.findMany.mockImplementation(async (args) =>
    args.where.end_time === null
      ? gone.map(departing)
      : existing.map((campaign_id) => ({ campaign_id })),
  );
}

const lastCall = (fn: ReturnType<typeof vi.fn>) =>
  Math.max(...fn.mock.invocationCallOrder);
const firstCall = (fn: ReturnType<typeof vi.fn>) =>
  Math.min(...fn.mock.invocationCallOrder);

describe('syncSovereigntyCampaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.sovereigntyCampaign.count.mockResolvedValue(5);
  });

  it('publishes after every write, started alerts first', async () => {
    getSovereigntyCampaigns.mockResolvedValue([campaign(1), campaign(2)]);
    stored([1], [3]);

    await syncSovereigntyCampaigns();

    expect(publish).toHaveBeenCalledTimes(2);
    expect(firstCall(publish)).toBeGreaterThan(
      lastCall(prisma.sovereigntyCampaign.upsert),
    );
    expect(firstCall(publish)).toBeGreaterThan(
      lastCall(prisma.sovereigntyCampaign.update),
    );
    expect(publish.mock.calls.map((c) => c[1].type)).toEqual([
      'campaign_started',
      'campaign_ended',
    ]);
  });

  it('caps started and ended alerts at 25 in total', async () => {
    const fresh = Array.from({ length: 20 }, (_, i) => campaign(200 + i));
    getSovereigntyCampaigns.mockResolvedValue([campaign(1), ...fresh]);
    stored(
      [1],
      Array.from({ length: 10 }, (_, i) => 100 + i),
    );

    await syncSovereigntyCampaigns();

    expect(prisma.sovereigntyCampaign.update).toHaveBeenCalledTimes(10);
    expect(publish).toHaveBeenCalledTimes(25);
    const types = publish.mock.calls.map((c) => c[1].type);
    expect(types.slice(0, 20).every((t) => t === 'campaign_started')).toBe(
      true,
    );
    expect(types.slice(20).every((t) => t === 'campaign_ended')).toBe(true);
  });
});
