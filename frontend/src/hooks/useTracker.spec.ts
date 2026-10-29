import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useMyTrackerQuery = vi.fn();
const trackMutation = vi.fn().mockResolvedValue({});
const untrackMutation = vi.fn().mockResolvedValue({});
vi.mock('@/generated/graphql', () => ({
  useMyTrackerQuery: (options: unknown) => useMyTrackerQuery(options),
  useTrackMutation: () => [trackMutation, { loading: false }],
  useUntrackMutation: () => [untrackMutation, { loading: false }],
  TrackedEntityType: {
    Character: 'CHARACTER',
    Corporation: 'CORPORATION',
    Alliance: 'ALLIANCE',
  },
}));

const useAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => useAuth() }));

import { TrackedEntityType } from '@/generated/graphql';
import { useTracker } from './useTracker';

const DATA = {
  myTracker: {
    characters: [{ automatic: false, character: { id: 200, name: 'Other' } }],
    corporations: [{ automatic: true, corporation: { id: 300, name: 'Corp' } }],
    alliances: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { characterId: '100' } });
  useMyTrackerQuery.mockReturnValue({ data: DATA });
});

describe('useTracker', () => {
  it('reports status per entity', () => {
    const { result } = renderHook(() => useTracker());
    const { status } = result.current;
    expect(result.current.ownCharacterId).toBe(100);
    expect(status(TrackedEntityType.Character, 100)).toBe('self');
    expect(status(TrackedEntityType.Corporation, 300)).toBe('automatic');
    expect(status(TrackedEntityType.Character, 200)).toBe('tracked');
    expect(status(TrackedEntityType.Character, 999)).toBe('untracked');
    expect(status(TrackedEntityType.Alliance, 300)).toBe('untracked');
  });

  it('skips the query when signed out', () => {
    useAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useTracker());
    expect(result.current.signedIn).toBe(false);
    expect(result.current.ownCharacterId).toBeNull();
    expect(useMyTrackerQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: 'cache-first',
    });
  });

  it('refetches MyTracker after a mutation', async () => {
    const { result } = renderHook(() => useTracker());
    await result.current.track(TrackedEntityType.Character, 200);
    expect(trackMutation).toHaveBeenCalledWith({
      variables: { type: 'CHARACTER', id: 200 },
      refetchQueries: ['MyTracker'],
      awaitRefetchQueries: true,
    });
    await result.current.untrack(TrackedEntityType.Character, 200);
    expect(untrackMutation).toHaveBeenCalledWith({
      variables: { type: 'CHARACTER', id: 200 },
      refetchQueries: ['MyTracker'],
      awaitRefetchQueries: true,
    });
  });

  it('catches a rejected mutation and exposes its message', async () => {
    trackMutation.mockRejectedValueOnce({
      graphQLErrors: [{ message: 'Tracker is limited to 200 entries' }],
    });
    const { result } = renderHook(() => useTracker());
    await act(async () => {
      await result.current.track(TrackedEntityType.Character, 200);
    });
    expect(result.current.error).toBe('Tracker is limited to 200 entries');
    await act(async () => {
      await result.current.track(TrackedEntityType.Character, 200);
    });
    expect(result.current.error).toBeNull();
  });

  it('falls back to a generic message', async () => {
    untrackMutation.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useTracker());
    await act(async () => {
      await result.current.untrack(TrackedEntityType.Character, 200);
    });
    expect(result.current.error).toBe('Could not update the tracker.');
  });

  it('is loading while signed in without data', () => {
    useMyTrackerQuery.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useTracker());
    expect(result.current.loading).toBe(true);
  });

  it('is not loading when signed out', () => {
    useAuth.mockReturnValue({ user: null });
    useMyTrackerQuery.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useTracker());
    expect(result.current.loading).toBe(false);
  });
});
