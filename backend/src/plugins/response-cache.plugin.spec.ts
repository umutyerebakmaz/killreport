import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useResponseCache, redisCache, logger } = vi.hoisted(() => ({
  useResponseCache: vi.fn((options: unknown) => ({ options })),
  redisCache: { get: vi.fn(), setex: vi.fn(), keys: vi.fn(), del: vi.fn() },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@envelop/response-cache', () => ({ useResponseCache }));
vi.mock('@services/redis-cache', () => ({ redisCache, default: redisCache }));
vi.mock('@services/logger', () => ({ default: logger }));
vi.mock('@config/cache', () => ({
  CACHE_TTL: { DEFAULT_PUBLIC: 120_000, REDIS_DEFAULT: 60_000 },
  MAX_CACHE_TTL_SECONDS: 31_536_000,
  PUBLIC_CACHE_QUERIES: ['Killmails', 'KillmailDetail'],
  TTL_PER_SCHEMA_COORDINATE: { 'Query.killmails': 60_000 },
}));

import { createResponseCachePlugin } from './response-cache.plugin';

type Options = {
  session: (request: unknown) => string;
  ttl: number;
  ttlPerSchemaCoordinate: Record<string, number>;
  includeExtensionMetadata: boolean;
  cache: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown, ttl?: unknown) => Promise<void>;
    invalidate: (
      entities: Array<{ typename: string; id?: string | number }>,
    ) => Promise<void>;
  };
  shouldCacheResult: (args: { result: { errors?: unknown[] } }) => boolean;
};

function pluginOptions(): Options {
  createResponseCachePlugin();
  return useResponseCache.mock.calls[0][0] as Options;
}

// Built at runtime so no "Bearer <token>" literal sits in the file for secret scanners to trip on.
const bearer = (token: string) => ['Bearer', token].join(' ');

function request(
  operationName: string | undefined,
  headers: Record<string, string> = {},
) {
  return {
    request: { body: { operationName }, headers: new Headers(headers) },
  };
}

beforeEach(() => {
  redisCache.get.mockResolvedValue(null);
  redisCache.setex.mockResolvedValue('OK');
  redisCache.keys.mockResolvedValue([]);
  redisCache.del.mockResolvedValue(0);
});

describe('createResponseCachePlugin', () => {
  it('hands the configured TTLs and extension metadata flag to useResponseCache', () => {
    const options = pluginOptions();

    expect(options.ttl).toBe(120_000);
    expect(options.ttlPerSchemaCoordinate).toEqual({
      'Query.killmails': 60_000,
    });
    expect(options.includeExtensionMetadata).toBe(true);
  });
});

describe('session', () => {
  it('shares one cache for public operations, whoever asks', () => {
    const { session } = pluginOptions();

    expect(
      session(
        request('Killmails', { authorization: bearer('not-a-real-token') }),
      ),
    ).toBe('public');
    expect(session(request('KillmailDetail'))).toBe('public');
  });

  it('keys private operations on the first eight characters of the bearer token', () => {
    const { session } = pluginOptions();

    expect(
      session(request('Me', { authorization: bearer('abcdefghijklmnop') })),
    ).toBe('abcdefgh');
    expect(
      session(request('Me', { Authorization: bearer('abcdefghijklmnop') })),
    ).toBe('abcdefgh');
  });

  it('falls back to anonymous without a bearer token or without an operation name', () => {
    const { session } = pluginOptions();

    expect(session(request('Me'))).toBe('anonymous');
    expect(session(request('Me', { authorization: 'Basic abc' }))).toBe(
      'anonymous',
    );
    expect(session(request(undefined))).toBe('anonymous');
    expect(session({})).toBe('anonymous');
  });
});

describe('cache.get', () => {
  it('parses a hit and returns null on a miss', async () => {
    const { cache } = pluginOptions();
    redisCache.get.mockResolvedValueOnce(
      JSON.stringify({ data: { ok: true } }),
    );

    await expect(cache.get('k1')).resolves.toEqual({ data: { ok: true } });
    await expect(cache.get('k2')).resolves.toBeNull();
    expect(redisCache.get).toHaveBeenCalledWith('k1');
  });

  it('treats a Redis failure as a miss and logs it', async () => {
    const { cache } = pluginOptions();
    const failure = new Error('ECONNREFUSED');
    redisCache.get.mockRejectedValueOnce(failure);

    await expect(cache.get('k')).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Cache get error:', failure);
  });
});

describe('cache.set', () => {
  it('stores the serialised value with the TTL converted from ms to whole seconds', async () => {
    const { cache } = pluginOptions();

    await cache.set('k', { data: 1 }, 120_000);
    await cache.set('k2', { data: 2 }, 1_500);

    expect(redisCache.setex).toHaveBeenNthCalledWith(1, 'k', 120, '{"data":1}');
    expect(redisCache.setex).toHaveBeenNthCalledWith(2, 'k2', 2, '{"data":2}');
  });

  it('reads the first entry when the TTL arrives as an iterator', async () => {
    const { cache } = pluginOptions();

    await cache.set('k', { data: 1 }, new Set([5_000, 9_000]).values());

    expect(redisCache.setex).toHaveBeenCalledWith('k', 5, '{"data":1}');
  });

  it('uses the Redis default when no TTL is given', async () => {
    const { cache } = pluginOptions();

    await cache.set('k', { data: 1 });
    await cache.set('k2', { data: 2 }, null);

    expect(redisCache.setex).toHaveBeenNthCalledWith(1, 'k', 60, '{"data":1}');
    expect(redisCache.setex).toHaveBeenNthCalledWith(2, 'k2', 60, '{"data":2}');
  });

  it('clamps a zero or oversized TTL to 60 seconds with a warning', async () => {
    const { cache } = pluginOptions();

    await cache.set('zero', { data: 1 }, 0);
    await cache.set('huge', { data: 2 }, 31_536_001_000);

    expect(redisCache.setex).toHaveBeenNthCalledWith(
      1,
      'zero',
      60,
      '{"data":1}',
    );
    expect(redisCache.setex).toHaveBeenNthCalledWith(
      2,
      'huge',
      60,
      '{"data":2}',
    );
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('logs a Redis failure instead of failing the request', async () => {
    const { cache } = pluginOptions();
    const failure = new Error('OOM');
    redisCache.setex.mockRejectedValueOnce(failure);

    await expect(cache.set('k', { data: 1 }, 1_000)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('Cache set error:', failure);
  });
});

describe('cache.invalidate', () => {
  it('deletes every key matching each entity and skips entities with no keys', async () => {
    const { cache } = pluginOptions();
    redisCache.keys.mockImplementation(async (pattern: string) =>
      pattern.includes('Character:42')
        ? ['a:Character:42', 'b:Character:42']
        : [],
    );

    await cache.invalidate([
      { typename: 'Character', id: 42 },
      { typename: 'Alliance', id: 7 },
    ]);

    expect(redisCache.keys).toHaveBeenCalledWith('*Character:42*');
    expect(redisCache.keys).toHaveBeenCalledWith('*Alliance:7*');
    expect(redisCache.del).toHaveBeenCalledTimes(1);
    expect(redisCache.del).toHaveBeenCalledWith(
      'a:Character:42',
      'b:Character:42',
    );
  });

  it('logs a Redis failure instead of throwing', async () => {
    const { cache } = pluginOptions();
    const failure = new Error('timeout');
    redisCache.keys.mockRejectedValueOnce(failure);

    await expect(
      cache.invalidate([{ typename: 'Character', id: 1 }]),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Cache invalidate error:',
      failure,
    );
  });
});

describe('shouldCacheResult', () => {
  it('caches only results without errors', () => {
    const { shouldCacheResult } = pluginOptions();

    expect(shouldCacheResult({ result: {} })).toBe(true);
    expect(shouldCacheResult({ result: { errors: [] } })).toBe(true);
    expect(
      shouldCacheResult({ result: { errors: [{ message: 'boom' }] } }),
    ).toBe(false);
  });
});
