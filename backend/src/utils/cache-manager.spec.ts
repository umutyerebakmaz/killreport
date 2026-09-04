import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock, logger } = vi.hoisted(() => ({
  redisMock: {
    keys: vi.fn(),
    del: vi.fn(),
    ping: vi.fn(),
    info: vi.fn(),
    dbsize: vi.fn(),
  },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@services/redis-cache', () => ({
  default: redisMock,
  redisCache: redisMock,
}));
vi.mock('@services/logger', () => ({ default: logger }));

import CacheManager from './cache-manager';

/** Every pattern clearPattern was asked for, in call order. */
function patterns() {
  return redisMock.keys.mock.calls.map(([pattern]) => pattern);
}

beforeEach(() => {
  redisMock.keys.mockResolvedValue([]);
  redisMock.del.mockResolvedValue(0);
  redisMock.ping.mockResolvedValue('PONG');
  redisMock.dbsize.mockResolvedValue(0);
});

describe('clearPattern', () => {
  it('deletes every matching key in one call and returns the count', async () => {
    redisMock.keys.mockResolvedValue(['a', 'b', 'c']);
    redisMock.del.mockResolvedValue(3);

    await expect(CacheManager.clearPattern('killmail:*')).resolves.toBe(3);
    expect(redisMock.keys).toHaveBeenCalledWith('killmail:*');
    expect(redisMock.del).toHaveBeenCalledTimes(1);
    expect(redisMock.del).toHaveBeenCalledWith('a', 'b', 'c');
  });

  it('returns 0 without calling DEL when nothing matches', async () => {
    await expect(CacheManager.clearPattern('nope:*')).resolves.toBe(0);
    expect(redisMock.del).not.toHaveBeenCalled();
  });

  it('logs and rethrows a Redis failure', async () => {
    const failure = new Error('READONLY');
    redisMock.keys.mockRejectedValue(failure);

    await expect(CacheManager.clearPattern('k:*')).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(
      'Error clearing cache pattern k:*:',
      failure,
    );
  });
});

/**
 * The four entity helpers share a shape: delete the detail key outright, then
 * clear the response-cache patterns for the singular and plural operations.
 */
const ENTITY_CLEARERS = [
  {
    name: 'clearKillmail',
    run: (id: number) => CacheManager.clearKillmail(id),
    detailKey: 'killmail:detail:7',
    patterns: [
      'response-cache:*:Killmail:*',
      'response-cache:*:Killmails:*',
      'killmails:list:*',
      'killmails:dateCounts:*',
    ],
  },
  {
    name: 'clearCharacter',
    run: (id: number) => CacheManager.clearCharacter(id),
    detailKey: 'character:detail:7',
    patterns: ['response-cache:*:Character:*', 'response-cache:*:Characters:*'],
  },
  {
    name: 'clearCorporation',
    run: (id: number) => CacheManager.clearCorporation(id),
    detailKey: 'corporation:detail:7',
    patterns: [
      'response-cache:*:Corporation:*',
      'response-cache:*:Corporations:*',
    ],
  },
  {
    name: 'clearAlliance',
    run: (id: number) => CacheManager.clearAlliance(id),
    detailKey: 'alliance:detail:7',
    patterns: ['response-cache:*:Alliance:*', 'response-cache:*:Alliances:*'],
  },
];

describe.each(ENTITY_CLEARERS)(
  '$name',
  ({ run, detailKey, patterns: expected }) => {
    it('deletes the detail key and clears the response cache patterns', async () => {
      await run(7);

      expect(redisMock.del).toHaveBeenCalledWith(detailKey);
      expect(patterns()).toEqual(expected);
    });
  },
);

describe('clearAllKillmails', () => {
  it('clears every killmail-related pattern, the carousel included', async () => {
    await CacheManager.clearAllKillmails();

    expect(patterns()).toEqual([
      'killmail:detail:*',
      'killmails:list:*',
      'killmails:dateCounts:*',
      'killmails:mostvaluable:*',
      'response-cache:*:Killmail*',
      'response-cache:*:MostValuableKillmails*',
    ]);
  });
});

