'use client';

import {
  TrackedEntityType,
  useMyTrackerQuery,
  useTrackMutation,
  useUntrackMutation,
  type MyTrackerQuery,
} from '@/generated/graphql';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';

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

  const { data } = useMyTrackerQuery({ skip: !signedIn });
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

  const track = useCallback(
    async (type: TrackedEntityType, id: number) => {
      await trackMutation({ variables: { type, id }, ...REFETCH });
    },
    [trackMutation],
  );

  const untrack = useCallback(
    async (type: TrackedEntityType, id: number) => {
      await untrackMutation({ variables: { type, id }, ...REFETCH });
    },
    [untrackMutation],
  );

  return {
    signedIn,
    ownCharacterId,
    data: tracker,
    status,
    track,
    untrack,
    pending: tracking || untracking,
  };
}
