import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/logger', () => ({ default: logger }));

/**
 * The module builds a singleton from config at import time, so every test gets
 * its own copy: mock the config, drop the module cache, import again.
 */
async function limiterAt(maxRequestsPerSecond: number) {
  vi.doMock('@config/config', () => ({
    config: { esi: { maxRequestsPerSecond, prefetch: 100 } },
  }));
  vi.resetModules();
  const { esiRateLimiter } = await import('./rate-limiter.js');
  return esiRateLimiter;
}

const route = { path: '/characters/365974960/' };

/** Whether a promise has settled after `ms` of fake time. */
async function settledAfter(promise: Promise<unknown>, ms: number) {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  await vi.advanceTimersByTimeAsync(ms);
  return settled;
}

/** A slot that stays held until the test releases it. */
function occupy(limiter: Awaited<ReturnType<typeof limiterAt>>) {
  let granted = false;
  void limiter.acquire(route).then(() => (granted = true));
  return {
    isGranted: () => granted,
    release: () => limiter.release(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock('@config/config');
});

describe('esiRateLimiter dispatch', () => {
  const grantedCount = (slots: ReturnType<typeof occupy>[]) =>
    slots.filter((slot) => slot.isGranted()).length;

  it('grants the first slot at once and the rest 1000/rps ms apart', async () => {
    const limiter = await limiterAt(50); // 20 ms spacing
    const slots = Array.from({ length: 3 }, () => occupy(limiter));

    await vi.advanceTimersByTimeAsync(0);
    expect(grantedCount(slots)).toBe(1);
    await vi.advanceTimersByTimeAsync(19);
    expect(grantedCount(slots)).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(grantedCount(slots)).toBe(2);
    await vi.advanceTimersByTimeAsync(20);
    expect(grantedCount(slots)).toBe(3);
  });

  it('holds the per-second ceiling until the window rolls over', async () => {
    // 3/sec => 333 ms spacing, so the fourth would fall at 999 ms, one ms
    // inside the window. The ceiling has to push it to 1000 ms.
    const limiter = await limiterAt(3);
    const slots = Array.from({ length: 4 }, () => occupy(limiter));

    await vi.advanceTimersByTimeAsync(999);
    expect(grantedCount(slots)).toBe(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(grantedCount(slots)).toBe(4);
  });

  it('raises the in-flight cap with the rate so it never becomes the ceiling', async () => {
    const limiter = await limiterAt(150); // 6 ms spacing, cap 150
    const slots = Array.from({ length: 151 }, () => occupy(limiter));

    await vi.advanceTimersByTimeAsync(3000);
    expect(grantedCount(slots)).toBe(150);
    slots[0].release();
    await vi.advanceTimersByTimeAsync(6);
    expect(grantedCount(slots)).toBe(151);
  });
});

describe('esiRateLimiter.getStats', () => {
  it('reports the queue depth, the current and configured rate and the brake', async () => {
    const limiter = await limiterAt(50);
    for (let i = 0; i < 3; i++) occupy(limiter);

    expect(limiter.getStats()).toEqual({
      queueLength: 2,
      currentRate: 50,
      pausedUntil: 0,
      maxRequestsPerSecond: 50,
    });

    await vi.advanceTimersByTimeAsync(40);
    expect(limiter.getStats()).toMatchObject({ queueLength: 0 });
  });
});

describe('esiRateLimiter.acquire', () => {
  it('grants a slot that is held until release', async () => {
    const limiter = await limiterAt(50);
    const tasks = Array.from({ length: 50 }, () => occupy(limiter));
    await vi.advanceTimersByTimeAsync(3000);

    // The in-flight cap is full, so an acquire waits for a release.
    const next = limiter.acquire(route);
    expect(await settledAfter(next, 1000)).toBe(false);
    tasks[0].release();
    expect(await settledAfter(next, 20)).toBe(true);
  });
});

describe('esiRateLimiter brake', () => {
  it('a 420 holds every acquire until X-ESI-Error-Limit-Reset elapses', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 420, { 'x-esi-error-limit-reset': '30' });

    const next = limiter.acquire(route);
    expect(await settledAfter(next, 29_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
  });

  it('a 420 without a reset header pauses 60 s', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 420, {});

    const next = limiter.acquire(route);
    expect(await settledAfter(next, 59_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
  });

  it('error-limit-remain 19 pauses for the reset; 20 does not', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 200, {
      'x-esi-error-limit-remain': '20',
      'x-esi-error-limit-reset': '30',
    });
    expect(await settledAfter(limiter.acquire(route), 0)).toBe(true);

    limiter.observe(route, 404, {
      'x-esi-error-limit-remain': '19',
      'x-esi-error-limit-reset': '30',
    });
    const next = limiter.acquire(route);
    expect(await settledAfter(next, 29_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
  });

  it('a blank error-limit-remain is no value, so it never brakes', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 200, {
      'x-esi-error-limit-remain': '',
      'x-esi-error-limit-reset': '30',
    });

    expect(await settledAfter(limiter.acquire(route), 0)).toBe(true);
  });

  it('error-limit-reset 0 or negative never pauses', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 200, {
      'x-esi-error-limit-remain': '5',
      'x-esi-error-limit-reset': '0',
    });
    limiter.observe(route, 420, { 'x-esi-error-limit-reset': '-3' });

    expect(limiter.getStats().pausedUntil).toBeLessThanOrEqual(Date.now());
    expect(await settledAfter(limiter.acquire(route), 0)).toBe(true);
  });

  it('a header-less 429 pauses for Retry-After, 60 s if missing or not a number', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 429, { 'retry-after': '5' });
    const first = limiter.acquire(route);
    expect(await settledAfter(first, 4_999)).toBe(false);
    expect(await settledAfter(first, 1)).toBe(true);

    limiter.observe(route, 429, { 'retry-after': 'abc' });
    const second = limiter.acquire(route);
    expect(await settledAfter(second, 59_999)).toBe(false);
    expect(await settledAfter(second, 1)).toBe(true);

    limiter.observe(route, 429, {});
    const third = limiter.acquire(route);
    expect(await settledAfter(third, 59_999)).toBe(false);
    expect(await settledAfter(third, 1)).toBe(true);
  });

  it('caps any pause at 15 minutes', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 420, { 'x-esi-error-limit-reset': '99999' });

    const next = limiter.acquire(route);
    expect(await settledAfter(next, 899_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
  });

  it('a shorter pause never shortens a longer one already in force', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 420, { 'x-esi-error-limit-reset': '60' });
    limiter.observe(route, 429, { 'retry-after': '5' });

    const next = limiter.acquire(route);
    expect(await settledAfter(next, 59_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
  });

  it('a 429 that carries x-ratelimit-group does not set the process brake', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 429, {
      'x-ratelimit-group': 'killmail',
      'retry-after': '30',
    });

    expect(limiter.getStats()).toMatchObject({
      pausedUntil: 0,
      currentRate: 50,
    });
    // The 429 taught the limiter that this route is in 'killmail'; any other
    // route is still free to go.
    const other = { path: '/universe/types/587/' };
    expect(await settledAfter(limiter.acquire(other), 0)).toBe(true);
  });

  it('logs a pause once, not once per throttled response', async () => {
    const limiter = await limiterAt(50);
    for (let i = 0; i < 25; i++) limiter.observe(route, 429, {});

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/429.*60 s/);
  });
});

