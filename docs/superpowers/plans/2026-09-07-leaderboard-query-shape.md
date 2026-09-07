# Leaderboard Query Reshape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the leaderboard period out of nine query names into a shared `TopFilter`, and rename the queries after their subject and the side of the killmail they read.

**Architecture:** A pure `resolvePeriod(period, anchor, now)` helper turns a `LeaderboardPeriod` enum value plus an optional anchor string into an inclusive `{startDate, endDate}` pair, an `isLive` flag and a cache TTL. Every resolver then follows the same seven steps — clamp limit, resolve period, build a fully-parameterised cache key, run one of three SQL shapes, return early when empty, batch-load entities into a `Map`, cache with the resolved TTL. Nine queries, nine input types and nine output types become five, one and four.

**Tech Stack:** GraphQL Yoga, graphql-codegen (`typescript` + `typescript-resolvers`, enums emitted as TS `enum`), Prisma `$queryRaw`, Redis, Vitest 5, Next.js App Router with Apollo Client.

**Spec:** `docs/superpowers/specs/2026-09-07-leaderboard-query-shape-design.md`

## Global Constraints

- **Yarn only, never npm.** `yarn install`, `yarn add`, `yarn workspace backend codegen`.
- **Never edit generated files** — `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`. Change the `.graphql` source and re-run codegen.
- **Backend codegen must run before frontend codegen.** The frontend reads `../backend/src/generated-schema.graphql`.
- **No database migration in this plan.** No `prisma migrate` command of any kind runs here. This work touches only schema, resolvers and frontend.
- **Commit messages in English, no Claude attribution** (no `Co-Authored-By: Claude`, no "Generated with Claude Code" footer). Per `CLAUDE.md`.
- **Cache key format** is `{domain}:{action}:{param}:{param}` and **every** filter parameter must appear, or one query poisons another's cache.
- **`::BIGINT` columns come back from `$queryRaw` as JavaScript `BigInt`** and `JSON.stringify` throws on those — convert with `Number()` before caching.
- **Limit cap:** `Math.min(filter?.limit ?? 100, 100)`.
- **TTL:** live window 300 s, closed historical window 3600 s.
- **Test baseline before any change:** backend 482 tests / 17 files, frontend 250 tests / 21 files, all passing. `yarn test` from the repo root runs both. No task may reduce these counts except where it deletes a test alongside the code it covered.
- **Backend dev port is read from `backend/.env`** (`PORT`, currently 4010). Never hardcode 4000. Never kill by process name.
- **`yarn workspace frontend lint` is not clean and never has been.** On `main` it reports **148 errors and 85 warnings**, none of them in files this plan touches. The bar for every task is therefore *no new finding in a file you changed* — not a clean run. Do not fix unrelated lint errors; that is its own piece of work. `leaderboards/page.tsx` (3) and `WeeklyTopCharCard.tsx` (1) carry pre-existing `no-img-element` warnings whose counts are identical on `main`; leave them.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `backend/src/resolvers/leaderboard/period.ts` | `getWeekMonday`, `resolvePeriod`, `ResolvedPeriod`. Pure date arithmetic, no I/O. |
| `backend/src/resolvers/leaderboard/period.spec.ts` | Unit tests for the above. |
| `backend/src/resolvers/leaderboard/queries.spec.ts` | Resolver tests: emitted SQL, cache keys, TTLs, BigInt handling. |
| `frontend/src/graphql/TopCorporations.graphql` | Replaces `TopLast7DaysCorporations.graphql`. |
| `frontend/src/graphql/TopAlliances.graphql` | Replaces `TopLast7DaysAlliances.graphql`. |
| `frontend/src/graphql/TopAttackerShips.graphql` | Replaces `TopLast7DaysAttackerShips.graphql`. |
| `frontend/src/graphql/TopDestroyedShips.graphql` | Replaces `TopLast7DaysShips.graphql`. |

**Modified:**

| File | Change |
| --- | --- |
| `backend/src/schemas/Leaderboard.graphql` | Whole file rewritten across Tasks 1, 3, 4, 5. |
| `backend/src/resolvers/leaderboard/queries.ts` | Nine resolvers become five. |
| `frontend/src/graphql/TopPilots.graphql` | Absorbs the four other pilot documents. |
| `frontend/src/app/leaderboards/page.tsx` | Four hooks become one, called four times. |
| `frontend/src/components/WeeklyTopCharCard/WeeklyTopCharCard.tsx` | `useTopWeeklyPilotsQuery` → `useTopPilotsQuery`. |
| `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx` | Five hooks renamed. |
| `backend/docs/leaderboards/leaderboard-queries.md` | Query names and shapes. |
| `backend/docs/leaderboards/leaderboards.md` | Query names. |
| `CLAUDE.md` | Correct the stale "no test runner" claim. |

**Deleted:**

`frontend/src/graphql/TopWeeklyPilots.graphql`, `TopMonthlyPilots.graphql`, `Top90DaysPilots.graphql`, `TopLast7DaysPilots.graphql`, `TopLast7DaysCorporations.graphql`, `TopLast7DaysAlliances.graphql`, `TopLast7DaysShips.graphql`, `TopLast7DaysAttackerShips.graphql`.

---

### Task 1: Capture the baseline, then add `TopFilter` to the schema

The schema additions here are purely additive — no existing query changes — so the build and every existing frontend document keep working. The baseline capture must happen **before** anything else in this plan, because it is the "before" side of the behavioural comparison in Task 6.

**Files:**
- Modify: `backend/src/schemas/Leaderboard.graphql`

**Interfaces:**
- Produces: GraphQL `enum LeaderboardPeriod { TODAY WEEK MONTH LAST_7_DAYS LAST_90_DAYS }` and `input TopFilter { period, anchor, limit, systemId, constellationId, regionId }`. Codegen emits these as `LeaderboardPeriod` (a TS `enum` with string values) and `TopFilter` in `backend/src/generated-types.ts`. Task 2 imports `LeaderboardPeriod` from `@generated-types`.

- [ ] **Step 1: Start the backend on the port from `.env`**

```bash
cd /Users/umut/Sites/killreport
yarn dev:backend
```

Leave it running in its own terminal. Confirm the port:

```bash
grep -m1 '^PORT' backend/.env
```

Expected: `PORT=4010` (use whatever this prints as `$PORT` below; do not assume 4000).

- [ ] **Step 2: Capture the "before" output of all nine queries**

```bash
mkdir -p .superpowers/sdd/2026-09-07-leaderboard-query-shape/baseline
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2- | tr -d '"')

q() {
  curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' \
    -d "{\"query\":\"$1\"}" > ".superpowers/sdd/2026-09-07-leaderboard-query-shape/baseline/$2.json"
  echo "$2: $(head -c 120 .superpowers/sdd/2026-09-07-leaderboard-query-shape/baseline/$2.json)"
}

q '{ topPilots(filter:{limit:10}){ rank killCount character{ id name } } }' topPilots
q '{ topWeeklyPilots(filter:{limit:10}){ rank killCount character{ id name } } }' topWeeklyPilots
q '{ topMonthlyPilots(filter:{limit:10}){ rank killCount character{ id name } } }' topMonthlyPilots
q '{ top90DaysPilots(filter:{limit:10}){ rank killCount character{ id name } } }' top90DaysPilots
q '{ topLast7DaysPilots(filter:{limit:10}){ rank killCount character{ id name } } }' topLast7DaysPilots
q '{ topLast7DaysCorporations(filter:{limit:10}){ rank killCount corporation{ id name } } }' topLast7DaysCorporations
q '{ topLast7DaysAlliances(filter:{limit:10}){ rank killCount alliance{ id name } } }' topLast7DaysAlliances
q '{ topLast7DaysShips(filter:{limit:10}){ rank killCount shipType{ id name } } }' topLast7DaysShips
q '{ topLast7DaysAttackerShips(filter:{limit:10}){ rank killCount shipType{ id name } } }' topLast7DaysAttackerShips
```

Expected: nine JSON files, none containing an `"errors"` key. Verify:

```bash
grep -l '"errors"' .superpowers/sdd/2026-09-07-leaderboard-query-shape/baseline/*.json || echo "all nine clean"
```

Expected: `all nine clean`.

- [ ] **Step 3: Also capture the spatially-filtered attacker-ships failure**

