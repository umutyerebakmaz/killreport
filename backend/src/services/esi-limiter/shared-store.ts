/**
 * The Redis side of the shared ESI limiter: one budget, one brake and one set
 * of group buckets for every process that talks to ESI from this machine.
 *
 * The logic lives in acquire.lua and observe.lua, with the helpers both share
 * in lib.lua (prepended to each, see loadScript), the single copy that the
 * Rust store loads too (include_str!), and runs atomically inside Redis on
 * Redis's own clock. This class only marshals arguments and results; header
 * parsing, waiting and logging belong to the caller.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Redis from 'ioredis';
import type { EsiThrottleKind } from '@services/rate-limiter';

/** Lowercase, so the response cache's `*<Typename>:<id>*` KEYS never match. */
export const KEY_PREFIX = 'esi-limiter:';
/** Tokens a bulk acquire leaves in the shared bucket for live traffic. */
export const FLOOR = 5;

export type EsiPriority = 'live' | 'bulk';

export type AcquireResult =
  | { granted: true }
  | {
      granted: false;
      waitMs: number;
      reason: 'brake' | 'group' | 'rate';
      detail: string;
    };

export interface ObserveInput {
  template: string;
  bucketKey: string;
  status: number;
  group?: string;
  limit?: number;
  windowMs?: number;
  remaining?: number;
  errorRemain?: number;
  errorResetMs?: number;
  retryAfterMs?: number;
}

export interface ObserveResult {
  /** Only when this call set a new brake; the caller logs it. */
  brake?: { ms: number; status: 420 | 429; kind: EsiThrottleKind };
  /** Only when this call set a new group pause. */
  groupPause?: { key: string; ms: number };
  /** The adapted dispatch rate after this response. */
  rate: number;
}

interface Script {
  source: string;
  sha: string;
}

const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');

/**
 * A script runs as ONE body: lib.lua, a newline, then the script, and the
 * EVALSHA SHA is of that combined body. The Rust store builds the same body
 * with concat!(include_str!("lib.lua"), "\n", include_str!("<script>.lua")).
 */
function loadScript(name: string): Script {
  const source = `${read('lib.lua')}\n${read(name)}`;
  return { source, sha: createHash('sha1').update(source).digest('hex') };
}

const ACQUIRE = loadScript('acquire.lua');
const OBSERVE = loadScript('observe.lua');

/** An absent number travels as '' — the scripts read that as "no value". */
function arg(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export class SharedLimiterStore {
  private readonly redis: Redis;
  private readonly maxRps: number;
  private readonly prefix: string;
  private readonly floor: number;

  constructor(
    redis: Redis,
    opts: { maxRps: number; prefix?: string; floor?: number },
  ) {
    this.redis = redis;
    this.maxRps = opts.maxRps;
    this.prefix = opts.prefix ?? KEY_PREFIX;
    this.floor = opts.floor ?? FLOOR;
  }

  /** `now` is for tests; without it the script uses Redis TIME. */
  async acquire(
    priority: EsiPriority,
    template: string,
    bucketKey: string,
    now?: number,
  ): Promise<AcquireResult> {
    const reply = (await this.run(ACQUIRE, [
      this.prefix,
      priority,
      template,
      bucketKey,
      String(this.maxRps),
      String(this.floor),
      arg(now),
    ])) as [number, number?, string?, string?];

    if (reply[0] === 1) return { granted: true };
    return {
      granted: false,
      waitMs: Number(reply[1]),
      reason: reply[2] as 'brake' | 'group' | 'rate',
      detail: reply[3] ?? '',
    };
  }

  /** `now` is for tests; without it the script uses Redis TIME. */
  async observe(input: ObserveInput, now?: number): Promise<ObserveResult> {
    const [brakeMs, brakeStatus, brakeKind, groupKey, groupPauseMs, rate] =
      (await this.run(OBSERVE, [
        this.prefix,
        input.template,
        input.bucketKey,
        String(input.status),
        input.group ?? '',
        arg(input.limit),
        arg(input.windowMs),
        arg(input.remaining),
        arg(input.errorRemain),
        arg(input.errorResetMs),
        arg(input.retryAfterMs),
        String(this.maxRps),
        arg(now),
      ])) as [number, number, string, string, number, number];

    const result: ObserveResult = { rate: Number(rate) };
    if (brakeMs > 0) {
      result.brake = {
        ms: Number(brakeMs),
        status: Number(brakeStatus) as 420 | 429,
        kind: brakeKind as EsiThrottleKind,
      };
    }
    if (groupPauseMs > 0) {
      result.groupPause = { key: groupKey, ms: Number(groupPauseMs) };
    }
    return result;
  }

  /** EVALSHA, and EVAL once when Redis has lost the script (NOSCRIPT). */
  private async run(script: Script, args: string[]): Promise<unknown> {
    try {
      return await this.redis.evalsha(script.sha, 0, ...args);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('NOSCRIPT')) {
        throw error;
      }
      return this.redis.eval(script.source, 0, ...args);
    }
  }
}
