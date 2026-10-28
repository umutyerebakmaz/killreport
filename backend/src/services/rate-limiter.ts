/**
 * ESI Rate Limiter
 * ESI runs two separate limit systems, and both speak through response headers:
 * - Error limit: at most 100 non-2xx/3xx responses a minute on routes that have
 *   not moved to the new system. Past that, EVERY route answers 420. Reported
 *   in X-ESI-Error-Limit-Remain / X-ESI-Error-Limit-Reset.
 * - Token buckets per route group (X-Ratelimit-Group and friends). Handled by
 *   the group buckets; a grouped 429 never stops the whole process.
 * Some routes also sit behind a deeper server limiter that answers 429 with no
 * group header and an unpublished threshold.
 *
 * `observe` reads every response. A 420, a low error budget or a header-less
 * 429 sets a process-wide brake (`pausedUntil`), and a header-less 429 also
 * halves the dispatch rate, which climbs back +1 req/s per 10 s (AIMD).
 *
 * The base ceiling is per PROCESS and comes from ESI_MAX_RPS (default 50).
 * Every worker runs in its own process with its own instance, so the budget is
 * shared by however many are running at once.
 */

import { config } from '@config/config';
import logger from '@services/logger';

export type EsiThrottleKind = 'error-limit' | 'rate-limit' | 'deep-limit';

export class EsiThrottledError extends Error {
  readonly status: 420 | 429;
  readonly kind: EsiThrottleKind;
  /** worker-error.ts reads `response.status`; keep that shape. */
  readonly response: { status: 420 | 429 };

  constructor(status: 420 | 429, kind: EsiThrottleKind, message: string) {
    super(message);
    this.name = 'EsiThrottledError';
    this.status = status;
    this.kind = kind;
    this.response = { status };
  }
}

export interface EsiRoute {
  /** request path, e.g. '/killmails/123/abc.../' — query string allowed */
  path: string;
  /** separates per-character buckets (authenticated routes); omit for public */
  bucketKey?: string;
}

const ERROR_LIMIT_FLOOR = 20;
const DEFAULT_PAUSE_MS = 60_000;
const MAX_PAUSE_MS = 15 * 60_000;
const RATE_CLIMB_INTERVAL_MS = 10_000;

/** Header value in seconds → ms, or null when absent or not a number. */
function seconds(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n * 1000 : null;
}

interface Waiter {
  grant: () => void;
  /** Absolute time past which an acquire with maxWaitMs gives up. */
  deadline?: number;
  reject?: (error: EsiThrottledError) => void;
}

class RateLimiter {
  private queue: Waiter[] = [];
  private processing = false;
  private requestCount = 0;
  private windowStart = Date.now();
  private inFlight = 0;
  private readonly maxRequestsPerSecond = config.esi.maxRequestsPerSecond;
  // In-flight cap has to scale with the rate, or it becomes the real ceiling.
  private readonly maxConcurrent = Math.max(
    50,
    config.esi.maxRequestsPerSecond,
  );

  // Process-wide brake, and what set it, for the maxWaitMs rejection.
  private pausedUntil = 0;
  private pauseStatus: 420 | 429 = 429;
  private pauseKind: EsiThrottleKind = 'deep-limit';

  // AIMD: the rate right after the last halving, and when that happened.
  private rateBase = config.esi.maxRequestsPerSecond;
  private halvedAt = -Infinity;

  /**
   * The adapted dispatch rate: +1 req/s per full 10 s since requests resumed,
   * so the time spent braked never counts towards the climb.
   */
  private currentRate(now = Date.now()): number {
    const climbFrom = Math.max(this.halvedAt, this.pausedUntil);
    const climbed = Math.max(
      0,
      Math.floor((now - climbFrom) / RATE_CLIMB_INTERVAL_MS),
    );
    return Math.min(this.maxRequestsPerSecond, this.rateBase + climbed);
  }

  private throttledError(maxWaitMs: number): EsiThrottledError {
    const waitS = Math.ceil((this.pausedUntil - Date.now()) / 1000);
    return new EsiThrottledError(
      this.pauseStatus,
      this.pauseKind,
      `ESI is throttled for another ${waitS} s (${this.pauseKind}), longer than the ${maxWaitMs} ms this caller waits`,
    );
  }

  /**
   * Wait for a dispatch slot. The slot counts as in flight until `release`.
   * With `maxWaitMs`, a brake that ends later than that rejects with
   * EsiThrottledError instead of waiting: at once if the brake is already on,
   * or when it starts if the acquire is still queued.
   */
  acquire(_route: EsiRoute, opts?: { maxWaitMs?: number }): Promise<void> {
    const maxWaitMs = opts?.maxWaitMs;
    if (maxWaitMs === undefined) {
      return new Promise((resolve) => this.enqueue({ grant: resolve }));
    }
    const deadline = Date.now() + maxWaitMs;
    if (this.pausedUntil > deadline) {
      return Promise.reject(this.throttledError(maxWaitMs));
    }
    return new Promise((resolve, reject) =>
      this.enqueue({
        grant: resolve,
        deadline,
        reject,
      }),
    );
  }