```bash
curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' \
  -d '{"query":"query($f: TopLast7DaysAttackerShipsFilter){ topLast7DaysAttackerShips(filter:$f){ rank killCount } }","variables":{"f":{"limit":3,"systemId":30000142}}}'
```

Expected: an error mentioning `Field "systemId" is not defined by type "TopLast7DaysAttackerShipsFilter"`. This is the bug Task 5 fixes; recording it now proves the fix later.

- [ ] **Step 4: Add the enum and the shared filter to the schema**

Add at the top of `backend/src/schemas/Leaderboard.graphql`, above the existing types:

```graphql
enum LeaderboardPeriod {
  TODAY
  WEEK
  MONTH
  LAST_7_DAYS
  LAST_90_DAYS
}

input TopFilter {
  """
  Defaults to LAST_7_DAYS.
  """
  period: LeaderboardPeriod
  """
  Anchors the period. YYYY-MM-DD for TODAY, any day of the target week for
  WEEK (rounded back to its Monday), YYYY-MM for MONTH. Ignored by the rolling
  windows LAST_7_DAYS and LAST_90_DAYS. Empty means today / this week / this month.
  """
  anchor: String
  """
  Max 100; default 100
  """
  limit: Int
  systemId: Int
  constellationId: Int
  regionId: Int
}
```

Leave every existing type, input and query field untouched in this task.

- [ ] **Step 5: Regenerate and verify nothing broke**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend codegen
yarn workspace backend build
yarn test
```

Expected: codegen succeeds, `tsc --noEmit` clean, 482 backend + 250 frontend tests pass.

- [ ] **Step 6: Confirm the enum landed as a TS enum**

```bash
grep -n "export enum LeaderboardPeriod" -A 7 backend/src/generated-types.ts
```

Expected: an `export enum LeaderboardPeriod` block with five members. Task 2 depends on this being an enum, not a string union.

- [ ] **Step 7: Commit**

```bash
git add backend/src/schemas/Leaderboard.graphql backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(graphql): add LeaderboardPeriod and the shared TopFilter input

Additive only: nothing consumes them yet, so every existing query keeps
its own filter type and behaviour. The reshape lands subject by subject
in the commits that follow."
```

---

### Task 2: The `resolvePeriod` helper

Pure date arithmetic, no I/O, so this is straight TDD. It also takes `getWeekMonday` out of `queries.ts`, where it currently sits as a file-local function.

**Files:**
- Create: `backend/src/resolvers/leaderboard/period.ts`
- Create: `backend/src/resolvers/leaderboard/period.spec.ts`
- Modify: `backend/src/resolvers/leaderboard/queries.ts` (delete the local `getWeekMonday`, import it instead)

**Interfaces:**
- Consumes: `LeaderboardPeriod` from `@generated-types` (Task 1).
- Produces:
  - `getWeekMonday(dateStr: string): string`
  - `interface ResolvedPeriod { startDate: string; endDate: string; isLive: boolean; cacheTtl: number; cacheAnchor: string }`
  - `resolvePeriod(period: LeaderboardPeriod, anchor?: string | null, now?: Date): ResolvedPeriod`

  `startDate` and `endDate` are both `YYYY-MM-DD` and both **inclusive**. Tasks 3–5 use them as `kill_date >= startDate AND kill_date <= endDate` (shape A) and `killmail_time >= startDate AND killmail_time < endDate + INTERVAL '1 day'` (shapes B and C).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/resolvers/leaderboard/period.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { LeaderboardPeriod } from '@generated-types';

import { getWeekMonday, resolvePeriod } from './period';

/** A fixed Wednesday, so week arithmetic has something to round back from. */
const NOW = new Date('2026-09-09T11:30:00.000Z');

describe('getWeekMonday', () => {
  it('rounds a mid-week day back to its Monday', () => {
    expect(getWeekMonday('2026-09-09')).toBe('2026-09-07');
  });

  it('leaves a Monday where it is', () => {
    expect(getWeekMonday('2026-09-07')).toBe('2026-09-07');
  });

  it('rounds Sunday back six days, not forward one', () => {
    expect(getWeekMonday('2026-09-13')).toBe('2026-09-07');
  });
});

describe('resolvePeriod TODAY', () => {
  it('spans a single day and is live when the anchor is today', () => {
    expect(resolvePeriod(LeaderboardPeriod.Today, null, NOW)).toEqual({
      startDate: '2026-09-09',
      endDate: '2026-09-09',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09-09',
    });
  });

  it('is not live for a past day and caches it for an hour', () => {
    expect(resolvePeriod(LeaderboardPeriod.Today, '2026-09-01', NOW)).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      isLive: false,
      cacheTtl: 3600,
      cacheAnchor: '2026-09-01',
    });
  });
});

describe('resolvePeriod WEEK', () => {
  it('spans Monday to Sunday of the current week and is live', () => {
    expect(resolvePeriod(LeaderboardPeriod.Week, null, NOW)).toEqual({
      startDate: '2026-09-07',
      endDate: '2026-09-13',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09-07',
    });
  });

  it('rounds any day of a past week back to its Monday', () => {
    expect(resolvePeriod(LeaderboardPeriod.Week, '2026-09-03', NOW)).toEqual({
      startDate: '2026-08-31',
      endDate: '2026-09-06',
      isLive: false,
      cacheTtl: 3600,
      cacheAnchor: '2026-08-31',
    });
  });
});

describe('resolvePeriod MONTH', () => {
  it('spans the whole current month and is live', () => {
    expect(resolvePeriod(LeaderboardPeriod.Month, null, NOW)).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09',
    });
  });

  it('handles a 31-day past month', () => {
    expect(resolvePeriod(LeaderboardPeriod.Month, '2026-07', NOW)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      isLive: false,
      cacheTtl: 3600,
      cacheAnchor: '2026-07',
    });
  });

  it('handles December without rolling the year wrong', () => {
    expect(resolvePeriod(LeaderboardPeriod.Month, '2025-12', NOW)).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      isLive: false,
      cacheTtl: 3600,
      cacheAnchor: '2025-12',
    });
  });

  it('handles a leap February', () => {
    expect(resolvePeriod(LeaderboardPeriod.Month, '2024-02', NOW).endDate).toBe(
      '2024-02-29',
    );
  });
});

describe('resolvePeriod rolling windows', () => {
  it('LAST_7_DAYS covers today and the six days before it', () => {
    expect(resolvePeriod(LeaderboardPeriod.Last_7Days, null, NOW)).toEqual({
      startDate: '2026-09-03',
      endDate: '2026-09-09',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09-09',
    });
  });

  it('LAST_90_DAYS covers today and the 89 days before it', () => {
    expect(resolvePeriod(LeaderboardPeriod.Last_90Days, null, NOW)).toEqual({
      startDate: '2026-06-12',
      endDate: '2026-09-09',
      isLive: true,
      cacheTtl: 300,
      cacheAnchor: '2026-09-09',
    });
  });

  it('ignores an anchor rather than letting it shift the window', () => {
    expect(
      resolvePeriod(LeaderboardPeriod.Last_7Days, '2020-01-01', NOW).startDate,
    ).toBe('2026-09-03');
  });
});

describe('resolvePeriod rejects a malformed anchor', () => {
  it('throws when TODAY gets a month string', () => {
    expect(() => resolvePeriod(LeaderboardPeriod.Today, '2026-09', NOW)).toThrow(
      /anchor/i,
    );
  });

  it('throws when MONTH gets a full date', () => {
    expect(() =>
      resolvePeriod(LeaderboardPeriod.Month, '2026-09-09', NOW),
    ).toThrow(/anchor/i);
  });

  it('throws on a non-date string', () => {
    expect(() => resolvePeriod(LeaderboardPeriod.Week, 'last week', NOW)).toThrow(
      /anchor/i,
    );
  });
});
```

The generated enum member names come from graphql-codegen's casing of `LAST_7_DAYS` and `LAST_90_DAYS`. If Step 2 shows they are not `Last_7Days` / `Last_90Days`, use whatever `backend/src/generated-types.ts` actually declares and fix the test file accordingly — do not rename the GraphQL enum values to suit the test.

- [ ] **Step 2: Run the tests to verify they fail, and read the real enum member names**

```bash
cd /Users/umut/Sites/killreport
grep -n "export enum LeaderboardPeriod" -A 7 backend/src/generated-types.ts
yarn workspace backend test src/resolvers/leaderboard/period.spec.ts
```

Expected: FAIL — `Failed to resolve import "./period"`. Correct any enum member names in the spec file to match the grep output before continuing.

