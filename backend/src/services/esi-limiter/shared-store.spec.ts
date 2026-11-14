import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Redis from 'ioredis';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  KEY_PREFIX,
  SharedLimiterStore,
  type AcquireResult,
  type EsiPriority,
  type ObserveResult,
} from './shared-store';

interface Step {
  client: 'a' | 'b' | 'c';
  op: 'acquire' | 'observe';
  now: number;
  repeat?: number;
  everyMs?: number;
  priority?: EsiPriority;
  template: string;
  bucketKey?: string;
  status?: number;
  group?: string;
  limit?: number;
  windowMs?: number;
  remaining?: number;
  errorRemain?: number;
  errorResetMs?: number;
  retryAfterMs?: number;
  expect: Record<string, unknown>;
}

interface Scenario {
  name: string;
  maxRps: number;
  steps: Step[];
}

const { scenarios } = JSON.parse(
  readFileSync(join(__dirname, 'scenarios.json'), 'utf8'),
) as { scenarios: Scenario[] };

const REDIS_URL = process.env.REDIS_URL;

/** expect is a partial match; a null value means the field must be absent. */
function expectPartial(
  actual: AcquireResult | ObserveResult,
  expected: Record<string, unknown>,
  label: string,
) {
  const got = actual as unknown as Record<string, unknown>;
  for (const [field, value] of Object.entries(expected)) {
    if (value === null) {
      expect(got[field], `${label}: ${field}`).toBeUndefined();
    } else {
      expect(got[field], `${label}: ${field}`).toEqual(value);
    }
  }
}

describe.skipIf(!REDIS_URL)('SharedLimiterStore against Redis', () => {
  const connections: Redis[] = [];
  const prefixes: string[] = [];

  function connect(): Redis {
    const redis = new Redis(REDIS_URL!, { lazyConnect: false });
    connections.push(redis);
    return redis;
  }

  function newPrefix(): string {
    const prefix = `test:esi-limiter:${randomUUID()}:`;
    prefixes.push(prefix);
    return prefix;
  }

  // Delete only this test's own keys; the Redis is shared with other data.
  afterEach(async () => {
    const redis = connections[0] ?? connect();
    for (const prefix of prefixes.splice(0)) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== '0');
    }
  });

  afterAll(async () => {
    await Promise.all(connections.map((redis) => redis.quit()));
  });

  describe.each(scenarios)('$name', (scenario) => {
    it('produces the expected results', async () => {
      const prefix = newPrefix();
      const stores = {
        a: new SharedLimiterStore(connect(), {
          maxRps: scenario.maxRps,
          prefix,
        }),
        b: new SharedLimiterStore(connect(), {
          maxRps: scenario.maxRps,
          prefix,
        }),
        c: new SharedLimiterStore(connect(), {
          maxRps: scenario.maxRps,
          prefix,
        }),
      };

      for (const [index, step] of scenario.steps.entries()) {
        const store = stores[step.client];
        const label = `step ${index + 1} (${step.client} ${step.op})`;
        if (step.op === 'acquire') {
          const priority = step.priority ?? 'bulk';
          const bucketKey = step.bucketKey ?? '';
          if (step.repeat !== undefined) {
            let grantedCount = 0;
            for (let i = 0; i < step.repeat; i++) {
              const result = await store.acquire(
                priority,
                step.template,
                bucketKey,
                step.now + i * (step.everyMs ?? 0),
              );
              if (result.granted) grantedCount++;
            }
            expect({ grantedCount }, label).toEqual(step.expect);
          } else {
            const result = await store.acquire(
              priority,
              step.template,
              bucketKey,
              step.now,
            );
            expectPartial(result, step.expect, label);
          }
        } else {
          const result = await store.observe(
            {
              template: step.template,
              bucketKey: step.bucketKey ?? '',
              status: step.status!,
              group: step.group,
              limit: step.limit,
              windowMs: step.windowMs,
              remaining: step.remaining,
              errorRemain: step.errorRemain,
              errorResetMs: step.errorResetMs,
              retryAfterMs: step.retryAfterMs,
            },
            step.now,
          );
          expectPartial(result, step.expect, label);
        }
      }
    });
  });

  it('grants on Redis TIME when no now is given', async () => {
    const store = new SharedLimiterStore(connect(), {
      maxRps: 50,
      prefix: newPrefix(),
    });

    expect(await store.acquire('bulk', '/universe/types/{id}/', '')).toEqual({
      granted: true,
    });
  });

  it('reloads the script with EVAL when EVALSHA answers NOSCRIPT', async () => {
    const redis = connect();
    let evalshaCalls = 0;
    // Stand in for a Redis whose script cache was flushed, without flushing it.
    (redis as unknown as { evalsha: (...args: unknown[]) => never }).evalsha =
      () => {
        evalshaCalls++;
        throw new Error('NOSCRIPT No matching script. Please use EVAL.');
      };
    const store = new SharedLimiterStore(redis, {
      maxRps: 50,
      prefix: newPrefix(),
    });

    expect(await store.acquire('bulk', '/universe/types/{id}/', '')).toEqual({
      granted: true,
    });
    expect(evalshaCalls).toBe(1);
  });

  it('keeps its keys out of the response-cache invalidate pattern', async () => {
    const redis = connect();
    // Under the real prefix, so the keys look like production ones, but on a
    // test-only sub-prefix so live limiter state is never touched.
    const prefix = `${KEY_PREFIX}test:${randomUUID()}:`;
    prefixes.push(prefix);
    const store = new SharedLimiterStore(redis, { maxRps: 50, prefix });

    await store.observe({
      template: '/killmails/{id}/{hash}/',
      bucketKey: '123',
      status: 200,
      group: 'killmail',
    });
    expect(await redis.exists(`${prefix}bucket:killmail:123`)).toBe(1);

    const matched = await redis.keys('*Killmail:123*');
    expect(matched.filter((key) => key.startsWith(KEY_PREFIX))).toEqual([]);
  });

  it('expires a group bucket windowMs + 1 minute after it was observed', async () => {
    const redis = connect();
    const prefix = newPrefix();
    const store = new SharedLimiterStore(redis, { maxRps: 50, prefix });

    await store.observe({
      template: '/killmails/{id}/{hash}/',
      bucketKey: '',
      status: 200,
      group: 'killmail',
      limit: 150,
      windowMs: 900_000,
      remaining: 100,
    });

    const ttl = await redis.pttl(`${prefix}bucket:killmail:`);
    expect(ttl).toBeGreaterThan(960_000 - 5_000);
    expect(ttl).toBeLessThanOrEqual(960_000);
  });
});
