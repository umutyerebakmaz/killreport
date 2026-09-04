import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/** A task that stays in flight until the test releases it. */
function pending() {
  let release!: (value: string) => void;
  const promise = new Promise<string>((resolve) => (release = resolve));
  const fn = vi.fn(() => promise);
  return { fn, release };
}

beforeEach(() => {
  vi.useFakeTimers();
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
  it('reports the queue depth, the dispatches in this window and the configured rate', async () => {
    const limiter = await limiterAt(50);
    for (let i = 0; i < 3; i++) void limiter.execute(pending().fn);

    expect(limiter.getStats()).toEqual({
      queueLength: 2,
      requestCount: 1,
      maxRequestsPerSecond: 50,
    });

    await vi.advanceTimersByTimeAsync(40);
    expect(limiter.getStats()).toMatchObject({
      queueLength: 0,
      requestCount: 3,
    });
  });
});
