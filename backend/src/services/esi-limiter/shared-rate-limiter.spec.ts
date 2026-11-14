import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RateLimiter } from '@services/rate-limiter';
import { EsiThrottledError } from '@services/rate-limiter';
import type {
  AcquireResult,
  EsiPriority,
  ObserveInput,
  ObserveResult,
} from './shared-store';

const { logger } = vi.hoisted(() => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@services/logger', () => ({ default: logger }));
// The module builds esiLimiter from config at import time, and the real config
// exits the process when EVE_CLIENT_ID is unset, as it is in CI.
vi.mock('@config/config', () => ({
  config: {
    esi: { maxRequestsPerSecond: 50, prefetch: 25 },
    redis: { url: 'redis://localhost:6379' },
  },
}));

import {
  LOG_REDIS_BACK,
  LOG_REDIS_UNREACHABLE,
  SharedRateLimiter,
} from './shared-rate-limiter';

const route = { path: '/characters/365974960/' };
const other = { path: '/universe/types/34/' };

type AcquireFn = (
  priority: EsiPriority,
  template: string,
  bucketKey: string,
) => Promise<AcquireResult>;
type ObserveFn = (input: ObserveInput) => Promise<ObserveResult>;

function fakeStore(acquire: AcquireFn, observe?: ObserveFn) {
  return {
    acquire: vi.fn(acquire),
    observe: vi.fn(observe ?? (async () => ({ rate: 50 }))),
  };
}

function fakeLocal() {
  return {
    acquire: vi.fn(async () => {}),
    observe: vi.fn(),
    release: vi.fn(),
  };
}

function limiterWith(store: ReturnType<typeof fakeStore>, local = fakeLocal()) {
  return {
    limiter: new SharedRateLimiter(store, local as unknown as RateLimiter),
    local,
  };
}

const granted = async (): Promise<AcquireResult> => ({ granted: true });

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

const warnedWith = (text: string) =>
  logger.warn.mock.calls.filter(([msg]) => String(msg).includes(text)).length;
const infoWith = (text: string) =>
  logger.info.mock.calls.filter(([msg]) => String(msg).includes(text)).length;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SharedRateLimiter acquire', () => {
  it('asks the store again after a rate wait and resolves once granted', async () => {
    const replies: AcquireResult[] = [
      { granted: false, reason: 'rate', waitMs: 50, detail: '' },
      { granted: true },
    ];
    const store = fakeStore(async () => replies.shift()!);
    const { limiter } = limiterWith(store);

    const acquired = limiter.acquire(route);
    expect(await settledAfter(acquired, 10)).toBe(false);
    expect(store.acquire).toHaveBeenCalledTimes(1);

    // 50 ms wait plus at most 50 ms jitter.
    expect(await settledAfter(acquired, 100)).toBe(true);
    expect(store.acquire).toHaveBeenCalledTimes(2);
    expect(store.acquire).toHaveBeenLastCalledWith(
      'bulk',
      '/characters/{id}/',
      '',
    );
  });

  it('rejects at once when the brake outlasts maxWaitMs', async () => {
    const store = fakeStore(async () => ({
      granted: false,
      reason: 'brake',
      waitMs: 30_000,
      detail: '420:error-limit',
    }));
    const { limiter } = limiterWith(store);

    const err = limiter.acquire(route, { maxWaitMs: 10_000 }).catch((e) => e);
    expect(await settledAfter(err, 0)).toBe(true);
    const thrown = await err;
    expect(thrown).toBeInstanceOf(EsiThrottledError);
    expect(thrown.status).toBe(420);
    expect(thrown.kind).toBe('error-limit');
    expect(store.acquire).toHaveBeenCalledTimes(1);
  });

  it('waits out a brake shorter than maxWaitMs', async () => {
    const replies: AcquireResult[] = [
      { granted: false, reason: 'brake', waitMs: 500, detail: '420:x' },
      { granted: true },
    ];
    const store = fakeStore(async () => replies.shift()!);
    const { limiter } = limiterWith(store);

    const acquired = limiter.acquire(route, { maxWaitMs: 10_000 });
    expect(await settledAfter(acquired, 400)).toBe(false);
    expect(await settledAfter(acquired, 200)).toBe(true);
  });

  it('caps one sleep at 1 s so a brake set elsewhere is seen again soon', async () => {
    const store = fakeStore(async () => ({
      granted: false,
      reason: 'brake',
      waitMs: 60_000,
      detail: '420:error-limit',
    }));
    const { limiter } = limiterWith(store);

    void limiter.acquire(route);
    await vi.advanceTimersByTimeAsync(1100);
    expect(store.acquire).toHaveBeenCalledTimes(2);
  });

  it('parks a route waiting on its group so another route goes at once', async () => {
    const store = fakeStore(async (_priority, template) =>
      template === '/characters/{id}/'
        ? {
            granted: false,
            reason: 'group',
            waitMs: 5_000,
            detail: 'char-detail:',
          }
        : { granted: true },
    );
    const { limiter } = limiterWith(store);

    const grouped = limiter.acquire(route);
    const free = limiter.acquire(other);
    expect(await settledAfter(free, 0)).toBe(true);
    expect(await settledAfter(grouped, 1_000)).toBe(false);
  });

  it('asks again for a parked route when its group wait is over', async () => {
    const replies: AcquireResult[] = [
      {
        granted: false,
        reason: 'group',
        waitMs: 2_000,
        detail: 'char-detail:',
      },
      { granted: true },
    ];
    const store = fakeStore(async () => replies.shift()!);
    const { limiter } = limiterWith(store);

    const grouped = limiter.acquire(route);
    expect(await settledAfter(grouped, 1_900)).toBe(false);
    expect(await settledAfter(grouped, 200)).toBe(true);
    expect(store.acquire).toHaveBeenCalledTimes(2);
  });

  it('rejects a group wait longer than maxWaitMs as a rate-limit', async () => {
    const store = fakeStore(async () => ({
      granted: false,
      reason: 'group',
      waitMs: 30_000,
      detail: 'char-detail:',
    }));
    const { limiter } = limiterWith(store);

    const thrown = await limiter
      .acquire(route, { maxWaitMs: 10_000 })
      .catch((e) => e);
    expect(thrown).toBeInstanceOf(EsiThrottledError);
    expect(thrown.status).toBe(429);
    expect(thrown.kind).toBe('rate-limit');
  });

  it('asks with the process priority, bulk by default', async () => {
    const store = fakeStore(granted);
    const { limiter } = limiterWith(store);

    await limiter.acquire(route);
    expect(store.acquire).toHaveBeenLastCalledWith(
      'bulk',
      '/characters/{id}/',
      '',
    );

    limiter.setPriority('live');
    await limiter.acquire({ path: '/characters/9/', bucketKey: '9' });
    expect(store.acquire).toHaveBeenLastCalledWith(
      'live',
      '/characters/{id}/',
      '9',
    );
  });

  it('never holds more than max(50, maxRps) slots in flight', async () => {
    const store = fakeStore(granted);
    const { limiter } = limiterWith(store);

    let count = 0;
    for (let i = 0; i < 60; i++)
      void limiter.acquire(route).then(() => count++);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(count).toBe(50);

    limiter.release();
    limiter.release();
    await vi.advanceTimersByTimeAsync(100);
    expect(count).toBe(52);
  });
});

