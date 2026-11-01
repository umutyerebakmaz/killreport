import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useMyDiscordWebhooksQuery = vi.fn();
const setMutation = vi.fn().mockResolvedValue({});
const removeMutation = vi.fn().mockResolvedValue({});
vi.mock('@/generated/graphql', () => ({
  useMyDiscordWebhooksQuery: (options: unknown) =>
    useMyDiscordWebhooksQuery(options),
  useSetDiscordWebhookMutation: () => [setMutation, { loading: false }],
  useRemoveDiscordWebhookMutation: () => [removeMutation, { loading: false }],
  TrackedEntityType: {
    Character: 'CHARACTER',
    Corporation: 'CORPORATION',
    Alliance: 'ALLIANCE',
  },
}));

const useAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => useAuth() }));

import { TrackedEntityType } from '@/generated/graphql';
import { useDiscordWebhooks } from './useDiscordWebhooks';

const DATA = {
  myDiscordWebhooks: [
    { entityType: 'CHARACTER', entityId: 200, name: 'Hook A', disabled: false },
    { entityType: 'CORPORATION', entityId: 300, name: null, disabled: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { characterId: '100' } });
  useMyDiscordWebhooksQuery.mockReturnValue({ data: DATA });
});

describe('useDiscordWebhooks', () => {
  it('statusOf returns none / connected / broken from the query result', () => {
    const { result } = renderHook(() => useDiscordWebhooks());
    const { statusOf, webhookOf } = result.current;
    expect(statusOf(TrackedEntityType.Character, 200)).toBe('connected');
    expect(statusOf(TrackedEntityType.Corporation, 300)).toBe('broken');
    expect(statusOf(TrackedEntityType.Alliance, 300)).toBe('none');
    expect(webhookOf(TrackedEntityType.Character, 200)).toEqual({
      name: 'Hook A',
      disabled: false,
    });
    expect(webhookOf(TrackedEntityType.Character, 999)).toBeNull();
  });

  it('set calls the mutation then refetches', async () => {
    const { result } = renderHook(() => useDiscordWebhooks());
    await act(() =>
      result.current.set(TrackedEntityType.Character, 200, 'https://x/y'),
    );
    expect(setMutation).toHaveBeenCalledWith({
      variables: { type: 'CHARACTER', id: 200, url: 'https://x/y' },
      refetchQueries: ['MyDiscordWebhooks'],
      awaitRefetchQueries: true,
    });
    await act(() => result.current.remove(TrackedEntityType.Character, 200));
    expect(removeMutation).toHaveBeenCalledWith({
      variables: { type: 'CHARACTER', id: 200 },
      refetchQueries: ['MyDiscordWebhooks'],
      awaitRefetchQueries: true,
    });
  });

  it('maps reason codes to the copy table', async () => {
    const cases: [string | undefined, string][] = [
      ['INVALID_URL', 'That is not a Discord webhook URL.'],
      [
        'WEBHOOK_NOT_FOUND',
        'Discord does not know this webhook. Was it deleted?',
      ],
      ['TEST_FAILED', 'Discord rejected the test message.'],
      ['LIMIT', 'You can connect up to 10 webhooks.'],
      ['NOT_FOUND', 'Something went wrong. Try again.'],
      [undefined, 'Something went wrong. Try again.'],
    ];
    const { result } = renderHook(() => useDiscordWebhooks());
    for (const [reason, text] of cases) {
      setMutation.mockRejectedValueOnce({
        graphQLErrors: [{ message: 'secret', extensions: { reason } }],
      });
      await act(() =>
        result.current.set(TrackedEntityType.Character, 200, 'u'),
      );
      expect(result.current.error).toBe(text);
    }
  });

  it('set resolves true on success and false on error, keeping the error', async () => {
    const { result } = renderHook(() => useDiscordWebhooks());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.set(TrackedEntityType.Character, 200, 'u');
    });
    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();

    setMutation.mockRejectedValueOnce({
      graphQLErrors: [{ extensions: { reason: 'LIMIT' } }],
    });
    await act(async () => {
      ok = await result.current.set(TrackedEntityType.Character, 200, 'u');
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBe('You can connect up to 10 webhooks.');

    removeMutation.mockRejectedValueOnce(new Error('x'));
    await act(async () => {
      ok = await result.current.remove(TrackedEntityType.Character, 200);
    });
    expect(ok).toBe(false);
  });

  it('clearError resets the error', async () => {
    const { result } = renderHook(() => useDiscordWebhooks());
    setMutation.mockRejectedValueOnce(new Error('x'));
    await act(() => result.current.set(TrackedEntityType.Character, 200, 'u'));
    expect(result.current.error).not.toBeNull();
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('signedIn false yields no query', () => {
    useAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useDiscordWebhooks());
    expect(result.current.signedIn).toBe(false);
    expect(useMyDiscordWebhooksQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: 'cache-first',
    });
  });
});
