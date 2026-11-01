import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@config/config', () => ({
  default: {},
  config: { eveSso: { frontendUrl: 'https://killreport.test' } },
}));

const prisma = vi.hoisted(() => ({
  killmail: { findUnique: vi.fn() },
  victim: { findUnique: vi.fn() },
  attacker: { findMany: vi.fn() },
  discordWebhook: { findMany: vi.fn(), updateMany: vi.fn() },
  type: { findMany: vi.fn() },
  character: { findMany: vi.fn() },
  corporation: { findMany: vi.fn() },
  alliance: { findMany: vi.fn() },
  solarSystem: { findMany: vi.fn() },
  constellation: { findMany: vi.fn() },
  region: { findMany: vi.fn() },
}));
vi.mock('@services/prisma-worker', () => ({
  default: prisma,
  prismaWorker: prisma,
}));
vi.mock('@services/redis', () => {
  const redis = { get: vi.fn(), set: vi.fn() };
  return { default: redis, redis };
});
vi.mock('@services/logger', () => {
  const logger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
  return { default: logger, logger };
});
vi.mock('./discord-client', () => ({ postWebhook: vi.fn() }));

import logger from '@services/logger';
import redis from '@services/redis';
import { postWebhook } from './discord-client';
import { DiscordDeliveryError, deliverKillmail } from './discord-delivery';
import { webhookUrlHash } from './discord-webhook.helpers';

const NOW = new Date('2026-11-01T12:00:00Z');
const URL_A = 'https://discord.com/api/webhooks/1/SECRETTOKENA';
const URL_B = 'https://discord.com/api/webhooks/2/SECRETTOKENB';

const row = (id: number, url: string, entityId = 500) => ({
  id,
  url,
  entity_type: 'CORPORATION',
  entity_id: entityId,
  active_since: new Date('2026-11-01T00:00:00Z'),
});

const post = vi.mocked(postWebhook);
const redisMock = vi.mocked(redis);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.killmail.findUnique.mockResolvedValue({
    killmail_id: 123,
    killmail_time: new Date('2026-11-01T11:50:00Z'),
    total_value: 1500000,
    attacker_count: 2,
    solar_system_id: 30000142,
  });
  prisma.victim.findUnique.mockResolvedValue({
    character_id: 10,
    corporation_id: 20,
    alliance_id: null,
    ship_type_id: 587,
  });
  prisma.attacker.findMany.mockResolvedValue([
    {
      character_id: 11,
      corporation_id: 500,
      alliance_id: null,
      ship_type_id: 588,
      final_blow: true,
    },
  ]);
  prisma.discordWebhook.findMany.mockResolvedValue([row(1, URL_A)]);
  prisma.discordWebhook.updateMany.mockResolvedValue({ count: 1 });
  prisma.type.findMany.mockResolvedValue([{ id: 587, name: 'Rifter' }]);
  prisma.character.findMany.mockResolvedValue([{ id: 10, name: 'Victim' }]);
  prisma.corporation.findMany.mockResolvedValue([{ id: 500, name: 'Killers' }]);
  prisma.alliance.findMany.mockResolvedValue([]);
  prisma.solarSystem.findMany.mockResolvedValue([
    { id: 30000142, name: 'Jita', security_status: 0.9, constellation_id: 7 },
  ]);
  prisma.constellation.findMany.mockResolvedValue([{ id: 7, region_id: 9 }]);
  prisma.region.findMany.mockResolvedValue([{ id: 9, name: 'The Forge' }]);
  redisMock.get.mockResolvedValue(null);
  redisMock.set.mockResolvedValue('OK');
  post.mockResolvedValue({ outcome: 'ok', status: 204 });
});

