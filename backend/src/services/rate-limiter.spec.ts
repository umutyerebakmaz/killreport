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

/** A task that stays in flight until the test releases it. */
function pending() {
  let release!: (value: string) => void;
  const promise = new Promise<string>((resolve) => (release = resolve));
  const fn = vi.fn(() => promise);
  return { fn, release };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock('@config/config');
});

describe('esiRateLimiter.execute', () => {
  it('runs the task and resolves with its value', async () => {
    const limiter = await limiterAt(50);

    const result = limiter.execute(async () => 'ok');
    await vi.advanceTimersByTimeAsync(0);

    await expect(result).resolves.toBe('ok');
  });

  it('propagates a rejection and keeps serving later tasks', async () => {
    const limiter = await limiterAt(50);
    const failure = new Error('ESI 500');

    const first = limiter.execute(async () => {
      throw failure;
    });
    const second = limiter.execute(async () => 'still alive');
    // Attach the handler before time moves, or the rejection is unhandled.
    const firstSettled = expect(first).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(20);

    await firstSettled;
    await expect(second).resolves.toBe('still alive');
  });

  it('dispatches the first task synchronously and the rest 1000/rps ms apart', async () => {
    const limiter = await limiterAt(50); // 20 ms spacing
    const tasks = [pending(), pending(), pending()];

    for (const { fn } of tasks) void limiter.execute(fn);
    const calls = () => tasks.map(({ fn }) => fn.mock.calls.length);

    expect(calls()).toEqual([1, 0, 0]);
    await vi.advanceTimersByTimeAsync(19);
    expect(calls()).toEqual([1, 0, 0]);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls()).toEqual([1, 1, 0]);
    await vi.advanceTimersByTimeAsync(20);
    expect(calls()).toEqual([1, 1, 1]);
  });

  it('does not wait for a slow task to finish before dispatching the next one', async () => {
    const limiter = await limiterAt(50);
    const slow = pending();
    const next = pending();

    void limiter.execute(slow.fn);
    void limiter.execute(next.fn);
    await vi.advanceTimersByTimeAsync(20);

    expect(slow.fn).toHaveBeenCalledTimes(1);
    expect(next.fn).toHaveBeenCalledTimes(1);
  });

  it('holds the per-second ceiling until the window rolls over', async () => {
    // 3/sec => 333 ms spacing, so the third dispatch lands at 666 ms and the
    // fourth would fall at 999 ms, one ms inside the window. The ceiling has to
    // push it to 1000 ms.
    const limiter = await limiterAt(3);
    const tasks = Array.from({ length: 7 }, pending);
    for (const { fn } of tasks) void limiter.execute(fn);
    const dispatched = () =>
      tasks.filter(({ fn }) => fn.mock.calls.length > 0).length;

    await vi.advanceTimersByTimeAsync(999);
    expect(dispatched()).toBe(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatched()).toBe(4);
    await vi.advanceTimersByTimeAsync(999);
    expect(dispatched()).toBe(6);
    await vi.advanceTimersByTimeAsync(1);
    expect(dispatched()).toBe(7);
  });

  it('caps in-flight tasks at 50 and resumes when one settles', async () => {
    const limiter = await limiterAt(50);
    const tasks = Array.from({ length: 51 }, pending);
    for (const { fn } of tasks) void limiter.execute(fn);
    const dispatched = () =>
      tasks.filter(({ fn }) => fn.mock.calls.length > 0).length;

    await vi.advanceTimersByTimeAsync(3000);
    expect(dispatched()).toBe(50);

    tasks[0].release('done');
    await vi.advanceTimersByTimeAsync(20);
    expect(dispatched()).toBe(51);
  });

  it('raises the in-flight cap with the rate so it never becomes the ceiling', async () => {
    const limiter = await limiterAt(150); // 6 ms spacing, cap 150
    const tasks = Array.from({ length: 151 }, pending);
    for (const { fn } of tasks) void limiter.execute(fn);
    const dispatched = () =>
      tasks.filter(({ fn }) => fn.mock.calls.length > 0).length;

    await vi.advanceTimersByTimeAsync(3000);
    expect(dispatched()).toBe(150);
  });
});

describe('esiRateLimiter.getStats', () => {
  it('reports the queue depth, the current and configured rate and the brake', async () => {
    const limiter = await limiterAt(50);
    for (let i = 0; i < 3; i++) void limiter.execute(pending().fn);

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
    const tasks = Array.from({ length: 50 }, pending);
    for (const { fn } of tasks) void limiter.execute(fn);
    await vi.advanceTimersByTimeAsync(3000);

    // The in-flight cap is full, so an acquire waits for a release.
    const next = limiter.acquire(route);
    expect(await settledAfter(next, 1000)).toBe(false);
    tasks[0].release('done');
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
    expect(await settledAfter(limiter.acquire(route), 0)).toBe(true);
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
    const tasks = Array.from({ length: 4 }, pending);
    for (const { fn } of tasks) void limiter.execute(fn);
    const dispatched = () =>
      tasks.filter(({ fn }) => fn.mock.calls.length > 0).length;

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
    const tasks = Array.from({ length: 50 }, pending);
    for (const { fn } of tasks) void limiter.execute(fn);
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
    tasks[0].release('done');
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
