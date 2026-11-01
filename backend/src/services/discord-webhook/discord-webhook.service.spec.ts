import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@config/config', () => ({ default: {}, config: {} }));
vi.mock('@services/prisma', () => ({
  default: {
    user: { findUnique: vi.fn() },
    character: { findUnique: vi.fn() },
    corporation: { findUnique: vi.fn() },
    alliance: { findUnique: vi.fn() },
    discordWebhook: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('./discord-client', () => ({
  getWebhookName: vi.fn(),
  postWebhook: vi.fn(),
}));

import prisma from '@services/prisma';
import { getWebhookName, postWebhook } from './discord-client';
import {
  DiscordWebhookError,
  listWebhooks,
  removeWebhook,
  setWebhook,
} from './discord-webhook.service';

const db = prisma as any;
const URL_OK = 'https://discord.com/api/webhooks/123/abc-DEF_1';
const SECRET = 'abc-DEF_1';

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ id: 7 });
  db.corporation.findUnique.mockResolvedValue({ id: 99, name: 'Acme Corp' });
  db.discordWebhook.findUnique.mockResolvedValue(null);
  db.discordWebhook.count.mockResolvedValue(0);
  vi.mocked(getWebhookName).mockResolvedValue({ found: true, name: 'Hook' });
  vi.mocked(postWebhook).mockResolvedValue({ outcome: 'ok', status: 204 });
  db.discordWebhook.upsert.mockImplementation(async ({ create }: any) => ({
    ...create,
    url: URL_OK,
    created_at: new Date(0),
  }));
});

const code = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e) => (e instanceof DiscordWebhookError ? e.code : e),
  );

describe('setWebhook', () => {
  it('rejects a non-discord url with INVALID_URL before any network call', async () => {
    expect(
      await code(setWebhook(1, 'CORPORATION', 99, 'https://evil.com/x')),
    ).toBe('INVALID_URL');
    expect(getWebhookName).not.toHaveBeenCalled();
    expect(postWebhook).not.toHaveBeenCalled();
  });

  it('rejects an unknown user with USER_NOT_FOUND', async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await code(setWebhook(1, 'CORPORATION', 99, URL_OK))).toBe(
      'USER_NOT_FOUND',
    );
  });

  it('rejects an unknown entity with NOT_FOUND', async () => {
    db.corporation.findUnique.mockResolvedValue(null);
    expect(await code(setWebhook(1, 'CORPORATION', 99, URL_OK))).toBe(
      'NOT_FOUND',
    );
    expect(getWebhookName).not.toHaveBeenCalled();
  });

  it('rejects the 11th webhook with LIMIT but allows updating an existing one at 10', async () => {
    db.discordWebhook.count.mockResolvedValue(10);
    expect(await code(setWebhook(1, 'CORPORATION', 99, URL_OK))).toBe('LIMIT');

    db.discordWebhook.findUnique.mockResolvedValue({ id: 1 });
    expect(await code(setWebhook(1, 'CORPORATION', 99, URL_OK))).toBeNull();
  });

  it('returns WEBHOOK_NOT_FOUND when discord answers 404', async () => {
    vi.mocked(getWebhookName).mockResolvedValue({ found: false });
    expect(await code(setWebhook(1, 'CORPORATION', 99, URL_OK))).toBe(
      'WEBHOOK_NOT_FOUND',
    );
    expect(postWebhook).not.toHaveBeenCalled();
  });

  it('returns TEST_FAILED when the test post is not ok and writes nothing', async () => {
    vi.mocked(postWebhook).mockResolvedValue({
      outcome: 'disable',
      status: 404,
    });
    expect(await code(setWebhook(1, 'CORPORATION', 99, URL_OK))).toBe(
      'TEST_FAILED',
    );
    expect(db.discordWebhook.upsert).not.toHaveBeenCalled();
  });

  it('posts the test message with the entity name', async () => {
    await setWebhook(1, 'CORPORATION', 99, URL_OK);
    expect(postWebhook).toHaveBeenCalledWith(URL_OK, {
      content:
        'KillReport will post Acme Corp kills and losses to this channel.',
    });
  });

  it('stores the normalized url and the discord name', async () => {
    await setWebhook(
      1,
      'CORPORATION',
      99,
      'https://discordapp.com/api/webhooks/123/abc-DEF_1',
    );
    const arg = db.discordWebhook.upsert.mock.calls[0][0];
    expect(arg.create.url).toBe(URL_OK);
    expect(arg.create.name).toBe('Hook');
    expect(arg.update.url).toBe(URL_OK);
  });

  it('re-setting clears disabled_at and resets active_since', async () => {
    await setWebhook(1, 'CORPORATION', 99, URL_OK);
    const { update } = db.discordWebhook.upsert.mock.calls[0][0];
    expect(update.disabled_at).toBeNull();
    expect(update.active_since).toBeInstanceOf(Date);
  });

  it('view objects never contain the url', async () => {
    const view = await setWebhook(1, 'CORPORATION', 99, URL_OK);
    expect(Object.keys(view).sort()).toEqual([
      'createdAt',
      'disabled',
      'entityId',
      'entityType',
      'name',
    ]);
    expect(JSON.stringify(view)).not.toContain(SECRET);
    expect(view.createdAt).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('listWebhooks / removeWebhook', () => {
  it('lists views without the url', async () => {
    db.discordWebhook.findMany.mockResolvedValue([
      {
        entity_type: 'ALLIANCE',
        entity_id: 5,
        url: URL_OK,
        name: null,
        disabled_at: new Date(),
        created_at: new Date(0),
      },
    ]);
    const views = await listWebhooks(1);
    expect(views[0]).toMatchObject({ disabled: true, name: null });
    expect(JSON.stringify(views)).not.toContain(SECRET);
  });

  it('lists nothing for an unknown user', async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await listWebhooks(1)).toEqual([]);
  });

  it('removes by user and entity', async () => {
    await removeWebhook(1, 'ALLIANCE', 5);
    expect(db.discordWebhook.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 7, entity_type: 'ALLIANCE', entity_id: 5 },
    });
  });
});