describe('SharedRateLimiter without Redis', () => {
  it('falls back to the local limiter when the store does not answer in 200 ms', async () => {
    const store = fakeStore(() => new Promise<AcquireResult>(() => {}));
    const { limiter, local } = limiterWith(store);

    const first = limiter.acquire(route, { maxWaitMs: 10_000 });
    expect(await settledAfter(first, 150)).toBe(false);
    expect(await settledAfter(first, 100)).toBe(true);
    expect(local.acquire).toHaveBeenCalledTimes(1);
    expect(limiter.isShared()).toBe(false);

    await limiter.acquire(other);
    expect(local.acquire).toHaveBeenCalledTimes(2);
    expect(warnedWith(LOG_REDIS_UNREACHABLE)).toBe(1);
  });

  it('falls back when the store fails, and releases through the local limiter', async () => {
    const store = fakeStore(async () => {
      throw new Error('Connection is closed.');
    });
    const { limiter, local } = limiterWith(store);

    await limiter.acquire(route);
    limiter.release();
    expect(local.release).toHaveBeenCalledTimes(1);
    expect(limiter.isShared()).toBe(false);
  });

  it('does not ask the store again for 10 s, then returns to shared mode once', async () => {
    let up = false;
    const store = fakeStore(async () => {
      if (!up) throw new Error('ECONNREFUSED');
      return { granted: true };
    });
    const { limiter, local } = limiterWith(store);

    await limiter.acquire(route);
    expect(store.acquire).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(9_000);
    await limiter.acquire(route);
    await limiter.observe(route, 200, {});
    expect(store.acquire).toHaveBeenCalledTimes(1);
    expect(store.observe).not.toHaveBeenCalled();
    expect(local.acquire).toHaveBeenCalledTimes(2);
    expect(local.observe).toHaveBeenCalledTimes(1);

    up = true;
    await vi.advanceTimersByTimeAsync(1_000);
    await limiter.acquire(route);
    expect(store.acquire).toHaveBeenCalledTimes(2);
    expect(limiter.isShared()).toBe(true);
    await limiter.acquire(route);
    expect(local.acquire).toHaveBeenCalledTimes(2);
    expect(infoWith(LOG_REDIS_BACK)).toBe(1);
    expect(warnedWith(LOG_REDIS_UNREACHABLE)).toBe(1);
  });

  it('a failed retry stays local, logs nothing new and waits another 10 s', async () => {
    const store = fakeStore(async () => {
      throw new Error('ECONNREFUSED');
    });
    const { limiter } = limiterWith(store);

    await limiter.acquire(route);
    await vi.advanceTimersByTimeAsync(10_000);
    await limiter.acquire(route);
    expect(store.acquire).toHaveBeenCalledTimes(2);
    await limiter.acquire(route);
    expect(store.acquire).toHaveBeenCalledTimes(2);
    expect(warnedWith(LOG_REDIS_UNREACHABLE)).toBe(1);
  });

  it('falls back to the local observe when the store observe fails', async () => {
    const store = fakeStore(granted, async () => {
      throw new Error('ECONNREFUSED');
    });
    const { limiter, local } = limiterWith(store);

    await limiter.observe(route, 200, { 'x-esi-error-limit-remain': '99' });
    expect(local.observe).toHaveBeenCalledWith(route, 200, {
      'x-esi-error-limit-remain': '99',
    });
    expect(limiter.isShared()).toBe(false);
  });
});

