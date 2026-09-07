# Leaderboard Query Architecture

## Overview

Five queries — `topPilots`, `topCorporations`, `topAlliances`, `topDestroyedShips`,
`topAttackerShips` — share one input type, `TopFilter`. The time window that used
to be baked into nine separate query names, one per subject-and-period
combination, is now `filter.period`, a `LeaderboardPeriod` enum value. Three of
the five subjects (pilots, corporations,
alliances) also read from **real-time aggregation tables**
(`character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`) updated
immediately as killmails are saved; the ship queries and any spatially-filtered
query read `killmail_filters` / `attackers` directly. See
[TopFilter and LeaderboardPeriod](#topfilter-and-leaderboardperiod) below for
which subject uses which shape.

---

## TopFilter and LeaderboardPeriod

```graphql
enum LeaderboardPeriod {
  TODAY
  WEEK
  MONTH
  LAST_7_DAYS
  LAST_90_DAYS
}

input TopFilter {
  period: LeaderboardPeriod # defaults to LAST_7_DAYS
  anchor: String # see below
  limit: Int # max 100, default 100
  systemId: Int
  constellationId: Int
  regionId: Int
}
```

**`anchor`** pins the window to a point in the past instead of "now". Its format
depends on `period`:

| Period                         | Anchor format | Meaning                                             |
| ------------------------------ | -------------- | ---------------------------------------------------- |
| `TODAY`                        | `YYYY-MM-DD`   | That calendar day.                                    |
| `WEEK`                         | `YYYY-MM-DD`   | Any day in the target week — rounded back to its Monday. |
| `MONTH`                        | `YYYY-MM`      | That calendar month.                                   |
| `LAST_7_DAYS` / `LAST_90_DAYS` | ignored        | Always a rolling window ending today.                  |

An empty `anchor` means today / this week / this month. `WEEK` uses the
**calendar week** (Monday–Sunday); `LAST_7_DAYS` is a **rolling** window
(today − 6 days to today) — the two agree only when today is a Monday.
`resolvePeriod()` in `backend/src/resolvers/leaderboard/period.ts` is the single
place this logic lives; every one of the five resolvers calls it.

**`systemId` / `constellationId` / `regionId`** filter to activity in one part of
space. Supplying any one of them changes which SQL shape a pilot/corporation/
alliance query runs — see Shape B below. `topDestroyedShips` and
`topAttackerShips` accept the same three fields but were never backed by the
daily stats tables, so they run the same query shape with or without a spatial
filter.

### The three SQL shapes

**Shape A — daily stats table.** Used by `topPilots`, `topCorporations`,
`topAlliances` when no spatial filter is given. One `SUM ... GROUP BY` over the
pre-aggregated table, date-bounded inclusively on both ends
(`kill_date >= startDate AND kill_date <= endDate`), since the table's primary
key is `(kill_date, entity_id)` — a date column, not a timestamp.

**Shape B — `attackers ⋈ killmail_filters`, counting distinct killmails.**
Used by `topPilots`, `topCorporations`, `topAlliances` whenever `systemId`,
`constellationId` or `regionId` is set (the daily stats tables carry no
location, so a spatial filter has to go back to the killmails themselves), and
unconditionally by `topAttackerShips` — see the counting rule below for why
that one query does *not* share this shape's `COUNT(DISTINCT ...)`. Bounded on
`killmail_time`, a timestamp, so the upper bound is
`killmail_time < endDate::date + INTERVAL '1 day'` rather than `<=`.

The `topPilots` form of the spatially-filtered branch (`topCorporations` and
`topAlliances` are identical but for `a.corporation_id` / `a.alliance_id` in
place of `a.character_id`, straight from
`backend/src/resolvers/leaderboard/queries.ts`):

```sql
SELECT a.character_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
FROM   attackers a
INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
WHERE  kf.killmail_time >= $startDate::date
  AND  kf.killmail_time <  $endDate::date + INTERVAL '1 day'
  AND  a.character_id IS NOT NULL
  -- + optional: AND kf.solar_system_id = $systemId
  -- + optional: AND kf.constellation_id = $constellationId
  -- + optional: AND kf.region_id = $regionId
GROUP  BY a.character_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**The counting rule, stated once, because it is easy to misread from the SQL
alone:** an `attackers` row exists per attacker *slot* on a killmail, not per
killmail — a character who both tackled and landed the final blow owns two
rows on the same kill. The three entity leaderboards (`topPilots`,
`topCorporations`, `topAlliances`) must count that kill once, so Shape B uses
`COUNT(DISTINCT kf.killmail_id)`, and Shape A's pre-aggregated `kill_count`
column is deduplicated the same way at write time by `kill-stats-realtime.ts`.
`topAttackerShips` is the deliberate exception: it counts **attacker rows**
with plain `COUNT(*)`, because its question is "how many pilots flew this
hull", so a five-Raven fleet on one kill counts as five, not one — see the
comment above the `topAttackerShips` query in
`backend/src/resolvers/leaderboard/queries.ts`. This asymmetry is intentional,
not an inconsistency to fix.

**Shape C — `killmail_filters` alone.** Used unconditionally by
`topDestroyedShips`, which counts victims and has no attacker to join against.
Same timestamp-exclusive upper bound as Shape B, and the same plain `COUNT(*)`
as `topAttackerShips` — there is exactly one victim per killmail, so counting
rows and counting distinct killmails come out identical here and the
distinction that matters for Shape B doesn't arise.

---

## Architecture: Real-Time Aggregation (Shape A)

### Update Strategy

- **Real-time updates:** Every killmail save triggers atomic UPSERT operations via `kill-stats-realtime.ts`
- **Transaction-based:** Updates happen IN TRANSACTION with killmail saves
- **Zero latency:** Leaderboards reflect new kills within seconds
- **No fallback needed:** Updates are transactional and guaranteed consistent

### Tables

**`character_kill_stats`** - Pre-aggregated per `(kill_date, character_id)`

```sql
CREATE TABLE character_kill_stats (
  kill_date DATE NOT NULL,
  character_id INTEGER NOT NULL,
  kill_count INTEGER NOT NULL,
  PRIMARY KEY (kill_date, character_id)
);
CREATE INDEX idx_character_kill_stats_date_count
  ON character_kill_stats(kill_date, kill_count DESC);
```

**`corporation_kill_stats`** - Pre-aggregated per `(kill_date, corporation_id)`

```sql
CREATE TABLE corporation_kill_stats (
  kill_date DATE NOT NULL,
  corporation_id INTEGER NOT NULL,
  kill_count INTEGER NOT NULL,
  PRIMARY KEY (kill_date, corporation_id)
);
CREATE INDEX idx_corporation_kill_stats_date_count
  ON corporation_kill_stats(kill_date, kill_count DESC);
```

**`alliance_kill_stats`** - Pre-aggregated per `(kill_date, alliance_id)`

```sql
CREATE TABLE alliance_kill_stats (
  kill_date DATE NOT NULL,
  alliance_id INTEGER NOT NULL,
  kill_count INTEGER NOT NULL,
  PRIMARY KEY (kill_date, alliance_id)
);
CREATE INDEX idx_alliance_kill_stats_date_count
  ON alliance_kill_stats(kill_date, kill_count DESC);
```

---

## Query Breakdown

### 1. `topPilots(filter: { period: TODAY })` — Daily Leaderboard

**Filter:** `period: TODAY`, optional `anchor: "YYYY-MM-DD"` (defaults to today)

```sql
SELECT character_id, SUM(kill_count)::BIGINT AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= $startDate::date
  AND  kill_date <= $endDate::date
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

For `TODAY`, `startDate` and `endDate` are the same day, so this is effectively
a single-partition scan; the `SUM`/`GROUP BY` shape stays the same across all
five periods so the query only needs to exist once.

**DB cost:** Single index scan on `(kill_date, kill_count DESC)`.

**Cache:** 5 minutes for today, 1 hour for past dates.

---

### 2. `topPilots(filter: { period: WEEK })` — Weekly Leaderboard (Calendar Week)

**Filter:** `period: WEEK`, optional `anchor: "YYYY-MM-DD"` (any day of the target week; defaults to current week)

**Note:** Uses **calendar week** (Monday–Sunday), NOT rolling 7-day window. The
anchor is rounded back to its Monday by `getWeekMonday()`.

```sql
SELECT character_id, SUM(kill_count)::BIGINT AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= $mondayOfWeek::date
  AND  kill_date <= $mondayOfWeek::date + INTERVAL '6 days'
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**DB cost:** Range scan over 7 pre-aggregated daily rows per character.

**Cache:** 5 minutes for current week, 1 hour for past weeks.

---

### 3. `topPilots(filter: { period: MONTH })` — Monthly Leaderboard

**Filter:** `period: MONTH`, optional `anchor: "YYYY-MM"` (defaults to current month)

```sql
SELECT character_id, SUM(kill_count)::BIGINT AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= $monthStart::date
  AND  kill_date <= $monthEnd::date
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**DB cost:** Range scan over ~28-31 pre-aggregated daily rows per character.

**Cache:** 5 minutes for current month, 1 hour for past months.

---

### 4. `topPilots(filter: { period: LAST_90_DAYS })` — Rolling 90-Day Leaderboard

**Filter:** `period: LAST_90_DAYS` (anchor ignored; always the 90 calendar days ending today)

```sql
SELECT character_id, SUM(kill_count)::BIGINT AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= (CURRENT_DATE - INTERVAL '89 days')
  AND  kill_date <= CURRENT_DATE
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**DB cost:** Range scan over 90 pre-aggregated daily rows per character.

**Cache:** 5 minutes (rolling window updates daily).

---

### 5. `topPilots(filter: { period: LAST_7_DAYS })` — Rolling 7-Day Leaderboard (default period)

**Filter:** `period: LAST_7_DAYS`, or omit `filter.period` entirely (anchor ignored; always the 7 calendar days ending today)

**Note:** Uses **rolling window** (today - 6 days), NOT calendar week.

```sql
SELECT character_id, SUM(kill_count)::BIGINT AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= (CURRENT_DATE - INTERVAL '6 days')
  AND  kill_date <= CURRENT_DATE
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**DB cost:** Range scan over 7 pre-aggregated daily rows per character.

**Cache:** 5 minutes (rolling window).

**Difference from `period: WEEK`:**

- `WEEK`: Calendar week (Monday 00:00 to Sunday 23:59)
- `LAST_7_DAYS`: Rolling window (today - 6 days to today)

---

### 6. `topCorporations` — Corporation Leaderboard

Same five periods as `topPilots`, same Shape A query against
`corporation_kill_stats`:

```sql
SELECT corporation_id, SUM(kill_count)::BIGINT AS kill_count
FROM   corporation_kill_stats
WHERE  kill_date >= $startDate::date
  AND  kill_date <= $endDate::date
GROUP  BY corporation_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**DB cost:** Range scan over the daily rows in the requested window, per corporation.

**Cache:** 5 minutes while the window includes today, 1 hour once it has fully closed.

**Spatial filter:** passing `systemId`, `constellationId` or `regionId` switches
this query to Shape B (`attackers ⋈ killmail_filters`, `COUNT(DISTINCT
kf.killmail_id)`) — see "The three SQL shapes" above for the full query and the
counting rule.

---

### 7. `topAlliances` — Alliance Leaderboard

Same five periods, same Shape A query against `alliance_kill_stats`:

```sql
SELECT alliance_id, SUM(kill_count)::BIGINT AS kill_count
FROM   alliance_kill_stats
WHERE  kill_date >= $startDate::date
  AND  kill_date <= $endDate::date
GROUP  BY alliance_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**DB cost:** Range scan over the daily rows in the requested window, per alliance.

**Cache:** 5 minutes while the window includes today, 1 hour once it has fully closed.

**Spatial filter:** passing `systemId`, `constellationId` or `regionId` switches
this query to Shape B (`attackers ⋈ killmail_filters`, `COUNT(DISTINCT
kf.killmail_id)`) — see "The three SQL shapes" above for the full query and the
counting rule.

---

### 8. `topDestroyedShips` — Most-Destroyed Ship Types (Shape C)

Counts victims, not attackers — there is no pre-aggregated table for ship types,
so this always reads `killmail_filters` directly, in every period:

```sql
SELECT victim_ship_type_id, COUNT(*)::BIGINT AS kill_count
FROM   killmail_filters
WHERE  killmail_time >= $startDate::date
  AND  killmail_time <  $endDate::date + INTERVAL '1 day'
  AND  victim_ship_type_id IS NOT NULL
  -- + optional systemId / constellationId / regionId
GROUP  BY victim_ship_type_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**DB cost:** Scan over `killmail_filters` rows in the window, bounded by its
`killmail_time` index.

**Cache:** 5 minutes while the window includes today, 1 hour once it has fully closed.

---

### 9. `topAttackerShips` — Most-Flown Ship Types (Shape B)

Counts attacker rows, not distinct killmails — a five-Raven fleet counts five —
so this always joins `attackers` to `killmail_filters`, in every period:

```sql
SELECT a.ship_type_id, COUNT(*)::BIGINT AS kill_count
FROM   attackers a
INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
WHERE  kf.killmail_time >= $startDate::date
  AND  kf.killmail_time <  $endDate::date + INTERVAL '1 day'
  AND  a.ship_type_id IS NOT NULL
  -- + optional systemId / constellationId / regionId
GROUP  BY a.ship_type_id
ORDER  BY kill_count DESC
LIMIT  $limit
```

**DB cost:** Join between `attackers` and `killmail_filters` over the window.

**Cache:** 5 minutes while the window includes today, 1 hour once it has fully closed.

---

## Comparison Table

| Query               | Shape | Source                                    | Periods supported | Cache TTL                    |
| -------------------- | ----- | ------------------------------------------ | ------------------ | ----------------------------- |
| `topPilots`          | A / B | `character_kill_stats`, or `attackers ⋈ killmail_filters` when spatially filtered | all five | 5 min (live) / 1 hr (closed) |
| `topCorporations`    | A / B | `corporation_kill_stats`, or `attackers ⋈ killmail_filters` when spatially filtered | all five | 5 min (live) / 1 hr (closed) |
| `topAlliances`       | A / B | `alliance_kill_stats`, or `attackers ⋈ killmail_filters` when spatially filtered | all five | 5 min (live) / 1 hr (closed) |
| `topDestroyedShips`  | C     | `killmail_filters`                        | all five           | 5 min (live) / 1 hr (closed) |
| `topAttackerShips`   | B     | `attackers ⋈ killmail_filters`            | all five           | 5 min (live) / 1 hr (closed) |

"Live" means the window includes today (`isLive` in `resolvePeriod()`); a window
entirely in the past is "closed" and gets the longer TTL since its numbers can
no longer change.

---

## Query Execution Pattern

All queries follow the same two-phase pattern:

1. **Fetch ranked IDs:** Query aggregation table for top N IDs sorted by kill_count
2. **Load entity details:** Single batch query via `prisma.character.findMany` / `prisma.corporation.findMany` / `prisma.alliance.findMany` / `prisma.type.findMany`

After the first uncached call, all subsequent requests within the TTL window are served entirely from Redis with zero database load.

---

## Performance Characteristics

**Before (Old Architecture):**

- Scanned raw `attackers` table with live `GROUP BY`
- 15,000+ rows per day per query
- CPU spikes, slow queries

**After (Current Architecture):**

- Pre-aggregated tables updated real-time for pilots/corporations/alliances (Shape A)
- Index-only scans on small datasets
- Queries complete in <10ms
- Zero CPU spikes