- [ ] **Step 3: Write the implementation**

Create `backend/src/resolvers/leaderboard/period.ts`:

```typescript
import { LeaderboardPeriod } from '@generated-types';

/**
 * A resolved leaderboard window.
 *
 * Both dates are inclusive YYYY-MM-DD. Shape A (the daily *_kill_stats tables)
 * compares them against a date column directly; shapes B and C compare against
 * a timestamp and so use `< endDate + INTERVAL '1 day'` for the upper bound.
 */
export interface ResolvedPeriod {
  startDate: string;
  endDate: string;
  /** The window contains today, so its numbers can still change. */
  isLive: boolean;
  /** 300 s while live, 3600 s once the window has closed. */
  cacheTtl: number;
  /** Normalised anchor for the cache key: a date, a Monday, or YYYY-MM. */
  cacheAnchor: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/** Returns the Monday (UTC) of the week containing the given date string */
export function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function toDate(now: Date): string {
  return now.toISOString().split('T')[0];
}

function requireFormat(
  anchor: string,
  pattern: RegExp,
  period: LeaderboardPeriod,
  shape: string,
): void {
  if (!pattern.test(anchor)) {
    throw new Error(
      `Invalid anchor "${anchor}" for period ${period}: expected ${shape}.`,
    );
  }
}

export function resolvePeriod(
  period: LeaderboardPeriod,
  anchor?: string | null,
  now: Date = new Date(),
): ResolvedPeriod {
  const today = toDate(now);

  let startDate: string;
  let endDate: string;
  let cacheAnchor: string;

  switch (period) {
    case LeaderboardPeriod.Today: {
      if (anchor) requireFormat(anchor, DATE, period, 'YYYY-MM-DD');
      startDate = anchor ?? today;
      endDate = startDate;
      cacheAnchor = startDate;
      break;
    }

    case LeaderboardPeriod.Week: {
      if (anchor) requireFormat(anchor, DATE, period, 'YYYY-MM-DD');
      startDate = getWeekMonday(anchor ?? today);
      endDate = addDays(startDate, 6);
      cacheAnchor = startDate;
      break;
    }

    case LeaderboardPeriod.Month: {
      if (anchor) requireFormat(anchor, MONTH, period, 'YYYY-MM');
      const month = anchor ?? today.slice(0, 7);
      startDate = `${month}-01`;
      // Day 0 of the following month is the last day of this one, which also
      // gets February right in a leap year.
      const [y, m] = month.split('-').map(Number);
      endDate = toDate(new Date(Date.UTC(y, m, 0)));
      cacheAnchor = month;
      break;
    }

    case LeaderboardPeriod.Last_7Days: {
      startDate = addDays(today, -6);
      endDate = today;
      cacheAnchor = today;
      break;
    }

    case LeaderboardPeriod.Last_90Days: {
      startDate = addDays(today, -89);
      endDate = today;
      cacheAnchor = today;
      break;
    }
  }

  const isLive = startDate <= today && today <= endDate;

  return { startDate, endDate, isLive, cacheTtl: isLive ? 300 : 3600, cacheAnchor };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
yarn workspace backend test src/resolvers/leaderboard/period.spec.ts
```

Expected: PASS, all cases green.

- [ ] **Step 5: Take `getWeekMonday` out of `queries.ts`**

In `backend/src/resolvers/leaderboard/queries.ts`, delete the local function (currently just above `export const leaderboardQueries`):

```typescript
/** Returns the Monday (UTC) of the week containing the given date string */
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}
```

and add to the imports at the top of the file:

```typescript
import { getWeekMonday } from './period';
```

`topWeeklyPilots` still calls it; nothing else changes in this task.

- [ ] **Step 6: Verify the whole suite and the build**

```bash
yarn workspace backend build
yarn test
```

Expected: `tsc --noEmit` clean; backend test count now above 482 by the number of cases added, frontend still 250, all passing.

- [ ] **Step 7: Commit**

```bash
git add backend/src/resolvers/leaderboard/period.ts backend/src/resolvers/leaderboard/period.spec.ts backend/src/resolvers/leaderboard/queries.ts
git commit -m "feat(leaderboard): add resolvePeriod and move getWeekMonday out of queries.ts

resolvePeriod turns a LeaderboardPeriod and an optional anchor into an
inclusive date range plus the isLive flag the TTL rule needs. The date
arithmetic the nine resolvers currently repeat inline now lives in one
tested place; no resolver uses it yet."
```

---

### Task 3: Reshape `topPilots`, retire the other four pilot queries

The largest task, because pilots is the only subject with all five periods today and it has four call sites. Schema, resolver, frontend documents and every consumer move together — splitting them would leave the build broken between commits.

**Files:**
- Modify: `backend/src/schemas/Leaderboard.graphql`
- Modify: `backend/src/resolvers/leaderboard/queries.ts`
- Create: `backend/src/resolvers/leaderboard/queries.spec.ts`
- Modify: `frontend/src/graphql/TopPilots.graphql`
- Delete: `frontend/src/graphql/TopWeeklyPilots.graphql`, `TopMonthlyPilots.graphql`, `Top90DaysPilots.graphql`, `TopLast7DaysPilots.graphql`
- Modify: `frontend/src/app/leaderboards/page.tsx`
- Modify: `frontend/src/components/WeeklyTopCharCard/WeeklyTopCharCard.tsx`
- Modify: `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`

**Interfaces:**
- Consumes: `resolvePeriod`, `ResolvedPeriod` (Task 2); `LeaderboardPeriod`, `TopFilter` (Task 1).
- Produces: `Query.topPilots(filter: TopFilter): [TopPilot!]!`. Frontend hook `useTopPilotsQuery`, result field `data.topPilots`. Tasks 4 and 5 copy this resolver's seven-step skeleton and the test file's mocking harness.

- [ ] **Step 1: Write the failing resolver tests**

Create `backend/src/resolvers/leaderboard/queries.spec.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The leaderboard resolvers are thin: cache read, one raw query, a batched
 * entity lookup, cache write. What is worth pinning down is the SQL they emit
 * and the cache key they emit it under — a missing filter parameter in the key
 * lets one query serve another's rows.
 */

const { prisma, redis } = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    character: { findMany: vi.fn() },
    corporation: { findMany: vi.fn() },
    alliance: { findMany: vi.fn() },
    type: { findMany: vi.fn() },
  },
  redis: { get: vi.fn(), setex: vi.fn() },
}));

vi.mock('@services/prisma', () => ({ default: prisma }));
vi.mock('@services/redis', () => ({ default: redis, redis }));

import { LeaderboardPeriod } from '@generated-types';

import { leaderboardQueries } from './queries';

/** The SQL text of the nth $queryRaw call, values replaced by "?". */
function querySql(call = 0) {
  const [strings] = prisma.$queryRaw.mock.calls[call] as [TemplateStringsArray];
  return strings.join(' ? ').replace(/\s+/g, ' ');
}

/** The values spliced into the tagged template of the nth $queryRaw call. */
function queryValues(call = 0) {
  const [, ...values] = prisma.$queryRaw.mock.calls[call] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return values;
}

/** Calls a resolver with the parent/context/info arguments it ignores. */
function call(name: keyof typeof leaderboardQueries, filter: unknown) {
  const resolver = leaderboardQueries[name] as unknown as (
    parent: unknown,
    args: unknown,
    context: unknown,
    info: unknown,
  ) => Promise<unknown>;
  return resolver(undefined, { filter }, {}, {});
}

/** A character row as Prisma returns it. */
function characterRow(id: number) {
  return {
    id,
    name: `Pilot ${id}`,
    security_status: 1.5,
    birthday: new Date('2020-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-09-01T00:00:00.000Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.get.mockResolvedValue(null);
  redis.setex.mockResolvedValue('OK');
  prisma.$queryRaw.mockResolvedValue([]);
  prisma.character.findMany.mockResolvedValue([]);
  prisma.corporation.findMany.mockResolvedValue([]);
  prisma.alliance.findMany.mockResolvedValue([]);
  prisma.type.findMany.mockResolvedValue([]);
});

describe('topPilots', () => {
  it('serves a cache hit without touching the database', async () => {
    const cached = [{ rank: 1, killCount: 9, character: null }];
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(call('topPilots', { limit: 10 })).resolves.toEqual(cached);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('defaults to the last 7 days and reads the daily stats table', async () => {
    await call('topPilots', { limit: 10 });

    expect(querySql()).toContain('FROM character_kill_stats');
    expect(querySql()).toContain('SUM(kill_count)');
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topPilots', {
      period: LeaderboardPeriod.Week,
      anchor: '2026-09-03',
      limit: 25,
      systemId: 30000142,
      constellationId: 20000020,
      regionId: 10000002,
    });

    const [key] = redis.get.mock.calls[0];
    expect(key).toBe(
      'leaderboard:topPilots:WEEK:2026-08-31:25:30000142:20000020:10000002',
    );
  });

  it('switches to the killmail_filters join when a system is given', async () => {
    await call('topPilots', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain('FROM attackers a');
    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(querySql()).toContain('COUNT(DISTINCT kf.killmail_id)');
    expect(queryValues()).toContain(30000142);
  });

  it('bounds the upper edge with < next day, not <=', async () => {
    await call('topPilots', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain("< ? ::date + INTERVAL '1 day'");
    expect(querySql()).not.toContain("<= ? ::date + INTERVAL '1 day'");
  });

  it('caps the limit at 100', async () => {
    await call('topPilots', { limit: 5000 });

    expect(queryValues()).toContain(100);
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { character_id: 42, kill_count: 7n },
    ]);
    prisma.character.findMany.mockResolvedValue([characterRow(42)]);

    const result = (await call('topPilots', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(7);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('caches a live window for 300 s and a closed one for 3600 s', async () => {
    // setex is only reached when there are rows to cache.
    prisma.$queryRaw.mockResolvedValue([
      { character_id: 42, kill_count: 7n },
    ]);
    prisma.character.findMany.mockResolvedValue([characterRow(42)]);

    await call('topPilots', { period: LeaderboardPeriod.Today, limit: 10 });
    expect(redis.setex.mock.calls[0][1]).toBe(300);

    await call('topPilots', {
      period: LeaderboardPeriod.Today,
      anchor: '2020-01-01',
      limit: 10,
    });
    expect(redis.setex.mock.calls[1][1]).toBe(3600);
  });

  it('returns an empty list without a lookup when there are no rows', async () => {
    await expect(call('topPilots', { limit: 10 })).resolves.toEqual([]);
    expect(prisma.character.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
```

