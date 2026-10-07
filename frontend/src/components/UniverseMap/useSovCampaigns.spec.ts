import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let calls: { skip?: boolean; pollInterval?: number }[] = [];
let rows: { campaignId: number; startTime: string }[] | undefined;
vi.mock('@/generated/graphql', () => ({
  useMapSovCampaignsQuery: (options: {
    skip?: boolean;
    pollInterval?: number;
  }) => {
    calls.push(options);
    return { data: rows ? { sovereigntyActiveCampaigns: rows } : undefined };
  },
}));

import { useSovCampaigns } from './useSovCampaigns';

beforeEach(() => {
  calls = [];
  rows = undefined;
});

describe('useSovCampaigns', () => {
  // The rule every map dataset follows: not drawn, not fetched.
  it('fetches nothing while the sovereignty layer is off', () => {
    renderHook(() => useSovCampaigns(false));
    expect(calls.at(-1)).toMatchObject({ skip: true, pollInterval: 0 });
  });

  it('polls every minute while the layer is on', () => {
    renderHook(() => useSovCampaigns(true));
    expect(calls.at(-1)).toMatchObject({ skip: false, pollInterval: 60_000 });
  });

  it('hands back the timers soonest first', () => {
    rows = [
      { campaignId: 2, startTime: '2026-10-07T14:00:00.000Z' },
      { campaignId: 1, startTime: '2026-10-07T13:00:00.000Z' },
    ];
    const { result } = renderHook(() => useSovCampaigns(true));
    expect(result.current.map((c) => c.campaignId)).toEqual([1, 2]);
  });

  it('keeps one empty array across renders while there is no data', () => {
    const { result, rerender } = renderHook(() => useSovCampaigns(true));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
