/**
 * The ESI limiter every Node process uses: the shared Redis budget
 * (SharedLimiterStore) decides, this class keeps the in-process side of it.
 * See docs/superpowers/specs/2026-11-14-shared-esi-limiter-design.md.
 *
 * In-process, as in rate-limiter.ts: the queue of waiting callers, the
 * maxWaitMs rejection, the in-flight ceiling and the log lines. The head
 * waiter asks the store for a slot; a 'group' answer parks it on its own
 * timer so it never holds up other routes, a 'brake' or 'rate' answer sleeps
 * at most MAX_SLEEP_MS (plus jitter) and asks again, so a brake set by
 * another process is seen within one sleep.
 *
 * Every store call has STORE_TIMEOUT_MS to answer. An error or a timeout
 * switches the process to local mode: every acquire, observe and release
 * goes to the per-process RateLimiter, as before the shared limiter, and one
 * acquire every REDIS_RETRY_MS tries Redis again.
 */

import { config } from '@config/config';
import logger from '@services/logger';
import {
  EsiThrottledError,
  esiRateLimiter,
  parseLimit,
  routeTemplate,
  seconds,
  type EsiRoute,
  type EsiThrottleKind,
  type RateLimiter,
} from '@services/rate-limiter';
import Redis from 'ioredis';
import {
  SharedLimiterStore,
  type AcquireResult,
  type EsiPriority,
  type ObserveInput,
} from './shared-store';

/** How long a store call may take before the process goes local. */
export const STORE_TIMEOUT_MS = 200;
/** In local mode, how often one acquire tries Redis again. */
export const REDIS_RETRY_MS = 10_000;
/** Longest single sleep on a 'brake' or 'rate' answer before asking again. */
export const MAX_SLEEP_MS = 1_000;
/** Random 0..MAX_JITTER_MS ms added to that sleep, so waiters spread out. */
export const MAX_JITTER_MS = 50;

/** warn, once per switch: `${LOG_REDIS_UNREACHABLE} (<error>); retrying every 10 s` */
export const LOG_REDIS_UNREACHABLE =
  '⚠️  ESI limiter: Redis unreachable, using the per-process limiter';
/** info, once per switch back. */
export const LOG_REDIS_BACK =
  '✅ ESI limiter: Redis is back, using the shared limiter';

/** The same text rate-limiter.ts logs for a brake it sets. */
export function brakeLog(
  status: number,
  kind: EsiThrottleKind,
  ms: number,
  rate: number,
): string {
  return `⏸️  ESI ${status} (${kind}): pausing all requests for ${Math.round(ms / 1000)} s, rate ${rate} req/s`;
}

/** The same text rate-limiter.ts logs for a group pause it sets. */
export function groupPauseLog(key: string, ms: number): string {
  return `⏸️  ESI 429 (rate-limit): pausing group ${key} for ${Math.round(ms / 1000)} s`;
}

export type LimiterStore = Pick<SharedLimiterStore, 'acquire' | 'observe'>;

interface Waiter {
  route: EsiRoute;
  resolve: () => void;
  reject: (error: Error) => void;
  /** The caller's maxWaitMs, and the absolute time it runs out. */
  maxWaitMs?: number;
  deadline?: number;
  /** '<group>:<bucketKey>' while parked on a group wait. */
  groupKey?: string;
}

/**
 * A response's throttling headers as the store wants them: numbers, and a
 * field left out when its header is absent, blank or not a number. Keys are
 * lowercase.
 */