Expected: FAIL — the cache-key test reports the old `leaderboard:topPilots:2026-09-09:10` format, and the join/boundary tests fail because `topPilots` still reads a single day.

- [ ] **Step 3: Reshape the schema**

In `backend/src/schemas/Leaderboard.graphql`, delete these types and inputs entirely:

`TopWeeklyPilot`, `TopWeeklyPilotsFilter`, `TopMonthlyPilot`, `TopMonthlyPilotsFilter`, `Top90DaysPilot`, `Top90DaysPilotsFilter`, `TopLast7DaysPilot`, `TopLast7DaysPilotsFilter`, `TopPilotsFilter`.

Keep `TopPilot` as it is. In the `extend type Query` block, delete the `topWeeklyPilots`, `topMonthlyPilots`, `top90DaysPilots` and `topLast7DaysPilots` fields, and change `topPilots` to:

```graphql
  """
  Top pilots by kill count over the window named by filter.period.
  """
  topPilots(filter: TopFilter): [TopPilot!]!
```

- [ ] **Step 4: Replace the five pilot resolvers with one**

In `backend/src/resolvers/leaderboard/queries.ts`, delete `topWeeklyPilots`, `topMonthlyPilots`, `top90DaysPilots` and `topLast7DaysPilots`, and replace `topPilots` with:

```typescript
  topPilots: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topPilots:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { character_id: number; kill_count: bigint };
    let rows: Row[];

    if (systemId || constellationId || regionId) {
      // Shape B: the daily stats table carries no location, so a spatial
      // filter has to go back to the killmails themselves.
      rows = await prisma.$queryRaw<Row[]>`
        SELECT a.character_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
        FROM attackers a
        INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
        WHERE kf.killmail_time >= ${startDate}::date
          AND kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
          AND a.character_id IS NOT NULL
          ${systemId ? Prisma.sql`AND kf.solar_system_id = ${systemId}` : Prisma.empty}
          ${constellationId ? Prisma.sql`AND kf.constellation_id = ${constellationId}` : Prisma.empty}
          ${regionId ? Prisma.sql`AND kf.region_id = ${regionId}` : Prisma.empty}
        GROUP BY a.character_id
        ORDER BY kill_count DESC
        LIMIT ${limit}
      `;
    } else {
      // Shape A: pre-aggregated daily counts, one index scan.
      rows = await prisma.$queryRaw<Row[]>`
        SELECT character_id, SUM(kill_count)::BIGINT AS kill_count
        FROM   character_kill_stats
        WHERE  kill_date >= ${startDate}::date
          AND  kill_date <= ${endDate}::date
        GROUP  BY character_id
        ORDER  BY kill_count DESC
        LIMIT  ${limit}
      `;
    }

    if (rows.length === 0) return [];

    const characterIds = rows.map((r) => r.character_id);
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds } },
    });
    const charMap = new Map(characters.map((c) => [c.id, c]));

    const result = rows.map((row, idx) => {
      const char = charMap.get(row.character_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        character: char
          ? {
              ...char,
              securityStatus: char.security_status ?? null,
              birthday: char.birthday.toISOString(),
              updatedAt: char.updated_at?.toISOString() ?? null,
            }
          : null,
      };
    });

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },
```

Update the imports at the top of the file:

```typescript
import { LeaderboardPeriod, QueryResolvers } from '@generated-types';
import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';

import { resolvePeriod } from './period';
```

The `getWeekMonday` import added in Task 2 goes away with `topWeeklyPilots`; remove it.

Note the `SUM(kill_count)::BIGINT` cast in shape A. The old `topPilots` read a single row per date and got a plain `number`; summing a range returns `BigInt`, which is why `Number()` is now required and why the BigInt test exists.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
yarn workspace backend codegen
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
yarn workspace backend build
```

Expected: all `topPilots` tests PASS, `tsc --noEmit` clean.

- [ ] **Step 6: Merge the five frontend pilot documents into one**

Replace the contents of `frontend/src/graphql/TopPilots.graphql` with the union of the five selections — only `TopPilots.graphql` selected `ticker`, and keeping it makes the merged document a superset, so no consumer loses a field:

```graphql
query TopPilots($filter: TopFilter) {
  topPilots(filter: $filter) {
    rank
    killCount
    character {
      id
      name
      securityStatus
      corporation {
        id
        name
        ticker
      }
      alliance {
        id
        name
        ticker
      }
    }
  }
}
```

Delete the other four:

```bash
cd /Users/umut/Sites/killreport
rm frontend/src/graphql/TopWeeklyPilots.graphql \
   frontend/src/graphql/TopMonthlyPilots.graphql \
   frontend/src/graphql/Top90DaysPilots.graphql \
   frontend/src/graphql/TopLast7DaysPilots.graphql
```

- [ ] **Step 7: Update the four call sites in the leaderboards page**

In `frontend/src/app/leaderboards/page.tsx`, replace the four imports:

```typescript
  useTop90DaysPilotsQuery,
  useTopMonthlyPilotsQuery,
  useTopPilotsQuery,
  useTopWeeklyPilotsQuery,
```

with:

```typescript
  LeaderboardPeriod,
  useTopPilotsQuery,
```

Then change each hook call and its result field:

`DailyLeaderboard`:

```typescript
  const { data, loading } = useTopPilotsQuery({
    variables: {
      filter: {
        period: LeaderboardPeriod.Today,
        anchor: selectedDate,
        limit: 10,
      },
    },
  });
```

`WeeklyLeaderboard`:

```typescript
  const { data, loading } = useTopPilotsQuery({
    variables: {
      filter: { period: LeaderboardPeriod.Week, anchor: weekStart, limit: 10 },
    },
  });
```

`Last90DaysLeaderboard`:

```typescript
  const { data, loading } = useTopPilotsQuery({
    variables: { filter: { period: LeaderboardPeriod.Last_90Days, limit: 10 } },
  });
```

`MonthlyLeaderboard`:

```typescript
  const { data, loading } = useTopPilotsQuery({
    variables: { filter: { period: LeaderboardPeriod.Month, anchor: month, limit: 10 } },
  });