describe('getStats', () => {
  it('counts the keys behind each prefix', async () => {
    const byPattern: Record<string, string[]> = {
      '*': ['a', 'b', 'c', 'd', 'e'],
      'killmail:detail:*': ['a', 'b'],
      'character:detail:*': ['c'],
      'corporation:detail:*': [],
      'alliance:detail:*': ['d'],
      'response-cache:*': ['e'],
    };
    redisMock.keys.mockImplementation(
      async (pattern: string) => byPattern[pattern] ?? [],
    );

    await expect(CacheManager.getStats()).resolves.toEqual({
      totalKeys: 5,
      killmailDetailKeys: 2,
      characterDetailKeys: 1,
      corporationDetailKeys: 0,
      allianceDetailKeys: 1,
      responseCacheKeys: 1,
    });
  });
});

describe('healthCheck', () => {
  it('is true when Redis answers a ping', async () => {
    await expect(CacheManager.healthCheck()).resolves.toBe(true);
  });

  it('is false and logs when the ping fails', async () => {
    const failure = new Error('ETIMEDOUT');
    redisMock.ping.mockRejectedValue(failure);

    await expect(CacheManager.healthCheck()).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Cache health check failed:',
      failure,
    );
  });
});

describe('getMemoryUsage', () => {
  it('pulls used_memory_human out of the INFO block', async () => {
    redisMock.info.mockResolvedValue(
      '# Memory\r\nused_memory:1024\r\nused_memory_human:1.25M\r\n',
    );

    await expect(CacheManager.getMemoryUsage()).resolves.toBe('1.25M');
    expect(redisMock.info).toHaveBeenCalledWith('memory');
  });

  it('is unknown when the field is absent and error when the call throws', async () => {
    redisMock.info.mockResolvedValueOnce('# Memory\r\nused_memory:1024\r\n');
    await expect(CacheManager.getMemoryUsage()).resolves.toBe('unknown');

    redisMock.info.mockRejectedValueOnce(new Error('down'));
    await expect(CacheManager.getMemoryUsage()).resolves.toBe('error');
  });
});

describe('getRedisMetrics', () => {
  const INFO: Record<string, string> = {
    memory: '# Memory\r\nused_memory_human:2.50M\r\n',
    server: '# Server\r\nredis_version:7.2.4\r\nuptime_in_seconds:86400\r\n',
    clients: '# Clients\r\nconnected_clients:12\r\n',
    stats:
      '# Stats\r\ntotal_commands_processed:987654\r\ninstantaneous_ops_per_sec:42\r\n',
  };

  it('parses memory, uptime, clients and command counters', async () => {
    redisMock.info.mockImplementation(
      async (section: string) => INFO[section] ?? '',
    );
    redisMock.dbsize.mockResolvedValue(1234);

    await expect(CacheManager.getRedisMetrics()).resolves.toEqual({
      connected: true,
      memoryUsage: '2.50M',
      totalKeys: 1234,
      connectedClients: 12,
      totalCommandsProcessed: 987654,
      commandsPerSecond: 42,
      uptimeInSeconds: 86400,
    });
  });

  it('falls back to zeros for fields the INFO output does not carry', async () => {
    redisMock.info.mockResolvedValue('');
    redisMock.dbsize.mockResolvedValue(0);

    await expect(CacheManager.getRedisMetrics()).resolves.toMatchObject({
      connected: true,
      memoryUsage: 'unknown',
      connectedClients: 0,
      totalCommandsProcessed: 0,
      commandsPerSecond: 0,
      uptimeInSeconds: 0,
    });
  });

  it('reports disconnected with zeroed counters when Redis fails', async () => {
    const failure = new Error('ECONNREFUSED');
    redisMock.info.mockRejectedValue(failure);

    await expect(CacheManager.getRedisMetrics()).resolves.toEqual({
      connected: false,
      memoryUsage: 'error',
      totalKeys: 0,
      connectedClients: 0,
      totalCommandsProcessed: 0,
      commandsPerSecond: 0,
      uptimeInSeconds: 0,
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting Redis metrics:',
      failure,
    );
  });
});

describe('warmupCache', () => {
  it('only logs today, and touches no Redis key', async () => {
    // Pinned so the placeholder cannot start doing real work unnoticed.
    await CacheManager.warmupCache(25);

    expect(redisMock.keys).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Starting cache warmup for top 25 entities...',
    );
  });
});
