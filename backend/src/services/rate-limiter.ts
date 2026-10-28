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

class RateLimiter {
  private queue: Array<() => void> = [];
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
  private rateBaseAt = 0;

  /** The adapted dispatch rate: +1 req/s per full 10 s since the last halving. */
  private currentRate(now = Date.now()): number {
    const climbed = Math.floor(
      (now - this.rateBaseAt) / RATE_CLIMB_INTERVAL_MS,
    );
    return Math.min(this.maxRequestsPerSecond, this.rateBase + climbed);
  }

  /**
   * Wait for a dispatch slot. The slot counts as in flight until `release`.
   * With `maxWaitMs`, a brake that ends later than that rejects at once with
   * EsiThrottledError instead of waiting.
   */
  acquire(_route: EsiRoute, opts?: { maxWaitMs?: number }): Promise<void> {
    const maxWaitMs = opts?.maxWaitMs;
    if (maxWaitMs !== undefined && this.pausedUntil > Date.now() + maxWaitMs) {
      const waitS = Math.ceil((this.pausedUntil - Date.now()) / 1000);
      return Promise.reject(
        new EsiThrottledError(
          this.pauseStatus,
          this.pauseKind,
          `ESI is throttled for another ${waitS} s (${this.pauseKind}), longer than the ${maxWaitMs} ms this caller waits`,
        ),
      );
    }
    return new Promise((resolve) => this.enqueue(resolve));
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
      // 429s that land during a pause were sent before it: one event, one halving.
      if (Date.now() >= this.pausedUntil) this.halveRate();
      const retryAfter = seconds(headers['retry-after']);
      this.pause(retryAfter ?? DEFAULT_PAUSE_MS, 429, 'deep-limit');
    }
  }

  private halveRate() {
    const now = Date.now();
    this.rateBase = Math.max(1, Math.floor(this.currentRate(now) / 2));
    this.rateBaseAt = now;
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
      this.enqueue(() => {
        (async () => {
          try {
            resolve(await fn());
          } catch (error) {
            reject(error);
          } finally {
            this.release();
          }
        })();
      });
    });
  }

  private enqueue(onSlot: () => void) {
    this.queue.push(() => {
      this.inFlight++;
      onSlot();
    });
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
      const fn = this.queue.shift();
      if (fn) {
        this.requestCount++;
        fn();

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