describe('esiRateLimiter adaptive rate', () => {
  it('a header-less 429 halves the rate', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 429, {});

    expect(limiter.getStats().currentRate).toBe(25);
  });

  it('never goes below 1 req/s', async () => {
    const limiter = await limiterAt(50);
    // 10 s apart, so each 429 is a new event rather than an echo.
    for (let i = 0; i < 8; i++) {
      limiter.observe(route, 429, { 'retry-after': '1' });
      await vi.advanceTimersByTimeAsync(10_000);
    }

    expect(limiter.getStats().currentRate).toBe(1);
  });

  it('429s that arrive while a pause is in force halve only once', async () => {
    const limiter = await limiterAt(50);
    for (let i = 0; i < 25; i++) limiter.observe(route, 429, {});

    expect(limiter.getStats().currentRate).toBe(25);
  });

  it('429s within 10 s of a halving halve only once, even with no brake', async () => {
    const limiter = await limiterAt(50);
    for (let i = 0; i < 25; i++) {
      limiter.observe(route, 429, { 'retry-after': '0' });
      await vi.advanceTimersByTimeAsync(300);
    }

    expect(limiter.getStats().currentRate).toBe(25);
  });

  it('climbs +1 req/s per 10 s once requests resume, up to ESI_MAX_RPS', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 429, {}); // 60 s brake

    await vi.advanceTimersByTimeAsync(60_000);
    expect(limiter.getStats().currentRate).toBe(25);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(limiter.getStats().currentRate).toBe(25);
    await vi.advanceTimersByTimeAsync(1);
    expect(limiter.getStats().currentRate).toBe(26);
    await vi.advanceTimersByTimeAsync(240_000);
    expect(limiter.getStats().currentRate).toBe(50);
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(limiter.getStats().currentRate).toBe(50);
  });

  it('dispatches at the lowered rate', async () => {
    const limiter = await limiterAt(4); // 250 ms spacing
    limiter.observe(route, 429, { 'retry-after': '1' }); // rate 2
    await vi.advanceTimersByTimeAsync(1000);
    const tasks = Array.from({ length: 4 }, () => occupy(limiter));
    const dispatched = () => tasks.filter((t) => t.isGranted()).length;

    await vi.advanceTimersByTimeAsync(999);
    expect(dispatched()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatched()).toBe(3);
  });
});