export function observeInput(
  route: EsiRoute,
  status: number,
  headers: Record<string, string | undefined>,
): ObserveInput {
  const input: ObserveInput = {
    template: routeTemplate(route.path),
    bucketKey: route.bucketKey ?? '',
    status,
  };
  const number = (value: string | undefined) => {
    if (value === undefined || value.trim() === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  const group = headers['x-ratelimit-group'];
  if (group) input.group = group;
  const limit = parseLimit(headers['x-ratelimit-limit']);
  if (limit) {
    input.limit = limit.limit;
    input.windowMs = limit.windowMs;
  }
  const remaining = number(headers['x-ratelimit-remaining']);
  if (remaining !== undefined) input.remaining = remaining;
  const errorRemain = number(headers['x-esi-error-limit-remain']);
  if (errorRemain !== undefined) input.errorRemain = errorRemain;
  const errorResetMs = seconds(headers['x-esi-error-limit-reset']);
  if (errorResetMs !== null) input.errorResetMs = errorResetMs;
  const retryAfterMs = seconds(headers['retry-after']);
  if (retryAfterMs !== null) input.retryAfterMs = retryAfterMs;
  return input;
}

export class SharedRateLimiter {
  private readonly store: LimiterStore;
  private readonly local: RateLimiter;
  private readonly timeoutMs: number;
  private readonly retryMs: number;
  private readonly now: () => number;

  private priority: EsiPriority = 'bulk';
  private shared = true;
  /** In local mode, when an acquire may next try Redis. */
  private retryAt = 0;

  private queue: Waiter[] = [];
  private parked = new Map<Waiter, ReturnType<typeof setTimeout>>();
  private processing = false;

  // The process's own socket ceiling, not an ESI rule; as in rate-limiter.ts.
  private readonly maxConcurrent = Math.max(
    50,
    config.esi.maxRequestsPerSecond,
  );
  private readonly spacing = Math.max(
    1,
    Math.floor(1000 / config.esi.maxRequestsPerSecond),
  );
  /** Slots granted by the store, and by the local limiter, not yet released. */
  private inFlight = 0;
  private localInFlight = 0;

  constructor(
    store: LimiterStore,
    local: RateLimiter,
    opts?: { timeoutMs?: number; retryMs?: number; now?: () => number },
  ) {
    this.store = store;
    this.local = local;
    this.timeoutMs = opts?.timeoutMs ?? STORE_TIMEOUT_MS;
    this.retryMs = opts?.retryMs ?? REDIS_RETRY_MS;
    this.now = opts?.now ?? Date.now;
  }

  /** Per process: 'live' for the API server and the live stream. */
  setPriority(priority: EsiPriority): void {
    this.priority = priority;
  }

  isShared(): boolean {
    return this.shared;
  }

  /**
   * Wait for a dispatch slot. The slot counts as in flight until `release`.
   * With `maxWaitMs`, a wait the store reports as ending later than that
   * rejects with EsiThrottledError instead of waiting.
   */
  acquire(route: EsiRoute, opts?: { maxWaitMs?: number }): Promise<void> {
    const maxWaitMs = opts?.maxWaitMs;
    const now = this.now();
    if (!this.shared) {
      if (now < this.retryAt) return this.viaLocal(route, maxWaitMs);
      // This acquire tries Redis; the others keep going local meanwhile.
      this.retryAt = now + this.retryMs;
    }
    return new Promise((resolve, reject) => {
      this.queue.push({
        route,
        resolve,
        reject,
        maxWaitMs,
        deadline: maxWaitMs === undefined ? undefined : now + maxWaitMs,
      });
      void this.processQueue();
    });
  }

  /**
   * Gives up one slot. A release cannot say which limiter granted its slot,
   * so local slots are given back first; the counts come out right once
   * every request has released.
   */
  release(): void {
    if (this.localInFlight > 0) {
      this.localInFlight--;
      this.local.release();
    } else {
      this.inFlight--;
    }
  }

  /** Report a response's throttling headers. Keys are lowercase. */
  async observe(
    route: EsiRoute,
    status: number,
    headers: Record<string, string | undefined>,
  ): Promise<void> {
    if (!this.shared) {
      this.local.observe(route, status, headers);
      return;
    }
    let result;
    try {
      result = await this.withTimeout(
        this.store.observe(observeInput(route, status, headers)),
      );
    } catch (error) {
      this.enterLocal(error);
      this.local.observe(route, status, headers);
      return;
    }

    // The store returns a brake or a group pause only to the process that set
    // it, so each is logged once across every process.
    const now = this.now();
    const { brake, groupPause } = result;
    if (brake) {
      logger.warn(brakeLog(brake.status, brake.kind, brake.ms, result.rate));
      this.rejectWaitersBefore(
        now + brake.ms,
        () => true,
        (waiter) =>
          this.brakeError(
            brake.status,
            brake.kind,
            brake.ms,
            waiter.maxWaitMs!,
          ),
      );
    }
    if (groupPause) {
      logger.warn(groupPauseLog(groupPause.key, groupPause.ms));
      this.rejectWaitersBefore(
        now + groupPause.ms,
        (waiter) => waiter.groupKey === groupPause.key,
        (waiter) =>
          this.groupError(groupPause.key, groupPause.ms, waiter.maxWaitMs!),
      );
    }
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        if (this.inFlight >= this.maxConcurrent) {
          await this.sleep(this.spacing);
          continue;
        }

        const waiter = this.queue[0];
        let reply: AcquireResult;
        try {
          reply = await this.withTimeout(
            this.store.acquire(
              this.priority,
              routeTemplate(waiter.route.path),
              waiter.route.bucketKey ?? '',
            ),
          );
        } catch (error) {
          this.enterLocal(error);
          continue;
        }
        // Handed to the local limiter while the store was answering.
        if (this.queue[0] !== waiter) continue;
        if (!this.shared) this.leaveLocal();

        if (reply.granted) {
          this.queue.shift();
          this.inFlight++;
          waiter.resolve();
          continue;
        }

        const now = this.now();
        if (
          waiter.deadline !== undefined &&
          now + reply.waitMs > waiter.deadline
        ) {
          this.queue.shift();
          waiter.reject(this.waitError(reply, waiter.maxWaitMs!));
          continue;
        }
        if (reply.reason === 'group') {
          this.queue.shift();
          this.park(waiter, reply.waitMs, reply.detail);
          continue;
        }
        await this.sleep(
          Math.min(reply.waitMs, MAX_SLEEP_MS) + Math.random() * MAX_JITTER_MS,
        );
      }
    } finally {
      this.processing = false;
    }
  }

  /** Off the queue until its group wait is over, then back to ask again. */
  private park(waiter: Waiter, waitMs: number, groupKey: string) {
    waiter.groupKey = groupKey;
    const timer = setTimeout(() => {
      this.parked.delete(waiter);
      waiter.groupKey = undefined;
      this.queue.push(waiter);
      void this.processQueue();
    }, Math.ceil(waitMs));
    this.parked.set(waiter, timer);
  }

  /** Reject every waiter `applies` picks whose deadline falls before `until`. */
  private rejectWaitersBefore(
    until: number,
    applies: (waiter: Waiter) => boolean,
    error: (waiter: Waiter) => EsiThrottledError,
  ) {
    const expires = (waiter: Waiter) =>
      waiter.deadline !== undefined &&
      waiter.deadline < until &&
      applies(waiter);
    this.queue = this.queue.filter((waiter) => {
      if (!expires(waiter)) return true;
      waiter.reject(error(waiter));
      return false;
    });
    for (const [waiter, timer] of this.parked) {
      if (!expires(waiter)) continue;
      clearTimeout(timer);
      this.parked.delete(waiter);
      waiter.reject(error(waiter));
    }
  }

  private waitError(
    reply: Extract<AcquireResult, { granted: false }>,
    maxWaitMs: number,
  ): EsiThrottledError {
    if (reply.reason === 'group') {
      return this.groupError(reply.detail, reply.waitMs, maxWaitMs);
    }
    if (reply.reason === 'brake') {
      // detail is '<status>:<kind>', e.g. '420:error-limit'.
      const [status, kind] = reply.detail.split(':');
      return this.brakeError(
        status === '420' ? 420 : 429,
        (kind || 'deep-limit') as EsiThrottleKind,
        reply.waitMs,
        maxWaitMs,
      );
    }
    // The shared bucket refills at the rate a header-less 429 lowered.
    return new EsiThrottledError(
      429,
      'deep-limit',
      `ESI shared rate has no slot for another ${reply.waitMs} ms, longer than the ${maxWaitMs} ms this caller waits`,
    );
  }

  private brakeError(
    status: 420 | 429,
    kind: EsiThrottleKind,
    waitMs: number,
    maxWaitMs: number,
  ): EsiThrottledError {
    return new EsiThrottledError(
      status,
      kind,
      `ESI is throttled for another ${Math.ceil(waitMs / 1000)} s (${kind}), longer than the ${maxWaitMs} ms this caller waits`,
    );
  }

  private groupError(
    key: string,
    waitMs: number,
    maxWaitMs: number,
  ): EsiThrottledError {
    return new EsiThrottledError(
      429,
      'rate-limit',
      `ESI group ${key} is throttled for another ${Math.ceil(waitMs / 1000)} s, longer than the ${maxWaitMs} ms this caller waits`,
    );
  }

  private async viaLocal(route: EsiRoute, maxWaitMs?: number): Promise<void> {
    await this.local.acquire(
      route,
      maxWaitMs === undefined ? {} : { maxWaitMs },
    );
    this.localInFlight++;
  }

  /** Go local, or stay local after a failed retry; hand every waiter over. */
  private enterLocal(error: unknown) {
    const now = this.now();
    this.retryAt = now + this.retryMs;
    if (this.shared) {
      this.shared = false;
      const reason = error instanceof Error ? error.message : String(error);
      logger.warn(
        `${LOG_REDIS_UNREACHABLE} (${reason}); retrying every ${this.retryMs / 1000} s`,
      );
    }

    const waiters = [...this.queue, ...this.parked.keys()];
    for (const timer of this.parked.values()) clearTimeout(timer);
    this.queue = [];
    this.parked.clear();
    for (const waiter of waiters) {
      const remaining =
        waiter.deadline === undefined
          ? undefined
          : Math.max(0, waiter.deadline - now);
      this.viaLocal(waiter.route, remaining).then(
        waiter.resolve,
        waiter.reject,
      );
    }
  }

  private leaveLocal() {
    this.shared = true;
    logger.info(LOG_REDIS_BACK);
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no answer in ${this.timeoutMs} ms`)),
        this.timeoutMs,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * The store behind esiLimiter, on its own connection: a slow KEYS scan on the
 * cache connection must not hold up the limiter. Created on first use, so
 * importing esi-client never opens a socket. With no offline queue and no
 * retries a command fails at once while Redis is down, and the limiter goes
 * local instead of waiting.
 */
function redisStore(): LimiterStore {
  let store: SharedLimiterStore | undefined;
  let ready: Promise<void> | undefined;

  const open = async () => {
    if (!store) {
      const redis = new Redis(config.redis.url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
      });
      // ioredis keeps reconnecting on its own; the limiter logs the switch.
      redis.on('error', (error) =>
        logger.debug(`ESI limiter Redis: ${error.message}`),
      );
      ready = redis.connect().catch(() => {});
      store = new SharedLimiterStore(redis, {
        maxRps: config.esi.maxRequestsPerSecond,
      });
    }
    await ready;
    return store;
  };

  return {
    acquire: async (...args) => (await open()).acquire(...args),
    observe: async (...args) => (await open()).observe(...args),
  };
}

export const esiLimiter = new SharedRateLimiter(redisStore(), esiRateLimiter);
