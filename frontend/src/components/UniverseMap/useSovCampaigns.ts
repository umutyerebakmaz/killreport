'use client';

import {
  useMapSovCampaignsQuery,
  type MapSovCampaignsQuery,
} from '@/generated/graphql';
import { byStartTime } from '@/utils/map/countdown';
import { useMemo } from 'react';

export type SovCampaign =
  MapSovCampaignsQuery['sovereigntyActiveCampaigns'][number];

/** Stable identity for "no rows", for the reason useMapSovereignty holds one. */
const EMPTY: SovCampaign[] = [];

/** The worker writes campaigns every minute; this follows it no faster. */
const POLL_MS = 60_000;

/**
 * Active sovereignty campaigns, soonest first, while the sovereignty layer is
 * on — fetched only then, the rule every map dataset follows.
 *
 * Polled rather than tied to the SOVEREIGNTY_ALERT subscription: the alert
 * covers a campaign starting or ending but not the scores moving, and the
 * response cache would hand a subscription-triggered refetch the same body
 * for up to 60 s anyway.
 */
export function useSovCampaigns(active: boolean): SovCampaign[] {
  const { data } = useMapSovCampaignsQuery({
    skip: !active,
    pollInterval: active ? POLL_MS : 0,
    fetchPolicy: 'cache-and-network',
  });

  const rows = data?.sovereigntyActiveCampaigns;
  return useMemo(() => (rows ? byStartTime(rows) : EMPTY), [rows]);
}
