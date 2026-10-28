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
 * A response that carries X-Ratelimit-Group teaches the limiter which group
 * its route template belongs to, and records that bucket's limit and
 * remaining tokens. Below 20% remaining the group's requests go at the pace
 * the bucket refills; below one 2xx's worth they wait for a token to come
 * back; a grouped 429 pauses only that group (and bucketKey) for Retry-After.
 * A request waiting on its bucket leaves the queue and re-enters on its own
 * timer, so it never holds up other routes.
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
/** Below this share of the limit, a group's requests are spaced out. */
const LOW_TOKEN_SHARE = 0.2;
/** Tokens a 2xx costs; the unit the spacing is measured in. */
const SUCCESS_TOKEN_COST = 2;

const WINDOW_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Header value in seconds → ms, or null when absent or not a number. */
function seconds(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n * 1000 : null;
}

/** X-Ratelimit-Limit, e.g. '150/15m' → { limit: 150, windowMs: 900_000 }. */
function parseLimit(
  value: string | undefined,
): { limit: number; windowMs: number } | null {
  const match = value?.trim().match(/^(\d+)\/(\d+)([smhd])$/);
  if (!match) return null;
  const limit = Number(match[1]);
  const windowMs = Number(match[2]) * WINDOW_UNIT_MS[match[3]];
  return limit > 0 && windowMs > 0 ? { limit, windowMs } : null;
}

/**
 * The route a path belongs to, as ESI groups it: the query string goes, a
 * numeric segment becomes {id} and a killmail hash {hash}.
 */
export function routeTemplate(path: string): string {
  return path
    .split('?')[0]
    .split('/')
    .map((segment) =>
      /^[0-9a-f]{40}$/.test(segment)
        ? '{hash}'
        : /^\d+$/.test(segment)
          ? '{id}'
          : segment,
    )
    .join('/');
}

/** The last known state of one route group's token bucket. */
interface Bucket {
  /** NaN until a response has carried X-Ratelimit-Limit. */
  limit: number;
  windowMs: number;
  /** NaN until a response has carried X-Ratelimit-Remaining. */
  remaining: number;
  /** When `remaining` was last read from a response. */
  updatedAt: number;
  /** When this bucket last had a request dispatched. */
  sentAt: number;
  /** Earliest dispatch the spacing allows; kept by `respace`. */
  nextAllowedAt: number;
  /** Set by a grouped 429. */
  pausedUntil: number;
}

interface Waiter {
  grant: () => void;
  /** Absolute time past which an acquire with maxWaitMs gives up. */
  deadline?: number;
  reject?: (error: EsiThrottledError) => void;
  /** The route being acquired, for its group bucket. */
  route?: EsiRoute;
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

  // Route template → group, learnt from responses; group:bucketKey → bucket.
  private groups = new Map<string, string>();
  private buckets = new Map<string, Bucket>();
  // Grouped acquires waiting out their bucket, off the queue, with the timer
  // that puts them back on it.
  private parked = new Map<Waiter, ReturnType<typeof setTimeout>>();

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

  private groupThrottledError(
    key: string,
    maxWaitMs: number,
  ): EsiThrottledError {
    const bucket = this.buckets.get(key);
    const waitS = bucket
      ? Math.ceil((this.readyAt(bucket) - Date.now()) / 1000)
      : 0;
    return new EsiThrottledError(
      429,
      'rate-limit',
      `ESI group ${key} is throttled for another ${waitS} s, longer than the ${maxWaitMs} ms this caller waits`,
    );
  }

  /** The bucket a route draws on, once its group has been learnt. */
  private bucketKeyOf(route: EsiRoute | undefined): string | undefined {
    if (route === undefined) return undefined;
    const group = this.groups.get(routeTemplate(route.path));
    return group === undefined
      ? undefined
      : `${group}:${route.bucketKey ?? ''}`;
  }

  private readyAt(bucket: Bucket): number {
    return Math.max(bucket.pausedUntil, bucket.nextAllowedAt);
  }

  /**
   * Below 20% remaining, send no faster than the bucket refills: the sliding
   * window returns `limit` tokens per window and a 2xx costs 2, so one request
   * per window / limit × 2 is the pace the group can sustain. Below one 2xx's
   * worth, the same gap is counted from the last response too, so the request
   * waits for a token to come back — ESI does not say when, and the next
   * response corrects the guess. One model for both, so the gap never grows
   * as the tokens shrink.
   */
  private respace(bucket: Bucket) {
    const { limit, windowMs, remaining } = bucket;
    if (!(limit > 0) || !(remaining < limit * LOW_TOKEN_SHARE)) {
      bucket.nextAllowedAt = 0;
      return;
    }
    const pace = (windowMs / limit) * SUCCESS_TOKEN_COST;
    const from =
      remaining < SUCCESS_TOKEN_COST
        ? Math.max(bucket.sentAt, bucket.updatedAt)
        : bucket.sentAt;
    bucket.nextAllowedAt = from + pace;
  }

  /**
   * Wait for a dispatch slot. The slot counts as in flight until `release`.
   * With `maxWaitMs`, a brake or a group wait that ends later than that
   * rejects with EsiThrottledError instead of waiting: at once if it is
   * already known, or when it is discovered if the acquire is still waiting.
   */
  acquire(route: EsiRoute, opts?: { maxWaitMs?: number }): Promise<void> {
    const maxWaitMs = opts?.maxWaitMs;
    if (maxWaitMs === undefined) {
      return new Promise((resolve) => this.enqueue({ grant: resolve, route }));
    }
    const deadline = Date.now() + maxWaitMs;
    if (this.pausedUntil > deadline) {
      return Promise.reject(this.throttledError(maxWaitMs));
    }
    const key = this.bucketKeyOf(route);
    const bucket = key === undefined ? undefined : this.buckets.get(key);
    if (key !== undefined && bucket && this.readyAt(bucket) > deadline) {
      return Promise.reject(this.groupThrottledError(key, maxWaitMs));
    }
    return new Promise((resolve, reject) =>
      this.enqueue({
        grant: resolve,
        deadline,
        reject,
        route,
      }),
    );
  }

