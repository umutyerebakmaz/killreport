import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The rate limit plugin. Two things matter here beyond the counting: who a
 * request is attributed to — a shared identifier would let one caller spend
 * another's budget — and that a Redis outage fails open, since the plugin sits
 * in front of every request the server answers.
 */

const { redisCache, logger } = vi.hoisted(() => ({
  redisCache: {
    get: vi.fn(),
    setex: vi.fn(),
    incr: vi.fn(),
    ttl: vi.fn(),
  },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@services/redis-cache', () => ({ redisCache, default: redisCache }));
vi.mock('@services/logger', () => ({ default: logger }));

import { createRateLimitPlugin } from './rate-limit.plugin';

/** A request stand-in with only the header bag the plugin reads. */
function request(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as any;
}

const bearer = (token: string) => ['Bearer', token].join(' ');

type Hooks = {
  onRequest: (args: {
    request: unknown;
    fetchAPI: { Response: typeof Response };
    endResponse: (response: Response) => void;
  }) => Promise<void>;
  onResponse: (args: { request: unknown; response: Response }) => Promise<void>;
};

function hooks(config?: Parameters<typeof createRateLimitPlugin>[0]) {
  return createRateLimitPlugin(config) as unknown as Hooks;
}

/** Run onRequest and report whether it ended the response, and with what. */
async function onRequest(
  plugin: Hooks,
  req: unknown,
): Promise<Response | null> {
  let ended: Response | null = null;
  await plugin.onRequest({
    request: req,
    fetchAPI: { Response },
    endResponse: (response) => {
      ended = response;
    },
  });
  return ended;
}

beforeEach(() => {
  redisCache.get.mockResolvedValue(null);
  redisCache.setex.mockResolvedValue('OK');
  redisCache.incr.mockResolvedValue(2);
  redisCache.ttl.mockResolvedValue(45);
});

describe('identifying the caller', () => {
  it('attributes an authenticated request to its token, not its IP', async () => {
    const plugin = hooks();
    await onRequest(
      plugin,
      request({
        authorization: bearer('abcdefgh-the-rest-is-ignored'),
        'x-forwarded-for': '203.0.113.7',
      }),
    );

    expect(redisCache.get).toHaveBeenCalledWith('ratelimit:user:abcdefgh');
  });

  it('takes only the first eight characters of the token', async () => {
    const plugin = hooks();
    await onRequest(plugin, request({ authorization: bearer('abcdefgh') }));
    await onRequest(
      plugin,
      request({ authorization: bearer('abcdefgh-and-more') }),
    );

    expect(redisCache.get).toHaveBeenNthCalledWith(
      1,
      'ratelimit:user:abcdefgh',
    );
    expect(redisCache.get).toHaveBeenNthCalledWith(
      2,
      'ratelimit:user:abcdefgh',
    );
  });

  it('ignores an authorization header that is not a bearer token', async () => {
    const plugin = hooks();
    await onRequest(
      plugin,
      request({ authorization: 'Basic abc', 'x-real-ip': '198.51.100.4' }),
    );

    expect(redisCache.get).toHaveBeenCalledWith('ratelimit:ip:198.51.100.4');
  });

  it('takes the client IP from the first x-forwarded-for entry', async () => {
    const plugin = hooks();
    await onRequest(
      plugin,
      request({ 'x-forwarded-for': ' 203.0.113.7 , 70.41.3.18 ' }),
    );

    expect(redisCache.get).toHaveBeenCalledWith('ratelimit:ip:203.0.113.7');
  });

  it('falls back to x-real-ip when there is no forwarded chain', async () => {
    const plugin = hooks();
    await onRequest(plugin, request({ 'x-real-ip': '198.51.100.4' }));

    expect(redisCache.get).toHaveBeenCalledWith('ratelimit:ip:198.51.100.4');
  });

  it('buckets a request with no identifying header under unknown', async () => {
    const plugin = hooks();
    await onRequest(plugin, request());

    expect(redisCache.get).toHaveBeenCalledWith('ratelimit:ip:unknown');
  });

  it('keeps two callers in separate buckets', async () => {
    const plugin = hooks();
    await onRequest(plugin, request({ 'x-real-ip': '198.51.100.4' }));
    await onRequest(plugin, request({ 'x-real-ip': '203.0.113.7' }));

    expect(redisCache.get).toHaveBeenNthCalledWith(
      1,
      'ratelimit:ip:198.51.100.4',
    );
    expect(redisCache.get).toHaveBeenNthCalledWith(
      2,
      'ratelimit:ip:203.0.113.7',
    );
  });

  it('honours a configured key prefix', async () => {
    const plugin = hooks({ keyPrefix: 'subscriptions' });
    await onRequest(plugin, request({ 'x-real-ip': '198.51.100.4' }));

    expect(redisCache.get).toHaveBeenCalledWith(
      'subscriptions:ip:198.51.100.4',
    );
  });
});

describe('counting', () => {
  it('opens the window with a TTL on the first request', async () => {
    const plugin = hooks({ windowMs: 60_000 });
    await onRequest(plugin, request({ 'x-real-ip': '198.51.100.4' }));

    expect(redisCache.setex).toHaveBeenCalledWith(
      'ratelimit:ip:198.51.100.4',
      60,
      '1',
    );
    expect(redisCache.incr).not.toHaveBeenCalled();
  });

  it('increments without resetting the window afterwards', async () => {
    redisCache.get.mockResolvedValue('4');
    const plugin = hooks();
    await onRequest(plugin, request({ 'x-real-ip': '198.51.100.4' }));

    expect(redisCache.incr).toHaveBeenCalledWith('ratelimit:ip:198.51.100.4');
    expect(redisCache.setex).not.toHaveBeenCalled();
  });

  it('rounds a sub-second window up to one second of TTL', async () => {
    const plugin = hooks({ windowMs: 1_500 });
    await onRequest(plugin, request({ 'x-real-ip': '198.51.100.4' }));

    expect(redisCache.setex).toHaveBeenCalledWith(
      expect.any(String),
      2,
      expect.any(String),
    );
  });

  it('lets the last request of the window through', async () => {
    redisCache.get.mockResolvedValue('99');
    const plugin = hooks({ max: 100 });

    const ended = await onRequest(
      plugin,
      request({ 'x-real-ip': '198.51.100.4' }),
    );

    expect(ended).toBeNull();
    expect(redisCache.incr).toHaveBeenCalled();
  });
});

describe('over the limit', () => {
  const overLimit = async (config?: { max?: number; windowMs?: number }) => {
    redisCache.get.mockResolvedValue('100');
    const plugin = hooks(config);
    const req = request({ 'x-real-ip': '198.51.100.4' });
    const ended = await onRequest(plugin, req);
    return { ended: ended as Response | null, req };
  };

  it('answers 429 instead of running the query', async () => {
    const { ended } = await overLimit();

    expect(ended?.status).toBe(429);
  });

  it('does not count the rejected request', async () => {
    await overLimit();

    expect(redisCache.incr).not.toHaveBeenCalled();
    expect(redisCache.setex).not.toHaveBeenCalled();
  });

  it('tells the caller when to retry, from the key TTL', async () => {
    redisCache.ttl.mockResolvedValue(45);
    const { ended } = await overLimit();

    expect(ended?.headers.get('Retry-After')).toBe('45');
    expect(ended?.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(ended?.headers.get('X-RateLimit-Limit')).toBe('100');
  });

  it('falls back to the window length when the key has no TTL', async () => {
    redisCache.ttl.mockResolvedValue(0);
    const { ended } = await overLimit({ max: 100, windowMs: 60_000 });

    expect(ended?.headers.get('Retry-After')).toBe('60');
  });

  it('returns a GraphQL error body a client can read', async () => {
    const { ended } = await overLimit();
    const body = await ended!.json();

    expect(ended?.headers.get('Content-Type')).toBe('application/json');
    expect(body.errors[0]).toMatchObject({
      message: 'Rate limit exceeded. Try again in 45 seconds.',
      extensions: {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 45,
        limit: 100,
        windowMs: 60_000,
      },
    });
  });

  it('logs the rejection', async () => {
    await overLimit();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ip:198.51.100.4'),
    );
  });

  it('applies a configured max rather than the default 100', async () => {
    redisCache.get.mockResolvedValue('5');
    const plugin = hooks({ max: 5 });

    const ended = await onRequest(
      plugin,
      request({ 'x-real-ip': '198.51.100.4' }),
    );

    expect(ended?.status).toBe(429);
    expect(ended?.headers.get('X-RateLimit-Limit')).toBe('5');
  });
});

describe('failing open', () => {
  it('lets the request through when Redis is unreachable', async () => {
    redisCache.get.mockRejectedValue(new Error('ECONNREFUSED'));
    const plugin = hooks();

    const ended = await onRequest(
      plugin,
      request({ 'x-real-ip': '198.51.100.4' }),
    );

    expect(ended).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('adds no rate limit headers when the count never resolved', async () => {
    redisCache.get.mockRejectedValue(new Error('ECONNREFUSED'));
    const plugin = hooks();
    const req = request({ 'x-real-ip': '198.51.100.4' });
    await onRequest(plugin, req);

    const response = new Response('{}');
    await plugin.onResponse({ request: req, response });

    expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
  });
});

describe('response headers', () => {
  it('reports the budget left after this request', async () => {
    redisCache.get.mockResolvedValue('4');
    const plugin = hooks({ max: 10 });
    const req = request({ 'x-real-ip': '198.51.100.4' });
    await onRequest(plugin, req);

    const response = new Response('{}');
    await plugin.onResponse({ request: req, response });

    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('5');
  });

  it('reports zero remaining on the last request of the window', async () => {
    redisCache.get.mockResolvedValue('9');
    const plugin = hooks({ max: 10 });
    const req = request({ 'x-real-ip': '198.51.100.4' });
    await onRequest(plugin, req);

    const response = new Response('{}');
    await plugin.onResponse({ request: req, response });

    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('dates the reset from the key TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T08:00:00.000Z'));
    redisCache.ttl.mockResolvedValue(30);

    const plugin = hooks();
    const req = request({ 'x-real-ip': '198.51.100.4' });
    await onRequest(plugin, req);

    const response = new Response('{}');
    await plugin.onResponse({ request: req, response });

    expect(response.headers.get('X-RateLimit-Reset')).toBe(
      String(Date.parse('2026-09-04T08:00:30.000Z')),
    );
    vi.useRealTimers();
  });

  it('leaves a response alone when onRequest never ran', async () => {
    const plugin = hooks();
    const response = new Response('{}');

    await plugin.onResponse({ request: request(), response });

    expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
  });
});
