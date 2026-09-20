'use client';

import {
  useMapSovereigntyQuery,
  type MapScope,
  type MapSovereigntyQuery,
} from '@/generated/graphql';
import { buildSovIndex, type SovIndex } from '@/utils/map/layers';
import { useMemo } from 'react';

/**
 * Stable identity for "no rows yet", the same reason useMapLabels holds one:
 * `data?.x ?? []` mints a new array on every render while data is undefined,
 * and every effect that depends on it would re-run.
 */
const EMPTY: MapSovereigntyQuery['mapSovereignty']['owners'] = [];

/**
 * The sovereignty layer's data, fetched only while the layer is selected.
 *
 * The rule phases 2 and 3 set: a dataset that is not drawn is not fetched
 * either. Someone who opens the map and never leaves the security layer never
 * downloads the 5,383 pairs. Apollo keeps them once fetched, so switching back
 * and forth costs one request per session.
 */
export function useMapSovereignty(
  scope: MapScope,
  active: boolean,
): {
  index: SovIndex | null;
  owners: MapSovereigntyQuery['mapSovereignty']['owners'];
} {
  const { data } = useMapSovereigntyQuery({
    variables: { scope },
    fetchPolicy: 'cache-first',
    skip: !active,
  });

  const sovereignty = data?.mapSovereignty;

  // Two Maps over 5,383 rows, built once per fetch rather than per render:
  // the effects below take the index as a dependency, so a fresh object each
  // render would rewrite 5,241 tints on every pointer move.
  const index = useMemo(
    () => (sovereignty ? buildSovIndex(sovereignty) : null),
    [sovereignty],
  );

  return { index, owners: sovereignty?.owners ?? EMPTY };
}