describe('esiRateLimiter maxWaitMs', () => {
  it('rejects with EsiThrottledError when the brake outlasts maxWaitMs', async () => {
    const limiter = await limiterAt(50);
    const { EsiThrottledError } = await import('./rate-limiter.js');

    limiter.observe(route, 429, {});
    const deep = limiter.acquire(route, { maxWaitMs: 10_000 });
    await expect(deep).rejects.toBeInstanceOf(EsiThrottledError);
    await expect(deep).rejects.toMatchObject({
      status: 429,
      kind: 'deep-limit',
      response: { status: 429 },
    });

    limiter.observe(route, 420, { 'x-esi-error-limit-reset': '120' });
    await expect(
      limiter.acquire(route, { maxWaitMs: 10_000 }),
    ).rejects.toMatchObject({
      status: 420,
      kind: 'error-limit',
      response: { status: 420 },
    });
  });

  it('rejects a queued acquire when a brake set after it outlasts its maxWaitMs', async () => {
    const limiter = await limiterAt(50);
    const { EsiThrottledError } = await import('./rate-limiter.js');
    const tasks = Array.from({ length: 50 }, () => occupy(limiter));
    await vi.advanceTimersByTimeAsync(3000);

    // Both wait behind the full in-flight cap when the brake starts.
    const bounded = limiter.acquire(route, { maxWaitMs: 10_000 });
    const unbounded = limiter.acquire(route);
    const boundedSettled =
      expect(bounded).rejects.toBeInstanceOf(EsiThrottledError);
    limiter.observe(route, 429, {}); // 60 s brake

    await boundedSettled;
    await expect(bounded).rejects.toMatchObject({
      status: 429,
      kind: 'deep-limit',
    });
    tasks[0].release();
    expect(await settledAfter(unbounded, 59_999)).toBe(false);
    expect(await settledAfter(unbounded, 1)).toBe(true);
  });

  it('waits when the brake ends within maxWaitMs', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 429, { 'retry-after': '5' });

    const next = limiter.acquire(route, { maxWaitMs: 10_000 });
    expect(await settledAfter(next, 4_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
    await expect(next).resolves.toBeUndefined();
  });

  it('without maxWaitMs waits out the whole brake', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(route, 420, { 'x-esi-error-limit-reset': '600' });

    const next = limiter.acquire(route);
    expect(await settledAfter(next, 599_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
    await expect(next).resolves.toBeUndefined();
  });
});

const HASH = '0a1b2c3d4e5f60718293a4b5c6d7e8f901234567';
const killmail = { path: `/killmails/123/${HASH}/` };
const status = { path: '/status/' };

/** Headers of a response from a grouped route. */
function grouped(group: string, limit: string, remaining: number | string) {
  return {
    'x-ratelimit-group': group,
    'x-ratelimit-limit': limit,
    'x-ratelimit-remaining': String(remaining),
  };
}

describe('routeTemplate', () => {
  it('maps ids and the killmail hash', async () => {
    const { routeTemplate } = await import('./rate-limiter.js');
    expect(routeTemplate(`/killmails/123/${HASH}/`)).toBe(
      '/killmails/{id}/{hash}/',
    );
  });

  it('drops the query string', async () => {
    const { routeTemplate } = await import('./rate-limiter.js');
    expect(routeTemplate('/characters/9/killmails/recent/?page=3')).toBe(
      '/characters/{id}/killmails/recent/',
    );
  });

  it('keeps a path without a trailing slash as it is', async () => {
    const { routeTemplate } = await import('./rate-limiter.js');
    expect(routeTemplate('/sovereignty/map')).toBe('/sovereignty/map');
  });
});

describe('esiRateLimiter group buckets', () => {
  it('above 20% remaining, a grouped route is not spaced', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(killmail, 200, grouped('killmail', '3600/15m', 720));

    const first = limiter.acquire(killmail);
    const second = limiter.acquire(killmail);
    expect(await settledAfter(first, 0)).toBe(true);
    // Only the base 20 ms dispatch spacing applies.
    expect(await settledAfter(second, 20)).toBe(true);
  });

  it('below 20% remaining, spaces requests window / limit * 2 apart', async () => {
    const limiter = await limiterAt(50);
    // 900_000 / 3600 * 2 = 500 ms, the pace the bucket refills at
    limiter.observe(killmail, 200, grouped('killmail', '3600/15m', 600));

    const first = limiter.acquire(killmail);
    const second = limiter.acquire(killmail);
    expect(await settledAfter(first, 0)).toBe(true);
    expect(await settledAfter(second, 499)).toBe(false);
    expect(await settledAfter(second, 1)).toBe(true);
  });

  it('the gap does not grow as the remaining tokens shrink', async () => {
    for (const remaining of [2, 3]) {
      const limiter = await limiterAt(50);
      limiter.observe(
        killmail,
        200,
        grouped('killmail', '3600/15m', remaining),
      );

      const first = limiter.acquire(killmail);
      const second = limiter.acquire(killmail);
      expect(await settledAfter(first, 0)).toBe(true);
      expect(await settledAfter(second, 499)).toBe(false);
      expect(await settledAfter(second, 1)).toBe(true);
    }
  });

  it('spaces char-killmail 60 s apart below 20% remaining', async () => {
    const limiter = await limiterAt(50);
    const recent = { path: '/characters/9/killmails/recent/', bucketKey: '9' };
    // 900_000 / 30 * 2 = 60_000 ms
    limiter.observe(recent, 200, grouped('char-killmail', '30/15m', 5));

    const first = limiter.acquire(recent);
    const second = limiter.acquire(recent);
    expect(await settledAfter(first, 0)).toBe(true);
    expect(await settledAfter(second, 59_999)).toBe(false);
    expect(await settledAfter(second, 1)).toBe(true);
  });

  it('remaining below 2 holds the request until a token is due back', async () => {
    const limiter = await limiterAt(50);
    // window / limit * 2 = 900_000 / 3600 * 2 = 500 ms
    limiter.observe(killmail, 200, grouped('killmail', '3600/15m', 1));

    const next = limiter.acquire(killmail);
    expect(await settledAfter(next, 0)).toBe(false);
    expect(await settledAfter(next, 499)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
  });

  it('a grouped 429 pauses only that group for Retry-After', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(status, 200, grouped('status', '600/15m', 600));
    limiter.observe(killmail, 429, {
      ...grouped('killmail', '3600/15m', 0),
      'retry-after': '30',
    });

    // Queued first, yet it does not hold up the two behind it.
    const paused = limiter.acquire(killmail);
    const otherGroup = limiter.acquire(status);
    const ungrouped = limiter.acquire(route);
    expect(await settledAfter(otherGroup, 20)).toBe(true);
    expect(await settledAfter(ungrouped, 20)).toBe(true);
    expect(await settledAfter(paused, 29_959)).toBe(false);
    expect(await settledAfter(paused, 1)).toBe(true);
    expect(limiter.getStats()).toMatchObject({
      pausedUntil: 0,
      currentRate: 50,
    });
  });

  it('a grouped 429 without Retry-After pauses the group 60 s, capped at 15 min', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(killmail, 429, { 'x-ratelimit-group': 'killmail' });
    const first = limiter.acquire(killmail);
    expect(await settledAfter(first, 59_999)).toBe(false);
    expect(await settledAfter(first, 1)).toBe(true);

    limiter.observe(killmail, 429, {
      'x-ratelimit-group': 'killmail',
      'retry-after': '99999',
    });
    const second = limiter.acquire(killmail);
    expect(await settledAfter(second, 899_999)).toBe(false);
    expect(await settledAfter(second, 1)).toBe(true);
  });

  it('a shorter group pause never shortens a longer one', async () => {
    const limiter = await limiterAt(50);
    const header = { 'x-ratelimit-group': 'killmail' };
    limiter.observe(killmail, 429, { ...header, 'retry-after': '60' });
    limiter.observe(killmail, 429, { ...header, 'retry-after': '5' });

    const next = limiter.acquire(killmail);
    expect(await settledAfter(next, 59_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
  });

  it('logs a group pause once, naming the group', async () => {
    const limiter = await limiterAt(50);
    for (let i = 0; i < 10; i++) {
      limiter.observe(killmail, 429, {
        'x-ratelimit-group': 'killmail',
        'retry-after': '30',
      });
    }

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/429.*killmail.*30 s/);
  });

  it('a fresh response replaces the remembered remaining', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(killmail, 200, grouped('killmail', '3600/15m', 0));
    const held = limiter.acquire(killmail);
    expect(await settledAfter(held, 100)).toBe(false);

    limiter.observe(killmail, 200, grouped('killmail', '3600/15m', 3000));
    expect(await settledAfter(held, 0)).toBe(true);
    expect(await settledAfter(limiter.acquire(killmail), 20)).toBe(true);
  });

  it('separates buckets by bucketKey', async () => {
    const limiter = await limiterAt(50);
    const recent = '/characters/365974960/killmails/recent/';
    limiter.observe(
      { path: recent, bucketKey: '1' },
      200,
      grouped('char-killmail', '30/15m', 0),
    );

    const one = limiter.acquire({ path: recent, bucketKey: '1' });
    const two = limiter.acquire({ path: recent, bucketKey: '2' });
    expect(await settledAfter(two, 20)).toBe(true);
    expect(await settledAfter(one, 0)).toBe(false);
  });

  it('an unseen route template is not spaced', async () => {
    const limiter = await limiterAt(50);
    limiter.observe(killmail, 200, grouped('killmail', '3600/15m', 0));

    const other = { path: '/characters/9/killmails/recent/' };
    expect(await settledAfter(limiter.acquire(other), 0)).toBe(true);
  });

  it('parses limits in hours as well as minutes', async () => {
    const limiter = await limiterAt(50);
    // window 3_600_000 → 3_600_000 / 150 * 2 = 48_000 ms
    limiter.observe(status, 200, grouped('status', '150/1h', 0));

    const next = limiter.acquire(status);
    expect(await settledAfter(next, 47_999)).toBe(false);
    expect(await settledAfter(next, 1)).toBe(true);
  });

  it('rejects at once when the group wait outlasts maxWaitMs', async () => {
    const limiter = await limiterAt(50);
    const { EsiThrottledError } = await import('./rate-limiter.js');
    limiter.observe(killmail, 429, {
      'x-ratelimit-group': 'killmail',
      'retry-after': '30',
    });

    const bounded = limiter.acquire(killmail, { maxWaitMs: 10_000 });
    await expect(bounded).rejects.toBeInstanceOf(EsiThrottledError);
    await expect(bounded).rejects.toMatchObject({
      status: 429,
      kind: 'rate-limit',
      response: { status: 429 },
    });
    const within = limiter.acquire(killmail, { maxWaitMs: 40_000 });
    expect(await settledAfter(within, 30_000)).toBe(true);
    await expect(within).resolves.toBeUndefined();
  });

  it('rejects a waiting acquire when a group pause set after it outlasts maxWaitMs', async () => {
    const limiter = await limiterAt(50);
    const { EsiThrottledError } = await import('./rate-limiter.js');
    limiter.observe(killmail, 200, grouped('killmail', '3600/15m', 1));

    // Held 500 ms for a token when the 429 arrives.
    const bounded = limiter.acquire(killmail, { maxWaitMs: 10_000 });
    const unbounded = limiter.acquire(killmail);
    const boundedSettled =
      expect(bounded).rejects.toBeInstanceOf(EsiThrottledError);
    await vi.advanceTimersByTimeAsync(100);
    limiter.observe(killmail, 429, {
      'x-ratelimit-group': 'killmail',
      'retry-after': '60',
    });

    await boundedSettled;
    await expect(bounded).rejects.toMatchObject({ kind: 'rate-limit' });
    expect(await settledAfter(unbounded, 59_999)).toBe(false);
    expect(await settledAfter(unbounded, 1)).toBe(true);
  });
});