```

Then replace every read of the old result fields with `data?.topPilots`:

```bash
grep -n "topWeeklyPilots\|topMonthlyPilots\|top90DaysPilots\|topLast7DaysPilots" frontend/src/app/leaderboards/page.tsx
```

Each hit is a `data?.<oldField>` read; change it to `data?.topPilots`.

`DailyLeaderboard` passed `date: selectedDate` before and now passes `anchor: selectedDate` with `period: TODAY` — same window, same numbers.

- [ ] **Step 8: Update `WeeklyTopCharCard`**

In `frontend/src/components/WeeklyTopCharCard/WeeklyTopCharCard.tsx`:

```typescript
import { LeaderboardPeriod, useTopPilotsQuery } from '@/generated/graphql';
```

```typescript
  const { data, loading } = useTopPilotsQuery({
    variables: { filter: { period: LeaderboardPeriod.Week, limit: 10 } },
  });

  const pilots = data?.topPilots ?? [];
```

- [ ] **Step 9: Update the sidebar's pilot hook**

In `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`, change the import and the hook:

```typescript
import {
  LeaderboardPeriod,
  useTopPilotsQuery,
  useTopLast7DaysAlliancesQuery,
  useTopLast7DaysAttackerShipsQuery,
  useTopLast7DaysCorporationsQuery,
  useTopLast7DaysShipsQuery,
} from '@/generated/graphql';
```

```typescript
  const { data: pilots, loading: pilotsLoading } = useTopPilotsQuery({
    variables: { filter: { period: LeaderboardPeriod.Last_7Days, ...variables.filter } },
    skip: !has('characters'),
  });
```

and the read below it:

```typescript
                  pilots?.topPilots?.map((pilot) => ({
```

The other four hooks keep their old names until Tasks 4 and 5.

- [ ] **Step 10: Verify the frontend**

```bash
cd /Users/umut/Sites/killreport
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
yarn test
```

Expected: codegen succeeds, build succeeds, all tests pass. Lint reports the repo's pre-existing 148 errors / 85 warnings — confirm none of them names a file you changed, and do not try to reach zero.

- [ ] **Step 11: Commit**

```bash
git add -A backend/src frontend/src
git commit -m "refactor(leaderboard): fold the five pilot queries into topPilots

topPilots now takes TopFilter and covers every window the four deleted
queries covered: TODAY with a date anchor, WEEK with any day of the
target week, MONTH, and the two rolling windows. Five identical output
types and five filter inputs collapse to one of each, and the five
frontend documents to one whose selection is their union — only the
daily one asked for ticker, so keeping it loses nobody a field.

The upper bound moves from <= endDate + 1 day to < endDate + 1 day,
which drops a kill landing exactly at the next midnight. Shape A now
sums over a range rather than reading one row, so its count arrives as
BigInt and is converted before caching."
```

---

### Task 4: Reshape `topCorporations` and `topAlliances`

Both are mechanical copies of the `topPilots` skeleton against their own stats table and entity, and neither has a period other than the rolling week today. They travel together because they are the same edit twice and share one sidebar file.

**Files:**
- Modify: `backend/src/schemas/Leaderboard.graphql`
- Modify: `backend/src/resolvers/leaderboard/queries.ts`
- Modify: `backend/src/resolvers/leaderboard/queries.spec.ts`
- Create: `frontend/src/graphql/TopCorporations.graphql`, `frontend/src/graphql/TopAlliances.graphql`
- Delete: `frontend/src/graphql/TopLast7DaysCorporations.graphql`, `frontend/src/graphql/TopLast7DaysAlliances.graphql`
- Modify: `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`

**Interfaces:**
- Consumes: `resolvePeriod` (Task 2); the `querySql` / `queryValues` / `call` helpers in `queries.spec.ts` (Task 3).
- Produces: `Query.topCorporations(filter: TopFilter): [TopCorporation!]!` and `Query.topAlliances(filter: TopFilter): [TopAlliance!]!`. Frontend hooks `useTopCorporationsQuery` / `useTopAlliancesQuery`, result fields `data.topCorporations` / `data.topAlliances`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/resolvers/leaderboard/queries.spec.ts`:

```typescript
describe('topCorporations', () => {
  it('reads the corporation stats table by default', async () => {
    await call('topCorporations', { limit: 10 });

    expect(querySql()).toContain('FROM corporation_kill_stats');
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topCorporations', {
      period: LeaderboardPeriod.Month,
      anchor: '2026-07',
      limit: 25,
      regionId: 10000002,
    });

    const [key] = redis.get.mock.calls[0];
    expect(key).toBe('leaderboard:topCorporations:MONTH:2026-07:25:::10000002');
  });

  it('joins killmail_filters when a region is given', async () => {
    await call('topCorporations', { limit: 10, regionId: 10000002 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(querySql()).toContain('COUNT(DISTINCT kf.killmail_id)');
    expect(queryValues()).toContain(10000002);
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { corporation_id: 98000001, kill_count: 4n },
    ]);
    prisma.corporation.findMany.mockResolvedValue([
      { id: 98000001, name: 'Corp', shares: null, updated_at: null },
    ]);

    const result = (await call('topCorporations', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(4);
  });
});

describe('topAlliances', () => {
  it('reads the alliance stats table by default', async () => {
    await call('topAlliances', { limit: 10 });

    expect(querySql()).toContain('FROM alliance_kill_stats');
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topAlliances', { limit: 10, systemId: 30000142 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topAlliances:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:30000142::$/,
    );
  });

  it('joins killmail_filters when a system is given', async () => {
    await call('topAlliances', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
```

Expected: FAIL — `leaderboardQueries.topCorporations` is not a function.

- [ ] **Step 3: Reshape the schema**

In `backend/src/schemas/Leaderboard.graphql`:

- Rename `type TopLast7DaysCorporation` to `type TopCorporation` and `type TopLast7DaysAlliance` to `type TopAlliance`.
- Delete `input TopLast7DaysCorporationsFilter` and `input TopLast7DaysAlliancesFilter`.
- In `extend type Query`, replace the two fields with:

```graphql
  """
  Top corporations by kill count over the window named by filter.period.
  """
  topCorporations(filter: TopFilter): [TopCorporation!]!

  """
  Top alliances by kill count over the window named by filter.period.
  """
  topAlliances(filter: TopFilter): [TopAlliance!]!
```

- [ ] **Step 4: Rewrite the two resolvers**

In `backend/src/resolvers/leaderboard/queries.ts`, replace `topLast7DaysCorporations` with:

```typescript
  topCorporations: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topCorporations:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { corporation_id: number; kill_count: bigint };
    let rows: Row[];

    if (systemId || constellationId || regionId) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT a.corporation_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
        FROM attackers a
        INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
        WHERE kf.killmail_time >= ${startDate}::date
          AND kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
          AND a.corporation_id IS NOT NULL
          ${systemId ? Prisma.sql`AND kf.solar_system_id = ${systemId}` : Prisma.empty}
          ${constellationId ? Prisma.sql`AND kf.constellation_id = ${constellationId}` : Prisma.empty}
          ${regionId ? Prisma.sql`AND kf.region_id = ${regionId}` : Prisma.empty}
        GROUP BY a.corporation_id
        ORDER BY kill_count DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT corporation_id, SUM(kill_count)::BIGINT AS kill_count
        FROM   corporation_kill_stats
        WHERE  kill_date >= ${startDate}::date
          AND  kill_date <= ${endDate}::date
        GROUP  BY corporation_id
        ORDER  BY kill_count DESC
        LIMIT  ${limit}
      `;
    }

    if (rows.length === 0) return [];

    const corporationIds = rows.map((r) => r.corporation_id);
    const corporations = await prisma.corporation.findMany({
      where: { id: { in: corporationIds } },
    });
    const corpMap = new Map(corporations.map((c) => [c.id, c]));

    const result = rows.map((row, idx) => {
      const corp = corpMap.get(row.corporation_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        corporation: corp
          ? {
              ...corp,
              shares: corp.shares ? Number(corp.shares) : null,
              updatedAt: corp.updated_at?.toISOString() ?? null,
            }
          : null,
      };
    });

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },
```

and replace `topLast7DaysAlliances` with:

```typescript
  topAlliances: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topAlliances:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { alliance_id: number; kill_count: bigint };
    let rows: Row[];

    if (systemId || constellationId || regionId) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT a.alliance_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
        FROM attackers a
        INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
        WHERE kf.killmail_time >= ${startDate}::date
          AND kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
          AND a.alliance_id IS NOT NULL
          ${systemId ? Prisma.sql`AND kf.solar_system_id = ${systemId}` : Prisma.empty}
          ${constellationId ? Prisma.sql`AND kf.constellation_id = ${constellationId}` : Prisma.empty}
          ${regionId ? Prisma.sql`AND kf.region_id = ${regionId}` : Prisma.empty}
        GROUP BY a.alliance_id
        ORDER BY kill_count DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT alliance_id, SUM(kill_count)::BIGINT AS kill_count
        FROM   alliance_kill_stats
        WHERE  kill_date >= ${startDate}::date
          AND  kill_date <= ${endDate}::date
        GROUP  BY alliance_id
        ORDER  BY kill_count DESC
        LIMIT  ${limit}
      `;
    }

    if (rows.length === 0) return [];

    const allianceIds = rows.map((r) => r.alliance_id);
    const alliances = await prisma.alliance.findMany({
      where: { id: { in: allianceIds } },
    });
    const allianceMap = new Map(alliances.map((a) => [a.id, a]));

    const result = rows.map((row, idx) => {
      const alliance = allianceMap.get(row.alliance_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        alliance: alliance
          ? {
              ...alliance,
              updatedAt: alliance.updated_at?.toISOString() ?? null,
            }
          : null,
      };
    });

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
yarn workspace backend codegen
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
yarn workspace backend build
```

Expected: PASS, `tsc --noEmit` clean.

- [ ] **Step 6: Rename the frontend documents**

```bash
cd /Users/umut/Sites/killreport
git mv frontend/src/graphql/TopLast7DaysCorporations.graphql frontend/src/graphql/TopCorporations.graphql
git mv frontend/src/graphql/TopLast7DaysAlliances.graphql frontend/src/graphql/TopAlliances.graphql
```

Then edit the two operation headers, leaving each selection set exactly as it is:

`frontend/src/graphql/TopCorporations.graphql`:

```graphql
query TopCorporations($filter: TopFilter) {
  topCorporations(filter: $filter) {
```

`frontend/src/graphql/TopAlliances.graphql`:

```graphql
query TopAlliances($filter: TopFilter) {
  topAlliances(filter: $filter) {
```

- [ ] **Step 7: Update the sidebar**

In `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`, change the two hooks and the two result reads:

```typescript
  const { data: corporations, loading: corporationsLoading } =
    useTopCorporationsQuery({
      variables: { filter: { period: LeaderboardPeriod.Last_7Days, ...variables.filter } },
      skip: !has('corporations'),
    });
  const { data: alliances, loading: alliancesLoading } = useTopAlliancesQuery({
    variables: { filter: { period: LeaderboardPeriod.Last_7Days, ...variables.filter } },
    skip: !has('alliances'),
  });
```

```typescript
                  corporations?.topCorporations?.map((corp) => ({
```

```typescript
                  alliances?.topAlliances?.map((alliance) => ({
```

and update the import list to `useTopCorporationsQuery` / `useTopAlliancesQuery`.

- [ ] **Step 8: Verify the frontend**

```bash
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
yarn test
```

Expected: codegen, build and tests green. Lint still reports the repo's
pre-existing 148 errors / 85 warnings; confirm none names a file you changed.

- [ ] **Step 9: Commit**

```bash
git add -A backend/src frontend/src
git commit -m "refactor(leaderboard): reshape topCorporations and topAlliances

Both take TopFilter now, so either can be asked for a day, a week, a
month or the two rolling windows instead of only the last seven days.
The dual source stays: the pre-aggregated daily table when no location
is given, the killmail_filters join when one is."
```

---

### Task 5: Reshape the two ship queries and fix the sidebar's broken card

`topLast7DaysAttackerShips` is the one resolver that joins `killmails` directly and the only filter without the spatial fields. Both change here, which is what makes the Most Used Ships card on `/solar-systems/[id]` render at all.

**Files:**
- Modify: `backend/src/schemas/Leaderboard.graphql`
- Modify: `backend/src/resolvers/leaderboard/queries.ts`
- Modify: `backend/src/resolvers/leaderboard/queries.spec.ts`
- Create: `frontend/src/graphql/TopDestroyedShips.graphql`, `frontend/src/graphql/TopAttackerShips.graphql`
- Delete: `frontend/src/graphql/TopLast7DaysShips.graphql`, `frontend/src/graphql/TopLast7DaysAttackerShips.graphql`
- Modify: `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`

**Interfaces:**
- Consumes: `resolvePeriod` (Task 2); the spec helpers from Task 3.
- Produces: `Query.topDestroyedShips(filter: TopFilter): [TopShip!]!` and `Query.topAttackerShips(filter: TopFilter): [TopShip!]!`, sharing one `TopShip` output type. Frontend hooks `useTopDestroyedShipsQuery` / `useTopAttackerShipsQuery`, result fields `data.topDestroyedShips` / `data.topAttackerShips`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/resolvers/leaderboard/queries.spec.ts`:

```typescript
describe('topDestroyedShips', () => {
  it('counts victim ships straight out of killmail_filters', async () => {
    await call('topDestroyedShips', { limit: 10 });

    expect(querySql()).toContain('FROM killmail_filters');
    expect(querySql()).toContain('victim_ship_type_id');
    expect(querySql()).not.toContain('FROM attackers');
  });

  it('bounds the upper edge with < next day', async () => {
    await call('topDestroyedShips', { limit: 10 });

    expect(querySql()).toContain("< ? ::date + INTERVAL '1 day'");
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topDestroyedShips', { limit: 10, constellationId: 20000020 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topDestroyedShips:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10::20000020:$/,
    );
  });
});

