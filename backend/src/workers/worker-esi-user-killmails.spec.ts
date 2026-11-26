import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A character sync records what ESI lists into killmail_refs and stamps the
 * user; it publishes nothing itself. See
 * docs/superpowers/specs/2026-11-26-killmail-refs-sync-design.md.
 */

const {
  prismaMock,
  loadUserCredentials,
  getKillmailPage,
  recordRefs,
  isForbidden,
} = vi.hoisted(() => ({
  isForbidden: vi.fn(() => false),
  prismaMock: { user: { update: vi.fn() } },
  loadUserCredentials: vi.fn(),
  getKillmailPage: vi.fn(),
  recordRefs: vi.fn(),
}));

vi.mock('@config/config', () => ({
  config: { esi: { maxRequestsPerSecond: 50, prefetch: 25 } },
}));
vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));
vi.mock('@services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/rabbitmq', () => ({
  ensureAllQueuesExist: vi.fn(),
  getRabbitMQChannel: vi.fn(),
}));
vi.mock('./worker-error', () => ({ handleWorkerError: vi.fn(), isForbidden }));
vi.mock('@services/user-credentials', () => ({ loadUserCredentials }));
vi.mock('@services/character/character.service', () => ({
  CharacterService: { getKillmailPage },
}));
vi.mock('@services/killmail-refs', () => ({ recordRefs }));

import { syncUser } from './worker-esi-user-killmails';

const NOW = new Date('2026-11-26T10:00:00.000Z');
const ref = (id: number) => ({ killmail_id: id, killmail_hash: `h${id}` });

function credentials(lastSync: Date | null) {
  return {
    ok: true,
    user: {
      id: 7,
      character_id: 95465499,
      character_name: 'Test Pilot',
      last_killmail_sync_at: lastSync,
      last_corp_killmail_sync_at: null,
    },
    accessToken: 'tok',
    expiresAt: new Date('2026-11-26T10:20:00.000Z'),
  };
}

const message = (fullSync?: boolean) => ({
  userId: 7,
  queuedAt: NOW.toISOString(),
  ...(fullSync ? { fullSync } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  getKillmailPage.mockReset();
  recordRefs.mockReset();
  isForbidden.mockReturnValue(false);
});

describe('syncUser', () => {
  it('records the refs as character refs and stamps the user', async () => {
    loadUserCredentials.mockResolvedValue(credentials(new Date(0)));
    getKillmailPage.mockResolvedValueOnce({ refs: [ref(1)], pages: 1 });
    recordRefs.mockResolvedValue(1);

    expect(await syncUser(message(), NOW)).toBe('synced');
    expect(getKillmailPage).toHaveBeenCalledWith(95465499, 'tok', 1);
    expect(recordRefs).toHaveBeenCalledWith([ref(1)], 'character', NOW);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { last_killmail_sync_at: NOW },
    });
  });

  it('stops on a known page unless the user has never synced', async () => {
    const threePages = async (page: number) => ({
      refs: [ref(page)],
      pages: 3,
    });
    getKillmailPage.mockImplementation(threePages);
    recordRefs.mockResolvedValue(0);

    loadUserCredentials.mockResolvedValue(credentials(new Date(0)));
    await syncUser(message(), NOW);
    expect(getKillmailPage).toHaveBeenCalledTimes(1);

    getKillmailPage.mockClear();
    loadUserCredentials.mockResolvedValue(credentials(null));
    await syncUser(message(), NOW);
    expect(getKillmailPage).toHaveBeenCalledTimes(3);
  });

  it('walks every page when the message asks for a full sync', async () => {
    loadUserCredentials.mockResolvedValue(credentials(new Date(0)));
    getKillmailPage
      .mockResolvedValueOnce({ refs: [ref(1)], pages: 2 })
      .mockResolvedValueOnce({ refs: [ref(2)], pages: 2 });
    recordRefs.mockResolvedValue(0);

    await syncUser(message(true), NOW);
    expect(getKillmailPage).toHaveBeenCalledTimes(2);
  });

  it('stamps the user when the list is empty', async () => {
    loadUserCredentials.mockResolvedValue(credentials(new Date(0)));
    getKillmailPage.mockResolvedValueOnce(null);

    expect(await syncUser(message(), NOW)).toBe('synced');
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
  });

  it('failure_mid_walk_keeps_refs_and_no_stamp', async () => {
    loadUserCredentials.mockResolvedValue(credentials(new Date(0)));
    getKillmailPage
      .mockResolvedValueOnce({ refs: [ref(1)], pages: 3 })
      .mockRejectedValueOnce(new Error('ESI 502'));
    recordRefs.mockResolvedValue(1);

    await expect(syncUser(message(), NOW)).rejects.toThrow('ESI 502');
    expect(recordRefs).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('settles a 403 on the character list: stamp and skip, not retried', async () => {
    const forbidden = { response: { status: 403 } };
    loadUserCredentials.mockResolvedValue(credentials(new Date(0)));
    getKillmailPage.mockRejectedValueOnce(forbidden);
    isForbidden.mockImplementation((e) => e === forbidden);

    expect(await syncUser(message(), NOW)).toBe('skipped');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { last_killmail_sync_at: NOW },
    });
  });

  it('skips a user whose token was revoked without calling ESI', async () => {
    loadUserCredentials.mockResolvedValue({
      ok: false,
      reason: 'token-revoked',
    });

    expect(await syncUser(message(), NOW)).toBe('skipped');
    expect(getKillmailPage).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
