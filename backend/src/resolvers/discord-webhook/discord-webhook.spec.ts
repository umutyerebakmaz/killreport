import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@config/config', () => ({ default: {}, config: {} }));
vi.mock('@services/discord-webhook/discord-webhook.service', () => {
  class DiscordWebhookError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    DiscordWebhookError,
    listWebhooks: vi.fn(),
    setWebhook: vi.fn(),
    removeWebhook: vi.fn(),
  };
});

import {
  DiscordWebhookError,
  listWebhooks,
  removeWebhook,
  setWebhook,
} from '@services/discord-webhook/discord-webhook.service';
import { discordWebhookMutations } from './mutations';
import { discordWebhookQueries } from './queries';

const ctx = (user: any = { characterId: 1 }) => ({ user }) as any;
const args = { type: 'CORPORATION', id: 5, url: 'u' };

beforeEach(() => vi.clearAllMocks());

describe('discord webhook resolvers', () => {
  it('myDiscordWebhooks / setDiscordWebhook / removeDiscordWebhook require auth', async () => {
    const calls = [
      (discordWebhookQueries.myDiscordWebhooks as any)({}, {}, ctx(null), {}),
      (discordWebhookMutations.setDiscordWebhook as any)(
        {},
        args,
        ctx(null),
        {},
      ),
      (discordWebhookMutations.removeDiscordWebhook as any)(
        {},
        args,
        ctx(null),
        {},
      ),
    ];
    for (const call of calls) {
      await expect(call).rejects.toMatchObject({
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
  });

  it('maps DiscordWebhookError to BAD_USER_INPUT with reason', async () => {
    vi.mocked(setWebhook).mockRejectedValue(
      new DiscordWebhookError('LIMIT', 'full'),
    );
    await expect(
      (discordWebhookMutations.setDiscordWebhook as any)({}, args, ctx(), {}),
    ).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT', reason: 'LIMIT' },
    });
  });

  it('re-throws other errors as-is', async () => {
    const boom = new Error('boom');
    vi.mocked(setWebhook).mockRejectedValue(boom);
    await expect(
      (discordWebhookMutations.setDiscordWebhook as any)({}, args, ctx(), {}),
    ).rejects.toBe(boom);
  });

  it('delegates to the service', async () => {
    vi.mocked(listWebhooks).mockResolvedValue([]);
    expect(
      await (discordWebhookQueries.myDiscordWebhooks as any)({}, {}, ctx(), {}),
    ).toEqual([]);
    expect(listWebhooks).toHaveBeenCalledWith(1);
    expect(
      await (discordWebhookMutations.removeDiscordWebhook as any)(
        {},
        args,
        ctx(),
        {},
      ),
    ).toBe(true);
    expect(removeWebhook).toHaveBeenCalledWith(1, 'CORPORATION', 5);
  });
});