  release(): void {
    this.inFlight--;
  }

  /** Read a response's throttling headers. Keys are lowercase. */
  observe(
    _route: EsiRoute,
    status: number,
    headers: Record<string, string | undefined>,
  ): void {
    // A grouped 429 throttles only its group; the group buckets own that path.
    if (status === 429 && headers['x-ratelimit-group'] !== undefined) return;

    const remain = Number(headers['x-esi-error-limit-remain']);
    const reset = seconds(headers['x-esi-error-limit-reset']);
    if (status === 420) {
      this.pause(reset ?? DEFAULT_PAUSE_MS, 420, 'error-limit');
    } else if (remain < ERROR_LIMIT_FLOOR && reset !== null) {
      this.pause(reset, 420, 'error-limit');
    }

    if (status === 429) {
      // 429s that land during a pause, or within 10 s of a halving, were sent
      // before the rate dropped: one event, one halving.
      const now = Date.now();
      if (
        now >= this.pausedUntil &&
        now - this.halvedAt >= RATE_CLIMB_INTERVAL_MS
      ) {
        this.halveRate();
      }
      const retryAfter = seconds(headers['retry-after']);
      this.pause(retryAfter ?? DEFAULT_PAUSE_MS, 429, 'deep-limit');
    }
  }

  private halveRate() {
    const now = Date.now();
    this.rateBase = Math.max(1, Math.floor(this.currentRate(now) / 2));
    this.halvedAt = now;
  }

  private pause(ms: number, status: 420 | 429, kind: EsiThrottleKind) {
    if (ms <= 0) return;
    const now = Date.now();
    const until = now + Math.min(ms, MAX_PAUSE_MS);
    if (until <= this.pausedUntil) return;

    // An extension under a second is the same pause seen again by a request
    // that was already in flight; log only a new or a materially longer one.
    const isNew = until - Math.max(this.pausedUntil, now) >= 1000;
    this.pausedUntil = until;
    this.pauseStatus = status;
    this.pauseKind = kind;
    if (isNew) {
      logger.warn(
        `⏸️  ESI ${status} (${kind}): pausing all requests for ${Math.round((until - now) / 1000)} s, rate ${this.currentRate(now)} req/s`,
      );
    }
    this.rejectWaitersBefore(until);
  }

  /** Give up on every queued acquire whose maxWaitMs deadline falls before `until`. */
  private rejectWaitersBefore(until: number) {
    const now = Date.now();
    this.queue = this.queue.filter((waiter) => {
      if (waiter.deadline === undefined || waiter.deadline >= until) {
        return true;
      }
      waiter.reject?.(this.throttledError(waiter.deadline - now));
      return false;
    });
  }

  /**
   * Execute a function with rate limiting. Kept for existing callers; it is an
   * acquire, the call, then a release.
   * Requests are DISPATCHED at up to the current rate and run concurrently
   * (we do not wait for one request to finish before dispatching the next).
   */
  execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // The slot callback runs fn synchronously, so dispatch timing is exact.
      this.enqueue({
        grant: () => {
          (async () => {
            try {
              resolve(await fn());
            } catch (error) {
              reject(error);
            } finally {
              this.release();
            }
          })();
        },
      });
    });
  }

  private enqueue(waiter: Waiter) {
    this.queue.push(waiter);
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Nothing is dispatched while the brake is on.
      const now = Date.now();
      if (this.pausedUntil > now) {
        await this.sleep(this.pausedUntil - now);
        continue;
      }

      // Check if we need to reset the rate window
      const elapsed = now - this.windowStart;

      if (elapsed >= 1000) {
        this.requestCount = 0;
        this.windowStart = now;
      }

      // Respect the per-second dispatch ceiling
      const rate = this.currentRate(now);
      // Dispatch spacing that produces the rate: 50/sec => 20ms apart.
      const spacing = Math.max(1, Math.floor(1000 / rate));
      if (this.requestCount >= rate) {
        await this.sleep(1000 - elapsed);
        continue;
      }

      // Respect the max concurrent in-flight ceiling
      if (this.inFlight >= this.maxConcurrent) {
        await this.sleep(spacing);
        continue;
      }

      // Dispatch next item WITHOUT awaiting its completion so requests overlap
      const waiter = this.queue.shift();
      if (waiter) {
        this.requestCount++;
        this.inFlight++;
        waiter.grant();

        // Space out dispatches at the current rate.
        await this.sleep(spacing);
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limiter stats
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      currentRate: this.currentRate(),
      pausedUntil: this.pausedUntil,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
    };
  }
}

// Singleton instance
export const esiRateLimiter = new RateLimiter();
