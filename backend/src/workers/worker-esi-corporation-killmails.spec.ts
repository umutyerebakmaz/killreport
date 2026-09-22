import { beforeEach, describe, expect, it, vi } from 'vitest';
import type amqp from 'amqplib';

/**
 * The corporation worker's one local failure policy.
 *
 * ESI answers 403 when the user is not a Director or CEO, or logged in without
 * `esi-killmails.read_corporation_killmails.v1`. Retrying cannot change either,
 * and the publisher re-selects anyone whose `last_corp_killmail_sync_at` is
 * stale — so without this the same user is queued every tick, burns five
 * attempts and parks, forever.
 */

const { prismaMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: { user: { update: vi.fn() } },
  loggerMock: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@services/prisma-worker', () => ({ default: prismaMock }));
vi.mock('@services/logger', () => ({ default: loggerMock }));
vi.mock('@services/pubsub', () => ({ pubsub: { publish: vi.fn() } }));
vi.mock('@services/rabbitmq', () => ({
  ensureAllQueuesExist: vi.fn(),
  getRabbitMQChannel: vi.fn(),
}));
vi.mock('@services/user-credentials', () => ({ loadUserCredentials: vi.fn() }));
vi.mock('@services/corporation/corporation.service', () => ({
  CorporationService: {},
}));
vi.mock('@services/killmail/killmail.service', () => ({ KillmailService: {} }));
vi.mock('@services/kill-stats-realtime', () => ({
  updateDailyAggregatesRealtime: vi.fn(),
}));
vi.mock('@services/killmail-filters-realtime', () => ({
  insertKillmailFilter: vi.fn(),
}));

import { settleForbidden } from './worker-esi-corporation-killmails';

const channel = { ack: vi.fn(), nack: vi.fn() } as unknown as amqp.Channel;
const msg = { content: Buffer.from('{}') } as amqp.ConsumeMessage;

beforeEach(() => vi.clearAllMocks());

describe('settleForbidden', () => {
  it('acks a 403 and records the attempt, so the publisher stops reselecting', async () => {
    const settled = await settleForbidden(channel, msg, 7, {
      response: { status: 403 },
    });

    expect(settled).toBe(true);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { last_corp_killmail_sync_at: expect.any(Date) },
    });
  });

  it('leaves every other failure to the shared path', async () => {
    const settled = await settleForbidden(channel, msg, 7, new Error('boom'));

    expect(settled).toBe(false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('does not lose the message when the stamp cannot be written', async () => {
    prismaMock.user.update.mockRejectedValueOnce(new Error('database down'));

    const settled = await settleForbidden(channel, msg, 7, {
      response: { status: 403 },
    });

    // The row is what stops the loop; if it was not written, the message has
    // to take the retry path rather than be acked away silently.
    expect(settled).toBe(false);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});
