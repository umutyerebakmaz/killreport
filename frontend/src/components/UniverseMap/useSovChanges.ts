'use client';

import {
  useMapSovChangesQuery,
  type MapSovChangesQuery,
} from '@/generated/graphql';

export type SovChange = MapSovChangesQuery['recentTerritoryChanges'][number];

const EMPTY: SovChange[] = [];

/**
 * Recent changes of hands, newest first as the resolver orders them. Fetched
 * the first time the Changes tab opens and not polled: they are detected by
 * worker-sov-map every 30 minutes.
 */
export function useSovChanges(active: boolean): {
  changes: SovChange[];
  loading: boolean;
} {
  const { data, loading } = useMapSovChangesQuery({
    skip: !active,
    fetchPolicy: 'cache-first',
  });
  return { changes: data?.recentTerritoryChanges ?? EMPTY, loading };
}