  release(): void {
    this.inFlight--;
  }

  /** Read a response's throttling headers. Keys are lowercase. */
  observe(
    route: EsiRoute,
    status: number,
    headers: Record<string, string | undefined>,
  ): void {
    const group = headers['x-ratelimit-group'];
    if (group !== undefined) {
      this.observeGroup(route, group, status, headers);
      // A grouped 429 throttles only its group, never the whole process.
      if (status === 429) return;
    }

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

  private observeGroup(
    route: EsiRoute,
    group: string,
    status: number,
    headers: Record<string, string | undefined>,
  ) {
    const now = Date.now();
    this.groups.set(routeTemplate(route.path), group);
    const key = `${group}:${route.bucketKey ?? ''}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        limit: NaN,
        windowMs: NaN,
        remaining: NaN,
        updatedAt: now,
        sentAt: -Infinity,
        nextAllowedAt: 0,
        pausedUntil: 0,
      };
      this.buckets.set(key, bucket);
    }

    const limit = parseLimit(headers['x-ratelimit-limit']);
    if (limit) {
      bucket.limit = limit.limit;
      bucket.windowMs = limit.windowMs;
    }
    const remainingHeader = headers['x-ratelimit-remaining'];
    const remaining = Number(remainingHeader);
    if (remainingHeader?.trim() && Number.isFinite(remaining)) {
      bucket.remaining = remaining;
      bucket.updatedAt = now;
    }
    this.respace(bucket);

    if (status === 429) {
      const retryAfter = seconds(headers['retry-after']) ?? DEFAULT_PAUSE_MS;
      if (retryAfter > 0) {
        const until = now + Math.min(retryAfter, MAX_PAUSE_MS);
        if (until > bucket.pausedUntil) {
          // Same once-per-event logging as the process brake.
          const isNew = until - Math.max(bucket.pausedUntil, now) >= 1000;
          bucket.pausedUntil = until;
          if (isNew) {
            logger.warn(
              `⏸️  ESI 429 (rate-limit): pausing group ${key} for ${Math.round((until - now) / 1000)} s`,
            );
          }
        }
      }
    }

    // The bucket changed, so every acquire waiting on it looks again: one that
    // can no longer make its deadline rejects, the rest wait the new time.
    this.rejectWaitersBefore(this.readyAt(bucket), key);
    for (const [waiter, timer] of this.parked) {
      if (this.bucketKeyOf(waiter.route) !== key) continue;
      clearTimeout(timer);
      this.parked.delete(waiter);
      this.queue.push(waiter);
    }
    this.processQueue();
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

  /**
   * Give up on every waiting acquire whose maxWaitMs deadline falls before
   * `until`: all of them for the process brake, or only those drawing on
   * bucket `key` for a group wait.
   */
  private rejectWaitersBefore(until: number, key?: string) {
    const now = Date.now();
    const expires = (waiter: Waiter) =>
      waiter.deadline !== undefined &&
      waiter.deadline < until &&
      (key === undefined || this.bucketKeyOf(waiter.route) === key);
    const reject = (waiter: Waiter) => {
      const maxWaitMs = waiter.deadline! - now;
      waiter.reject?.(
        key === undefined
          ? this.throttledError(maxWaitMs)
          : this.groupThrottledError(key, maxWaitMs),
      );
    };

    this.queue = this.queue.filter((waiter) => {
      if (!expires(waiter)) return true;
      reject(waiter);
      return false;
    });
    for (const [waiter, timer] of this.parked) {
      if (!expires(waiter)) continue;
      clearTimeout(timer);
      this.parked.delete(waiter);
      reject(waiter);
    }
  }

  /**
   * Take the head waiter off the queue if its bucket is not ready, and put it
   * back when it is, so it never holds up other routes. Returns whether it did.
   */
  private parkHeadIfWaiting(now: number): boolean {
    const waiter = this.queue[0];
    const key = this.bucketKeyOf(waiter.route);
    const bucket = key === undefined ? undefined : this.buckets.get(key);
    if (key === undefined || !bucket) return false;
    const readyAt = this.readyAt(bucket);
    if (readyAt <= now) return false;

    this.queue.shift();
    if (waiter.deadline !== undefined && waiter.deadline < readyAt) {
      waiter.reject?.(this.groupThrottledError(key, waiter.deadline - now));
      return true;
    }
    const timer = setTimeout(
      () => {
        this.parked.delete(waiter);
        this.enqueue(waiter);
      },
      Math.ceil(readyAt - now),
    );
    this.parked.set(waiter, timer);
    return true;
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

      // A grouped request whose bucket says wait steps aside.
      if (this.parkHeadIfWaiting(now)) continue;

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
        const key = this.bucketKeyOf(waiter.route);
        const bucket = key === undefined ? undefined : this.buckets.get(key);
        if (bucket) {
          bucket.sentAt = now;
          this.respace(bucket);
        }
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
      // Grouped acquires waiting out their bucket are still waiting.
      queueLength: this.queue.length + this.parked.size,
      currentRate: this.currentRate(),
      pausedUntil: this.pausedUntil,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
    };
  }
}

// Singleton instance
export const esiRateLimiter = new RateLimiter();
