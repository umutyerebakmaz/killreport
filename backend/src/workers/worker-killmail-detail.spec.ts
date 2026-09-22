import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The detail worker: one message, one killmail, no credentials.
 *
 * It is source-agnostic by design — it never learns which list stage found the
 * killmail — so everything it needs is in the message.
 */

const { saveKillmail, getKillmailDetail, loggerMock } = vi.hoisted(() => ({
  saveKillmail: vi.fn(async () => true),
  getKillmailDetail: vi.fn(async () => ({
    killmail_id: 128431979,
    killmail_time: '2026-09-19T14:03:22Z',
    solar_system_id: 30002187,
    victim: { corporation_id: 1, ship_type_id: 670, damage_taken: 1 },
    attackers: [{ damage_done: 1, final_blow: true, security_status: 0 }],
  })),
  loggerMock: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@services/killmail-writer', () => ({ saveKillmail }));
vi.mock('@services/killmail/killmail.service', () => ({
  KillmailService: { getKillmailDetail },
}));
vi.mock('@services/logger', () => ({ default: loggerMock }));
vi.mock('@services/prisma-worker', () => ({ default: {} }));
vi.mock('@services/rabbitmq', () => ({
  ensureAllQueuesExist: vi.fn(),
  getRabbitMQChannel: vi.fn(),
}));

import { processDetailMessage } from './worker-killmail-detail';

beforeEach(() => vi.clearAllMocks());

describe('processDetailMessage', () => {
  it('fetches the detail by id and hash, then writes it', async () => {
    await processDetailMessage({
      killmailId: 128431979,
      killmailHash: 'abc123',
      announce: true,
    });

    expect(getKillmailDetail).toHaveBeenCalledWith(128431979, 'abc123');
    expect(saveKillmail).toHaveBeenCalledWith(
      expect.objectContaining({ killmail_id: 128431979 }),
      'abc123',
      { publish: true },
    );
  });

  it('carries announce: false through to the writer', async () => {
    await processDetailMessage({
      killmailId: 1,
      killmailHash: 'h',
      announce: false,
    });

    expect(saveKillmail).toHaveBeenCalledWith(expect.anything(), 'h', {
      publish: false,
    });
  });
});

describe('a killmail two sources both found', () => {
  it('reports the writer’s false without treating it as a failure', async () => {
    saveKillmail.mockResolvedValueOnce(false);

    await expect(
      processDetailMessage({
        killmailId: 1,
        killmailHash: 'h',
        announce: true,
      }),
    ).resolves.toBe(false);
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});

describe('a killmail the writer refuses', () => {
  it('lets the throw reach the shared failure path instead of acking it away', async () => {
    saveKillmail.mockRejectedValueOnce(
      new Error('killmail 1 has no attackers; refusing to write it'),
    );

    await expect(
      processDetailMessage({
        killmailId: 1,
        killmailHash: 'h',
        announce: true,
      }),
    ).rejects.toThrow(/no attackers/i);
  });
});