describe('topAttackerShips', () => {
  it('joins killmail_filters rather than killmails', async () => {
    await call('topAttackerShips', { limit: 10 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(querySql()).not.toContain('INNER JOIN killmails');
  });

  it('counts every attacker row, not distinct killmails', async () => {
    await call('topAttackerShips', { limit: 10 });

    expect(querySql()).toContain('COUNT(*)');
    expect(querySql()).not.toContain('COUNT(DISTINCT');
  });

  it('accepts a spatial filter and passes it to the query', async () => {
    await call('topAttackerShips', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain('kf.solar_system_id');
    expect(queryValues()).toContain(30000142);
  });

  it('puts the spatial parameters in the cache key', async () => {
    await call('topAttackerShips', { limit: 10, systemId: 30000142 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topAttackerShips:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:30000142::$/,
    );
  });
});
```

The `COUNT(*)` versus `COUNT(DISTINCT …)` split is deliberate and the tests pin it: a five-Raven fleet is five uses of a Raven but one kill for each pilot.

Also append the combination sweep. The spec's whole point is that period is
orthogonal to subject, so every one of the 25 pairs has to work — GraphQL cannot
express "this subject only supports these periods", and a resolver that throws
on an unexercised pair would only surface in production:

```typescript
describe('every subject accepts every period', () => {
  const SUBJECTS = [
    'topPilots',
    'topCorporations',
    'topAlliances',
    'topDestroyedShips',
    'topAttackerShips',
  ] as const;

  const PERIODS = [
    [LeaderboardPeriod.Today, null],
    [LeaderboardPeriod.Week, null],
    [LeaderboardPeriod.Month, null],
    [LeaderboardPeriod.Last_7Days, null],
    [LeaderboardPeriod.Last_90Days, null],
  ] as const;

  for (const subject of SUBJECTS) {
    for (const [period] of PERIODS) {
      it(`${subject} over ${period}`, async () => {
        await expect(
          call(subject, { period, limit: 10 }),
        ).resolves.toEqual([]);

        // The window reached the query rather than being silently dropped.
        expect(prisma.$queryRaw).toHaveBeenCalledOnce();
        const [key] = redis.get.mock.calls[0];
        expect(key).toContain(`:${period}:`);
      });
    }
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
```

Expected: FAIL — `leaderboardQueries.topDestroyedShips` is not a function.

- [ ] **Step 3: Reshape the schema**

In `backend/src/schemas/Leaderboard.graphql`:

- Replace `type TopLast7DaysShip` and `type TopLast7DaysAttackerShip` with one shared type:

```graphql
type TopShip {
  rank: Int!
  killCount: Int!
  shipType: Type
}
```

- Delete `input TopLast7DaysShipsFilter` and `input TopLast7DaysAttackerShipsFilter`.
- In `extend type Query`, replace the two fields with:

```graphql
  """
  Ships destroyed most often over the window named by filter.period.
  """
  topDestroyedShips(filter: TopFilter): [TopShip!]!

  """
  Ships attackers flew most often over the window named by filter.period.
  Counts attacker rows, so a five-ship fleet counts five.
  """
  topAttackerShips(filter: TopFilter): [TopShip!]!
```

- [ ] **Step 4: Rewrite the two resolvers**

In `backend/src/resolvers/leaderboard/queries.ts`, replace `topLast7DaysShips` with:

```typescript
  topDestroyedShips: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topDestroyedShips:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { victim_ship_type_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT victim_ship_type_id, COUNT(*)::BIGINT AS kill_count
      FROM   killmail_filters
      WHERE  killmail_time >= ${startDate}::date
        AND  killmail_time <  ${endDate}::date + INTERVAL '1 day'
        AND  victim_ship_type_id IS NOT NULL
        ${systemId ? Prisma.sql`AND solar_system_id = ${systemId}` : Prisma.empty}
        ${constellationId ? Prisma.sql`AND constellation_id = ${constellationId}` : Prisma.empty}
        ${regionId ? Prisma.sql`AND region_id = ${regionId}` : Prisma.empty}
      GROUP  BY victim_ship_type_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const shipTypeIds = rows.map((r) => r.victim_ship_type_id);
    const shipTypes = await prisma.type.findMany({
      where: { id: { in: shipTypeIds } },
    });
    const shipTypeMap = new Map(shipTypes.map((s) => [s.id, s]));

    const result = rows.map((row, idx) => ({
      rank: idx + 1,
      killCount: Number(row.kill_count),
      shipType: shipTypeMap.get(row.victim_ship_type_id) ?? null,
    }));

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },
```

and replace `topLast7DaysAttackerShips` with:

```typescript
  topAttackerShips: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topAttackerShips:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // COUNT(*), not COUNT(DISTINCT killmail_id): the question is how many
    // pilots flew this hull, so a five-Raven fleet counts five.
    type Row = { ship_type_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT a.ship_type_id, COUNT(*)::BIGINT AS kill_count
      FROM   attackers a
      INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
      WHERE  kf.killmail_time >= ${startDate}::date
        AND  kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
        AND  a.ship_type_id IS NOT NULL
        ${systemId ? Prisma.sql`AND kf.solar_system_id = ${systemId}` : Prisma.empty}
        ${constellationId ? Prisma.sql`AND kf.constellation_id = ${constellationId}` : Prisma.empty}
        ${regionId ? Prisma.sql`AND kf.region_id = ${regionId}` : Prisma.empty}
      GROUP  BY a.ship_type_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const shipTypeIds = rows.map((r) => r.ship_type_id);
    const shipTypes = await prisma.type.findMany({
      where: { id: { in: shipTypeIds } },
    });
    const shipTypeMap = new Map(shipTypes.map((s) => [s.id, s]));

    const result = rows.map((row, idx) => ({
      rank: idx + 1,
      killCount: Number(row.kill_count),
      shipType: shipTypeMap.get(row.ship_type_id) ?? null,
    }));

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },
```

Swapping `killmails` for `killmail_filters` does not change the unfiltered numbers: the two tables cover exactly the same 27,859 killmails.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
yarn workspace backend codegen
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
yarn workspace backend build
```

Expected: PASS, `tsc --noEmit` clean.

- [ ] **Step 6: Rename the frontend documents**

```bash
cd /Users/umut/Sites/killreport
git mv frontend/src/graphql/TopLast7DaysShips.graphql frontend/src/graphql/TopDestroyedShips.graphql
git mv frontend/src/graphql/TopLast7DaysAttackerShips.graphql frontend/src/graphql/TopAttackerShips.graphql
```

Edit the operation headers, leaving the selection sets alone:

```graphql
query TopDestroyedShips($filter: TopFilter) {
  topDestroyedShips(filter: $filter) {
```

```graphql
query TopAttackerShips($filter: TopFilter) {
  topAttackerShips(filter: $filter) {
```

- [ ] **Step 7: Update the sidebar**

In `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`, change the last two hooks and their reads:

```typescript
  const { data: attackerShips, loading: attackerShipsLoading } =
    useTopAttackerShipsQuery({
      variables: { filter: { period: LeaderboardPeriod.Last_7Days, ...variables.filter } },
      skip: !has('attackerShips'),
    });
  const { data: ships, loading: shipsLoading } = useTopDestroyedShipsQuery({
    variables: { filter: { period: LeaderboardPeriod.Last_7Days, ...variables.filter } },
    skip: !has('ships'),
  });
```

```typescript
                  attackerShips?.topAttackerShips?.map(...)
```

```typescript
                  ships?.topDestroyedShips?.map(...)
```

and update the import list. Every hook in the file now takes `TopFilter`, which is what makes the shared `variables` object safe.

- [ ] **Step 8: Verify the frontend**

```bash
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
yarn test
```

Expected: codegen, build and tests green. Lint still reports the repo's
pre-existing 148 errors / 85 warnings; confirm none names a file you changed.

- [ ] **Step 9: Prove the broken sidebar card is fixed**

Restart the backend so it serves the new schema, then:

```bash
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2- | tr -d '"')
curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' \
  -d '{"query":"query($f: TopFilter){ topAttackerShips(filter:$f){ rank killCount shipType{ id name } } }","variables":{"f":{"limit":3,"systemId":30000142}}}'
```

Expected: a `data` object, not the `Field "systemId" is not defined` error recorded in Task 1 Step 3.

- [ ] **Step 10: Commit**

```bash
git add -A backend/src frontend/src
git commit -m "refactor(leaderboard): split the ship queries by side and fix their filter

topLast7DaysShips counted destroyed ships and topLast7DaysAttackerShips
counted flown ones, but only the second said so in its name. They are
now topDestroyedShips and topAttackerShips over a shared TopShip type.

topAttackerShips also joins killmail_filters instead of killmails and
accepts the spatial filters every sibling already had. That fixes the
Most Used Ships card on a solar system page: the sidebar shares one
variables object across its queries, so passing systemId to the one
filter that lacked the field made the whole query fail variable
validation and the card render empty. Numbers are unchanged — the two
tables cover the same killmails, and the count stays COUNT(*)."
```

---

### Task 6: Documentation and the behavioural comparison

The rename is only safe if the new queries return what the old ones did. This task runs that comparison against the baseline captured in Task 1 and brings the prose in line.

**Files:**
- Modify: `backend/docs/leaderboards/leaderboard-queries.md`
- Modify: `backend/docs/leaderboards/leaderboards.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `.superpowers/sdd/2026-09-07-leaderboard-query-shape/baseline/*.json` (Task 1 Step 2); every query from Tasks 3–5.

- [ ] **Step 1: Capture the "after" output**

Restart the backend, then:

```bash
cd /Users/umut/Sites/killreport
mkdir -p .superpowers/sdd/2026-09-07-leaderboard-query-shape/after
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2- | tr -d '"')

q() {
  curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' \
    -d "{\"query\":\"$1\"}" > ".superpowers/sdd/2026-09-07-leaderboard-query-shape/after/$2.json"
}

q '{ topPilots(filter:{period:TODAY,limit:10}){ rank killCount character{ id name } } }' topPilots
q '{ topPilots(filter:{period:WEEK,limit:10}){ rank killCount character{ id name } } }' topWeeklyPilots
q '{ topPilots(filter:{period:MONTH,limit:10}){ rank killCount character{ id name } } }' topMonthlyPilots
q '{ topPilots(filter:{period:LAST_90_DAYS,limit:10}){ rank killCount character{ id name } } }' top90DaysPilots
q '{ topPilots(filter:{period:LAST_7_DAYS,limit:10}){ rank killCount character{ id name } } }' topLast7DaysPilots
q '{ topCorporations(filter:{period:LAST_7_DAYS,limit:10}){ rank killCount corporation{ id name } } }' topLast7DaysCorporations
q '{ topAlliances(filter:{period:LAST_7_DAYS,limit:10}){ rank killCount alliance{ id name } } }' topLast7DaysAlliances
q '{ topDestroyedShips(filter:{period:LAST_7_DAYS,limit:10}){ rank killCount shipType{ id name } } }' topLast7DaysShips
q '{ topAttackerShips(filter:{period:LAST_7_DAYS,limit:10}){ rank killCount shipType{ id name } } }' topLast7DaysAttackerShips

grep -l '"errors"' .superpowers/sdd/2026-09-07-leaderboard-query-shape/after/*.json || echo "all nine clean"
```

Expected: `all nine clean`.

- [ ] **Step 2: Compare rank and killCount, ignoring the field name that changed**

```bash
for f in .superpowers/sdd/2026-09-07-leaderboard-query-shape/baseline/*.json; do
  n=$(basename "$f")
  before=$(python3 -c "
import json,sys
d=json.load(open('$f'))['data']
rows=list(d.values())[0]
print([(r['rank'], r['killCount']) for r in rows])
")
  after=$(python3 -c "
import json,sys
d=json.load(open('.superpowers/sdd/2026-09-07-leaderboard-query-shape/after/$n'))['data']
rows=list(d.values())[0]
print([(r['rank'], r['killCount']) for r in rows])
")
  if [ "$before" = "$after" ]; then echo "SAME  $n"; else
    echo "DIFF  $n"; echo "  before: $before"; echo "  after:  $after"
  fi
done
```

Expected: nine `SAME` lines. A `DIFF` is only acceptable if it is explained by the `<= endDate + 1 day` → `<` correction — a kill at exactly the next midnight. Investigate any other difference before continuing; do not proceed on an unexplained `DIFF`.

- [ ] **Step 3: Compare the anchored historical windows**

The nine default-anchor captures in Step 2 cannot tell the five periods apart
in this database: `topPilots` and `topWeeklyPilots` both returned
`[8, 7, 6, 6, 6]`, and `topMonthlyPilots`, `top90DaysPilots` and
`topLast7DaysPilots` all returned `[57, 50, 47, 46, 45]`. Nearly all recent
kills land inside the same few days, so a resolver that silently used the wrong
window would still match. Six extra baselines were captured against past
periods, where the windows do separate:

| Baseline file | Old query | New query |
| --- | --- | --- |
| `anchored-today-2025-12-29` | `topPilots(date: "2025-12-29")` | `topPilots(period: TODAY, anchor: "2025-12-29")` |
| `anchored-week-2025-12-29` | `topWeeklyPilots(weekStart: "2025-12-29")` | `topPilots(period: WEEK, anchor: "2025-12-29")` |
| `anchored-month-2025-12` | `topMonthlyPilots(month: "2025-12")` | `topPilots(period: MONTH, anchor: "2025-12")` |
| `anchored-month-2025-10` | `topMonthlyPilots(month: "2025-10")` | `topPilots(period: MONTH, anchor: "2025-10")` |
| `anchored-today-2025-10-09` | `topPilots(date: "2025-10-09")` | `topPilots(period: TODAY, anchor: "2025-10-09")` |
| `anchored-week-2025-10-09` | `topWeeklyPilots(weekStart: "2025-10-09")` | `topPilots(period: WEEK, anchor: "2025-10-09")` |

```bash
cd /Users/umut/Sites/killreport
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2- | tr -d '"')
A=.superpowers/sdd/2026-09-07-leaderboard-query-shape/after

q() {
  curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' \
    -d "{\"query\":\"$1\"}" > "$A/$2.json"
}

q '{ topPilots(filter:{period:TODAY,anchor:\"2025-12-29\",limit:10}){ rank killCount character{ id name } } }' anchored-today-2025-12-29
q '{ topPilots(filter:{period:WEEK,anchor:\"2025-12-29\",limit:10}){ rank killCount character{ id name } } }' anchored-week-2025-12-29
q '{ topPilots(filter:{period:MONTH,anchor:\"2025-12\",limit:10}){ rank killCount character{ id name } } }' anchored-month-2025-12
q '{ topPilots(filter:{period:MONTH,anchor:\"2025-10\",limit:10}){ rank killCount character{ id name } } }' anchored-month-2025-10
q '{ topPilots(filter:{period:TODAY,anchor:\"2025-10-09\",limit:10}){ rank killCount character{ id name } } }' anchored-today-2025-10-09
q '{ topPilots(filter:{period:WEEK,anchor:\"2025-10-09\",limit:10}){ rank killCount character{ id name } } }' anchored-week-2025-10-09
```

Then re-run the Step 2 comparison loop — it already walks every file in the
baseline directory, so it picks these up too. All six must report `SAME`.

Two of these are the load-bearing ones. `anchored-today-2025-10-09` returned
`[3, 3, 2, 2, 2]` and `anchored-week-2025-10-09` returned `[7, 7, 6, 6, 5]`
from the same anchor string: TODAY and WEEK genuinely differ there, and the
week rounds a Thursday back to Monday 2025-10-06. If those two come back equal
to each other, the period is not reaching the query — investigate before
continuing, whatever the SAME/DIFF lines say.

`spatial-filter-bug.json` in the baseline directory holds an error, not data.
Skip it in the comparison; Task 5 Step 9 is what proves it fixed.

- [ ] **Step 4: Update the leaderboard docs**

In `backend/docs/leaderboards/leaderboard-queries.md` and `backend/docs/leaderboards/leaderboards.md`, replace every old query name with its new form:

| Old | New |
| --- | --- |
| `topPilots` | `topPilots(filter: { period: TODAY })` |
| `topWeeklyPilots` | `topPilots(filter: { period: WEEK })` |
| `topMonthlyPilots` | `topPilots(filter: { period: MONTH })` |
| `top90DaysPilots` | `topPilots(filter: { period: LAST_90_DAYS })` |
| `topLast7DaysPilots` | `topPilots(filter: { period: LAST_7_DAYS })` |
| `topLast7DaysCorporations` | `topCorporations` |
| `topLast7DaysAlliances` | `topAlliances` |
| `topLast7DaysShips` | `topDestroyedShips` |
| `topLast7DaysAttackerShips` | `topAttackerShips` |

Add a short section describing `TopFilter`, the `LeaderboardPeriod` values, and the three SQL shapes (daily stats table / `attackers ⋈ killmail_filters` / `killmail_filters` alone) with which subject uses which.

Verify no link broke:

```bash
grep -rn --include='*.md' -oE '\]\([^)#][^)]*\)' backend/docs/leaderboards/ | grep -v node_modules
```

Check each path resolves relative to the file containing it.

- [ ] **Step 5: Correct the stale test-runner claim in CLAUDE.md**

`CLAUDE.md` currently says, under *Verifying work*:

```
There is no test runner and no test files in either workspace. Verification is:
```

Replace that sentence with:

```
Vitest 5 runs in both workspaces — `yarn test` from the root runs backend then
frontend. Verification is:
```

and add `yarn test` as the first line of the command block that follows.

- [ ] **Step 6: Verify everything one last time**

```bash
cd /Users/umut/Sites/killreport
yarn test
yarn workspace backend codegen
yarn workspace backend build
yarn workspace frontend codegen
yarn workspace frontend lint
yarn workspace frontend build
```

Expected: all green. Confirm no old query name survives anywhere:

```bash
grep -rn "topLast7Days\|topWeeklyPilots\|topMonthlyPilots\|top90DaysPilots" \
  --include='*.ts' --include='*.tsx' --include='*.graphql' --include='*.md' \
  backend/src frontend/src backend/docs CLAUDE.md | grep -v generated
```

Expected: no output.

- [ ] **Step 7: Leave the orphaned Redis keys alone**

Every cache key changed format, so entries written under the old names are now
unreachable. Do **not** flush them. They expire on their own within 3600 s at
worst, and the response-cache plugin's `invalidate` runs a `KEYS` pattern scan
across the whole Redis database (`backend/src/plugins/response-cache.plugin.ts`),
so a manual sweep can delete another checkout's or another application's keys.

No command to run here — this step exists so the next person does not "tidy up".

- [ ] **Step 8: Commit**

```bash
git add -A backend/docs CLAUDE.md
git commit -m "docs: bring the leaderboard docs and CLAUDE.md up to date

The two leaderboard documents named the nine old queries; they now
describe TopFilter, the LeaderboardPeriod values and which of the three
SQL shapes each subject uses.

CLAUDE.md claimed the repo has no test runner and no test files. Vitest
5 is configured in both workspaces and this branch's baseline was 482
backend and 250 frontend tests before any change here."
```

---

## Follow-on

`docs/superpowers/specs/2026-09-07-sidebar-top-cards-design.md` adds `topFactions`, `topSystems` and `topRegions` on top of this shape, plus the `factions` table and its worker. It gets its own plan once this one is merged.
