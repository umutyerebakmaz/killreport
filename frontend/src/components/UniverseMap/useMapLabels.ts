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
 * The two label tiers that need fetching, staged by zoom.
 *
 * The rule this follows: a dataset shown only above a zoom threshold should not
 * be FETCHED below it either. Regions are 3 KB and arrive with the scene;
 * constellations are 31 KB and wait for -47.64, which is 2.4 levels above the
 * galaxy fit — so someone who opens the map and just looks never downloads them.
 *
 * System names are absent on purpose: mapGeometry's nodes already carry them.
 *
 * Once the constellation query has run, Apollo keeps the result. Zooming back
 * out re-skips the query but does not throw the data away, so the 31 KB is paid
 * at most once per session.
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
    regions: regionData?.mapLabels ?? [],
    constellations: constellationData?.mapLabels ?? [],
  };
}