describe('SharedRateLimiter observe', () => {
  it('parses the headers into numbers for the store', async () => {
    const store = fakeStore(granted);
    const { limiter } = limiterWith(store);

    await limiter.observe({ path: '/characters/9/', bucketKey: '9' }, 429, {
      'x-ratelimit-group': 'char-detail',
      'x-ratelimit-limit': '150/15m',
      'x-ratelimit-remaining': '12',
      'x-esi-error-limit-remain': '',
      'x-esi-error-limit-reset': '30',
      'retry-after': '20',
    });
    expect(store.observe).toHaveBeenCalledTimes(1);
    const input = store.observe.mock.calls[0][0]!;
    expect(input).toEqual({
      template: '/characters/{id}/',
      bucketKey: '9',
      status: 429,
      group: 'char-detail',
      limit: 150,
      windowMs: 900_000,
      remaining: 12,
      errorResetMs: 30_000,
      retryAfterMs: 20_000,
    });
    expect('errorRemain' in input).toBe(false);
  });

  it('leaves out every header that is absent', async () => {
    const store = fakeStore(granted);
    const { limiter } = limiterWith(store);

    await limiter.observe(other, 200, { 'x-ratelimit-remaining': ' ' });
    expect(store.observe.mock.calls[0][0]).toEqual({
      template: '/universe/types/{id}/',
      bucketKey: '',
      status: 200,
    });
  });

  it('logs a brake this process set, and nothing without one', async () => {
    const results: ObserveResult[] = [
      { rate: 50 },
      { brake: { ms: 30_000, status: 420, kind: 'error-limit' }, rate: 50 },
    ];
    const store = fakeStore(granted, async () => results.shift()!);
    const { limiter } = limiterWith(store);

    await limiter.observe(route, 200, {});
    expect(logger.warn).not.toHaveBeenCalled();

    await limiter.observe(route, 420, {});
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain(
      '⏸️  ESI 420 (error-limit): pausing all requests for 30 s',
    );
  });

  it('logs a group pause this process set', async () => {
    const store = fakeStore(granted, async () => ({
      groupPause: { key: 'char-detail:9', ms: 20_000 },
      rate: 50,
    }));
    const { limiter } = limiterWith(store);

    await limiter.observe(route, 429, { 'x-ratelimit-group': 'char-detail' });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toBe(
      '⏸️  ESI 429 (rate-limit): pausing group char-detail:9 for 20 s',
    );
  });

  it('a brake it learns rejects waiters that cannot make their deadline', async () => {
    const store = fakeStore(
      async () => ({
        granted: false,
        reason: 'rate',
        waitMs: 900,
        detail: '',
      }),
      async () => ({
        brake: { ms: 30_000, status: 420, kind: 'error-limit' },
        rate: 50,
      }),
    );
    const { limiter } = limiterWith(store);

    const waiting = limiter
      .acquire(route, { maxWaitMs: 10_000 })
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(10);
    await limiter.observe(other, 420, {});
    expect(await settledAfter(waiting, 0)).toBe(true);
    expect(await waiting).toBeInstanceOf(EsiThrottledError);
  });
});
