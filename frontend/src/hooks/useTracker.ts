'use client';

import {
  TrackedEntityType,
  useMyTrackerQuery,
  useTrackMutation,
  useUntrackMutation,
  type MyTrackerQuery,
} from '@/generated/graphql';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useState } from 'react';

export type TrackerEntityType = TrackedEntityType;
export type TrackerStatus = 'self' | 'automatic' | 'tracked' | 'untracked';

const REFETCH = {
  refetchQueries: ['MyTracker'],
  awaitRefetchQueries: true,
};

export function useTracker() {
  const { user } = useAuth();
  const signedIn = !!user;
  const ownCharacterId = user ? Number(user.characterId) : null;

  const { data } = useMyTrackerQuery({
    skip: !signedIn,
    fetchPolicy: 'cache-first',
  });
  const [error, setError] = useState<string | null>(null);
  const [trackMutation, { loading: tracking }] = useTrackMutation();
  const [untrackMutation, { loading: untracking }] = useUntrackMutation();

  const tracker: MyTrackerQuery['myTracker'] | undefined = data?.myTracker;

  const status = useCallback(
    (type: TrackedEntityType, id: number): TrackerStatus => {
      if (type === TrackedEntityType.Character && id === ownCharacterId) {
        return 'self';
      }
      if (!tracker) return 'untracked';

      const entry =
        type === TrackedEntityType.Character
          ? tracker.characters.find((e) => Number(e.character.id) === id)
          : type === TrackedEntityType.Corporation
            ? tracker.corporations.find((e) => Number(e.corporation.id) === id)
            : tracker.alliances.find((e) => Number(e.alliance.id) === id);

      if (!entry) return 'untracked';
      return entry.automatic ? 'automatic' : 'tracked';
    },
    [tracker, ownCharacterId],
  );

  const run = useCallback(async (call: () => Promise<unknown>) => {
    try {
      await call();
      setError(null);
    } catch (e) {
      const message = (e as { graphQLErrors?: { message?: string }[] })
        .graphQLErrors?.[0]?.message;
      setError(message || 'Could not update the tracker.');
    }
  }, []);

  const track = useCallback(
    (type: TrackedEntityType, id: number) =>
      run(() => trackMutation({ variables: { type, id }, ...REFETCH })),
    [run, trackMutation],
  );

  const untrack = useCallback(
    (type: TrackedEntityType, id: number) =>
      run(() => untrackMutation({ variables: { type, id }, ...REFETCH })),
    [run, untrackMutation],
  );

  return {
    signedIn,
    ownCharacterId,
    data: tracker,
    status,
    track,
    untrack,
    pending: tracking || untracking,
    loading: signedIn && !tracker,
    error,
  };
}