describe('deliverKillmail', () => {
  it('returns without querying webhooks when the killmail is older than 60 minutes', async () => {
    prisma.killmail.findUnique.mockResolvedValue({
      killmail_id: 123,
      killmail_time: new Date('2026-11-01T10:00:00Z'),
      total_value: 1,
      attacker_count: 1,
      solar_system_id: 1,
    });
    await deliverKillmail(123, NOW);
    expect(prisma.discordWebhook.findMany).not.toHaveBeenCalled();
    expect(prisma.victim.findUnique).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('warns and returns when the killmail does not exist', async () => {
    prisma.killmail.findUnique.mockResolvedValue(null);
    await deliverKillmail(123, NOW);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('does nothing when no webhook matches', async () => {
    prisma.discordWebhook.findMany.mockResolvedValue([]);
    await deliverKillmail(123, NOW);
    expect(prisma.type.findMany).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('delivers one POST per url and marks it sent with EX 86400 NX', async () => {
    prisma.discordWebhook.findMany.mockResolvedValue([
      row(1, URL_A),
      row(2, URL_A),
    ]);
    await deliverKillmail(123, NOW);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe(URL_A);
    const payload = JSON.stringify(post.mock.calls[0][1]);
    expect(payload).toContain('Rifter');
    expect(payload).toContain('https://killreport.test/killmails/123');
    expect(redisMock.set).toHaveBeenCalledWith(
      `discord:sent:123:${webhookUrlHash(URL_A)}`,
      '1',
      'EX',
      86400,
      'NX',
    );
    expect(redisMock.set.mock.calls[0][0]).toMatch(
      /^discord:sent:123:[0-9a-f]{16}$/,
    );
  });

  it('skips urls already marked sent', async () => {
    redisMock.get.mockResolvedValue('1');
    await deliverKillmail(123, NOW);
    expect(redisMock.get).toHaveBeenCalledWith(
      `discord:sent:123:${webhookUrlHash(URL_A)}`,
    );
    expect(post).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('disables 404 url and still delivers the rest', async () => {
    prisma.discordWebhook.findMany.mockResolvedValue([
      row(1, URL_A),
      row(2, URL_B),
    ]);
    post.mockImplementation(async (url) =>
      url === URL_A
        ? { outcome: 'disable', status: 404 }
        : { outcome: 'ok', status: 204 },
    );
    await expect(deliverKillmail(123, NOW)).resolves.toBeUndefined();
    expect(prisma.discordWebhook.updateMany).toHaveBeenCalledWith({
      where: { url: URL_A },
      data: { disabled_at: NOW },
    });
    expect(prisma.discordWebhook.updateMany).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledTimes(1);
    expect(redisMock.set.mock.calls[0][0]).toContain(webhookUrlHash(URL_B));
  });

  it('drop outcome logs and does not throw or disable', async () => {
    post.mockResolvedValue({ outcome: 'drop', status: 400, body: 'bad' });
    await expect(deliverKillmail(123, NOW)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(prisma.discordWebhook.updateMany).not.toHaveBeenCalled();
    expect(redisMock.set).toHaveBeenCalledTimes(1);
    expect(redisMock.set.mock.calls[0][0]).toContain(webhookUrlHash(URL_A));
  });

  it('throws DiscordDeliveryError when any url is transient, after trying all urls', async () => {
    prisma.discordWebhook.findMany.mockResolvedValue([
      row(1, URL_A),
      row(2, URL_B),
    ]);
    post.mockImplementation(async (url) =>
      url === URL_A
        ? { outcome: 'transient', status: 500 }
        : { outcome: 'ok', status: 204 },
    );
    await expect(deliverKillmail(123, NOW)).rejects.toBeInstanceOf(
      DiscordDeliveryError,
    );
    expect(post).toHaveBeenCalledTimes(2);
    expect(redisMock.set).toHaveBeenCalledTimes(1);
  });

  it('delivery error message carries no status code', async () => {
    post.mockResolvedValue({ outcome: 'transient', status: 429 });
    const error = await deliverKillmail(123, NOW).catch((e: Error) => e);
    expect(error).toBeInstanceOf(DiscordDeliveryError);
    const err = error as Error;
    expect(err.name).toBe('DiscordDeliveryError');
    expect(err.message.split('\n')[0]).not.toMatch(/\b(404|420|429)\b/);
    expect(err.message).not.toContain('discord.com');
    expect(err.message).not.toContain('SECRETTOKEN');
  });

  it('never logs the webhook url', async () => {
    prisma.discordWebhook.findMany.mockResolvedValue([
      row(1, URL_A),
      row(2, URL_B, 501),
    ]);
    prisma.attacker.findMany.mockResolvedValue([
      {
        character_id: 11,
        corporation_id: 500,
        alliance_id: null,
        ship_type_id: 588,
        final_blow: true,
      },
      {
        character_id: 12,
        corporation_id: 501,
        alliance_id: null,
        ship_type_id: 588,
        final_blow: false,
      },
    ]);
    const outcomes = ['disable', 'drop'] as const;
    let i = 0;
    post.mockImplementation(async () => ({
      outcome: outcomes[i++],
      status: 400,
      body: 'x',
    }));
    await deliverKillmail(123, NOW);
    post.mockResolvedValue({ outcome: 'transient', status: 500 });
    await deliverKillmail(123, NOW).catch(() => undefined);
    const calls = [
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ];
    expect(calls.length).toBeGreaterThan(2);
    const logged = JSON.stringify(calls);
    expect(logged).not.toContain('SECRETTOKEN');
    expect(logged).not.toContain('discord.com');
  });
});
