'use client';

import { useMapCelestialsQuery } from '@/generated/graphql';
import { useMemo } from 'react';

/**
 * Mirrors the service's cap. Rejecting rather than truncating is the service's
 * job; this only keeps a runaway caller from making the request at all.
 */
export const MAX_CELESTIAL_SYSTEMS = 16;

/**
 * The interiors of a handful of systems: the focus plus its gate neighbours, so
 * panning one system along already has what it needs.
 *
 * The ids are sorted before they become variables. Apollo keys its cache on the
 * whole variable set, so an unsorted list would miss on a neighbourhood it had
 * already fetched simply because the order differed. A genuinely new
 * neighbourhood still costs one request, but the backend answers it out of its
 * per-system Redis keys rather than the database.
 */
export function useMapCelestials(systemIds: number[]) {
  const variables = useMemo(
    () => ({ systemIds: [...new Set(systemIds)].sort((a, b) => a - b) }),
    [systemIds],
  );

  const { data } = useMapCelestialsQuery({
    variables,
    skip:
      variables.systemIds.length === 0 ||
      variables.systemIds.length > MAX_CELESTIAL_SYSTEMS,
    fetchPolicy: 'cache-first',
  });

  return data?.mapCelestials ?? [];
}
