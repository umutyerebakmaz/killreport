import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A corporation sync reads the corporation from `characters` (users never
 * stored one), records what ESI lists into killmail_refs and stamps the
 * user. A 403 is permanent until the user logs in again: it is recorded in
 * `corp_killmails_denied_at`, which the cron honours.
 */

const {
  prismaMock,
  loadUserCredentials,
  getKillmailPage,
  recordRefs,
  isForbidden,
} = vi.hoisted(() => ({
  prismaMock: {
    user: { update: vi.fn() },
    character: { findUnique: vi.fn() },
  },
  loadUserCredentials: vi.fn(),
  getKillmailPage: vi.fn(),
  recordRefs: vi.fn(),
  isForbidden: vi.fn(),
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
vi.mock('@services/corporation/corporation.service', () => ({
  CorporationService: { getKillmailPage },
}));
vi.mock('@services/killmail-refs', () => ({ recordRefs }));

import { syncCorporation } from './worker-esi-corporation-killmails';

const NOW = new Date('2026-11-26T10:00:00.000Z');
const ref = (id: number) => ({ killmail_id: id, killmail_hash: `h${id}` });
const message = { userId: 7, queuedAt: NOW.toISOString() };

const CREDENTIALS = {
  ok: true,
  user: {
    id: 7,
    character_id: 95465499,
    character_name: 'Test Director',
    last_killmail_sync_at: null,
    last_corp_killmail_sync_at: new Date(0),
  },
  accessToken: 'tok',
  expiresAt: new Date('2026-11-26T10:20:00.000Z'),
};

const STAMP = {
  where: { id: 7 },
  data: { last_corp_killmail_sync_at: NOW },
};

beforeEach(() => {
  vi.clearAllMocks();
  getKillmailPage.mockReset();
  recordRefs.mockReset();
  isForbidden.mockReturnValue(false);
  loadUserCredentials.mockResolvedValue(CREDENTIALS);
  prismaMock.character.findUnique.mockResolvedValue({
    corporation_id: 98000001,
  });
});

describe('syncCorporation', () => {
  it('reads the corporation from characters and records corporation refs', async () => {
    getKillmailPage.mockResolvedValueOnce({ refs: [ref(1)], pages: 1 });
    recordRefs.mockResolvedValue(1);

    expect(await syncCorporation(message, NOW)).toBe('synced');
    expect(prismaMock.character.findUnique).toHaveBeenCalledWith({
      where: { id: 95465499 },
      select: { corporation_id: true },
    });
    expect(getKillmailPage).toHaveBeenCalledWith(98000001, 'tok', 95465499, 1);
    expect(recordRefs).toHaveBeenCalledWith([ref(1)], 'corporation', NOW);
    expect(prismaMock.user.update).toHaveBeenCalledWith(STAMP);
  });

  it('stamps the user when the list is empty', async () => {
    getKillmailPage.mockResolvedValueOnce({ refs: [], pages: 1 });

    expect(await syncCorporation(message, NOW)).toBe('synced');
    expect(prismaMock.user.update).toHaveBeenCalledWith(STAMP);
  });

  it('missing_character_row_skips_corporation', async () => {
    prismaMock.character.findUnique.mockResolvedValue(null);

    expect(await syncCorporation(message, NOW)).toBe('skipped');
    expect(getKillmailPage).not.toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledWith(STAMP);
  });

  it('skips an NPC corporation', async () => {
    prismaMock.character.findUnique.mockResolvedValue({
      corporation_id: 1000125,
    });

    expect(await syncCorporation(message, NOW)).toBe('skipped');
    expect(getKillmailPage).not.toHaveBeenCalled();
  });

  it('records a 403 as denied and stamps the user', async () => {
    const forbidden = { response: { status: 403 } };
    getKillmailPage.mockRejectedValueOnce(forbidden);
    isForbidden.mockImplementation((e) => e === forbidden);

    expect(await syncCorporation(message, NOW)).toBe('denied');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { corp_killmails_denied_at: NOW, last_corp_killmail_sync_at: NOW },
    });
  });

  it('failure_mid_walk_keeps_refs_and_no_stamp', async () => {
    getKillmailPage
      .mockResolvedValueOnce({ refs: [ref(1)], pages: 3 })
      .mockRejectedValueOnce(new Error('ESI 502'));
    recordRefs.mockResolvedValue(1);

    await expect(syncCorporation(message, NOW)).rejects.toThrow('ESI 502');
    expect(recordRefs).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('skips a user whose token was revoked', async () => {
    loadUserCredentials.mockResolvedValue({
      ok: false,
      reason: 'token-revoked',
    });

    expect(await syncCorporation(message, NOW)).toBe('skipped');
    expect(prismaMock.character.findUnique).not.toHaveBeenCalled();
  });
});
