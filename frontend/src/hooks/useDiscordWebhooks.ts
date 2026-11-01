'use client';

import {
  TrackedEntityType,
  useMyDiscordWebhooksQuery,
  useRemoveDiscordWebhookMutation,
  useSetDiscordWebhookMutation,
} from '@/generated/graphql';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useState } from 'react';

export type DiscordWebhookStatus = 'none' | 'connected' | 'broken';

const REFETCH = {
  refetchQueries: ['MyDiscordWebhooks'],
  awaitRefetchQueries: true,
};

const FALLBACK = 'Something went wrong. Try again.';

const MESSAGES: Record<string, string> = {
  INVALID_URL: 'That is not a Discord webhook URL.',
  WEBHOOK_NOT_FOUND: 'Discord does not know this webhook. Was it deleted?',
  TEST_FAILED: 'Discord rejected the test message.',
  LIMIT: 'You can connect up to 10 webhooks.',
};

function messageOf(e: unknown): string {
  const reason = (
    e as { graphQLErrors?: { extensions?: { reason?: unknown } }[] }
  ).graphQLErrors?.[0]?.extensions?.reason;
  return (typeof reason === 'string' && MESSAGES[reason]) || FALLBACK;
}

export function useDiscordWebhooks() {
  const { user } = useAuth();
  const signedIn = !!user;

  const { data } = useMyDiscordWebhooksQuery({
    skip: !signedIn,
    fetchPolicy: 'cache-first',
  });
  const [error, setError] = useState<string | null>(null);
  const [setMutation, { loading: setting }] = useSetDiscordWebhookMutation();
  const [removeMutation, { loading: removing }] =
    useRemoveDiscordWebhookMutation();

  const hooks = data?.myDiscordWebhooks;

  const webhookOf = useCallback(
    (type: TrackedEntityType, id: number) => {
      const entry = hooks?.find(
        (h) => h.entityType === type && Number(h.entityId) === id,
      );
      return entry
        ? { name: entry.name ?? null, disabled: entry.disabled }
        : null;
    },
    [hooks],
  );

  const statusOf = useCallback(
    (type: TrackedEntityType, id: number): DiscordWebhookStatus => {
      const entry = webhookOf(type, id);
      if (!entry) return 'none';
      return entry.disabled ? 'broken' : 'connected';
    },
    [webhookOf],
  );

  const run = useCallback(async (call: () => Promise<unknown>) => {
    try {
      await call();
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);

  const set = useCallback(
    (type: TrackedEntityType, id: number, url: string) =>
      run(() => setMutation({ variables: { type, id, url }, ...REFETCH })),
    [run, setMutation],
  );

  const remove = useCallback(
    (type: TrackedEntityType, id: number) =>
      run(() => removeMutation({ variables: { type, id }, ...REFETCH })),
    [run, removeMutation],
  );

  return {
    signedIn,
    loading: signedIn && !hooks,
    statusOf,
    webhookOf,
    set,
    remove,
    pending: setting || removing,
    error,
  };
}
