'use client';

import {
  MapLabelKind,
  useMapLabelsQuery,
  type MapScope,
} from '@/generated/graphql';
import { CONSTELLATION_LABEL_ZOOM } from '@/utils/map/lod';

export interface MapLabelData {
  id: number;
  name: string;
  kind: string;
  x: number;
  z: number;
}

/**
 * Stable identity for "no rows yet" — loading, skipped, or errored all fall
 * back to this same array. Without it, `data?.mapLabels ?? []` mints a new
 * array on every render while `data` is undefined, which would re-trigger any
 * effect that depends on the returned arrays.
 */
const EMPTY: MapLabelData[] = [];

/**
 * The two label tiers that need fetching, staged by zoom.
 *
 * The rule this follows: a dataset shown only above a zoom threshold should not
 * be FETCHED below it either. Regions are 3 KB and arrive with the scene;
 * constellations are 31 KB and wait for -47.64, which is 2.4 levels above the
 * galaxy fit — so someone who opens the map and just looks never downloads them.
 *
 * System names are absent on purpose: mapGeometry's nodes already carry them.
 *
 * The network cost is paid at most once per session: Apollo's normalized
 * cache keeps the constellation rows once fetched, and re-crossing the
 * threshold reuses them (`fetchPolicy: 'cache-first'`) instead of refetching.
 * What this hook *returns* is a different story — while `skip` is true,
 * `useQuery` clears `data` back to `undefined` rather than holding the last
 * value (a known, deliberately-not-yet-fixed quirk of Apollo Client 3; see
 * `react/hooks/useQuery.js`'s own comment on this), so `constellations` goes
 * back to `EMPTY` below the threshold even though the cache still has the
 * rows. That's harmless here only because `visibleLabelTiers` (lod.ts) stops
 * drawing the constellation tier at the exact same `CONSTELLATION_LABEL_ZOOM`,
 * so the data disappears exactly when nothing is reading it.
 */
export function useMapLabels(scope: MapScope, zoom: number | null) {
  const { data: regionData } = useMapLabelsQuery({
    variables: { scope, kind: MapLabelKind.Region },
    fetchPolicy: 'cache-first',
  });

  const { data: constellationData } = useMapLabelsQuery({
    variables: { scope, kind: MapLabelKind.Constellation },
    fetchPolicy: 'cache-first',
    skip: zoom === null || zoom < CONSTELLATION_LABEL_ZOOM,
  });

  return {
    regions: regionData?.mapLabels ?? EMPTY,
    constellations: constellationData?.mapLabels ?? EMPTY,
  };
}
