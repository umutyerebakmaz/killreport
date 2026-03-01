# Leaderboard Query Architecture

## Overview

The leaderboard system uses **real-time aggregation tables** (`character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`) that are updated immediately as killmails are saved. All queries read from these pre-aggregated tables wrapped in a Redis cache layer.

---

## Architecture: Real-Time Aggregation

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

### 1. `topPilots` — Daily Leaderboard

**Filter:** `date: "YYYY-MM-DD"` (defaults to today)

```sql
SELECT character_id, kill_count
FROM   character_kill_stats
WHERE  kill_date = $date::date
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Single index scan on `(kill_date, kill_count DESC)`. No aggregation required.

**Cache:** 5 minutes for today, 1 hour for past dates.

---

### 2. `topWeeklyPilots` — Weekly Leaderboard (Calendar Week)

**Filter:** `weekStart: "YYYY-MM-DD"` (Monday of target week; defaults to current week)

**Note:** Uses **calendar week** (Monday-Sunday), NOT rolling 7-day window.

```sql
SELECT character_id, SUM(kill_count) AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= $weekStart::date
  AND  kill_date <  ($weekStart::date + INTERVAL '7 days')
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over 7 pre-aggregated daily rows per character.

**Cache:** 5 minutes for current week, 1 hour for past weeks.

---

### 3. `topMonthlyPilots` — Monthly Leaderboard

**Filter:** `month: "YYYY-MM"` (defaults to current month)

```sql
SELECT character_id, SUM(kill_count) AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= $monthStart::date
  AND  kill_date <  $nextMonthStart::date
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over ~30 pre-aggregated daily rows per character.

**Cache:** 5 minutes for current month, 1 hour for past months.

---

### 4. `top90DaysPilots` — Rolling 90-Day Leaderboard

**Filter:** None (always last 90 calendar days from today)

```sql
SELECT character_id, SUM(kill_count) AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= ($today::date - INTERVAL '89 days')
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over 90 pre-aggregated daily rows per character.

**Cache:** 5 minutes (rolling window updates daily).

---

### 5. `topLast7DaysPilots` — Rolling 7-Day Leaderboard

**Filter:** None (always last 7 calendar days from today)

**Note:** Uses **rolling window** (today - 6 days), NOT calendar week.

```sql
SELECT character_id, SUM(kill_count) AS kill_count
FROM   character_kill_stats
WHERE  kill_date >= ($today::date - INTERVAL '6 days')
  AND  kill_date <= $today::date
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over 7 pre-aggregated daily rows per character.

**Cache:** 5 minutes (rolling window).

**Difference from `topWeeklyPilots`:**

- `topWeeklyPilots`: Calendar week (Monday 00:00 to Sunday 23:59)
- `topLast7DaysPilots`: Rolling window (today - 6 days to today)

---

### 6. `topLast7DaysCorporations` — Rolling 7-Day Corporation Leaderboard

**Filter:** None (always last 7 calendar days from today)

```sql
SELECT corporation_id, SUM(kill_count) AS kill_count
FROM   corporation_kill_stats
WHERE  kill_date >= ($today::date - INTERVAL '6 days')
  AND  kill_date <= $today::date
GROUP  BY corporation_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over 7 pre-aggregated daily rows per corporation.

**Cache:** 5 minutes.

---

### 7. `topLast7DaysAlliances` — Rolling 7-Day Alliance Leaderboard

**Filter:** None (always last 7 calendar days from today)

```sql
SELECT alliance_id, SUM(kill_count) AS kill_count
FROM   alliance_kill_stats
WHERE  kill_date >= ($today::date - INTERVAL '6 days')
  AND  kill_date <= $today::date
GROUP  BY alliance_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over 7 pre-aggregated daily rows per alliance.

**Cache:** 5 minutes.

---

## Comparison Table

| Query                      | Source                   | Time Window             | DB Operation                            | Cache TTL                           |
| -------------------------- | ------------------------ | ----------------------- | --------------------------------------- | ----------------------------------- |
| `topPilots`                | `character_kill_stats`   | Single day              | Index lookup, no aggregation            | 5 min (today) / 1 hr (past)         |
| `topWeeklyPilots`          | `character_kill_stats`   | Calendar week (Mon-Sun) | `SUM GROUP BY` over ≤7 rows/character   | 5 min (current week) / 1 hr (past)  |
| `topMonthlyPilots`         | `character_kill_stats`   | Calendar month          | `SUM GROUP BY` over ≤31 rows/character  | 5 min (current month) / 1 hr (past) |
| `top90DaysPilots`          | `character_kill_stats`   | Rolling 90 days         | `SUM GROUP BY` over ≤90 rows/character  | 5 min (always)                      |
| `topLast7DaysPilots`       | `character_kill_stats`   | Rolling 7 days          | `SUM GROUP BY` over ≤7 rows/character   | 5 min (always)                      |
| `topLast7DaysCorporations` | `corporation_kill_stats` | Rolling 7 days          | `SUM GROUP BY` over ≤7 rows/corporation | 5 min (always)                      |
| `topLast7DaysAlliances`    | `alliance_kill_stats`    | Rolling 7 days          | `SUM GROUP BY` over ≤7 rows/alliance    | 5 min (always)                      |

---

## Query Execution Pattern

All queries follow the same two-phase pattern:

1. **Fetch ranked IDs:** Query aggregation table for top N IDs sorted by kill_count
2. **Load entity details:** Single batch query via `prisma.character.findMany` / `prisma.corporation.findMany` / `prisma.alliance.findMany`

After the first uncached call, all subsequent requests within the TTL window are served entirely from Redis with zero database load.

---

## Performance Characteristics

**Before (Old Architecture):**

- Scanned raw `attackers` table with live `GROUP BY`
- 15,000+ rows per day per query
- CPU spikes, slow queries

**After (Current Architecture):**

- Pre-aggregated tables updated real-time
- Index-only scans on small datasets
- Queries complete in <10ms
- Zero CPU spikes
