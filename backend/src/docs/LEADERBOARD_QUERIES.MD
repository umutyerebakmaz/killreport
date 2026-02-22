# Leaderboard Query Architecture

## Overview

All four leaderboard queries read exclusively from the `daily_pilot_kills_mv` materialized view — never from the raw `attackers` or `killmails` tables. Each query is further wrapped in a Redis cache layer to eliminate repeated database hits.

---

## Materialized View: `daily_pilot_kills_mv`

Pre-aggregates kill counts per `(kill_date, character_id)` pair. Refreshed every 5 minutes by the `scheduleMaterializedViewRefresh` scheduler.

```sql
-- Indexes on the view
UNIQUE (kill_date, character_id)          -- enables REFRESH CONCURRENTLY
       (kill_date, kill_count DESC)       -- serves leaderboard ORDER BY
```

The old approach scanned the raw `attackers` table with a live `GROUP BY` over 15,000+ rows per day. The MV reduces that to a small, already-aggregated dataset.

---

## Query Breakdown

### `topPilots` — Daily Leaderboard

**Filter:** `date: "YYYY-MM-DD"` (defaults to today)

```sql
SELECT character_id, kill_count
FROM   daily_pilot_kills_mv
WHERE  kill_date = $date::date
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Single index scan on `(kill_date, kill_count DESC)`. No aggregation required — the row is already the final value.

**Cache:** 5 minutes for today, 1 hour for past dates (past dates never change).

---

### `topWeeklyPilots` — Weekly Leaderboard

**Filter:** `weekStart: "YYYY-MM-DD"` (Monday of the target week; defaults to current week)

```sql
SELECT character_id, SUM(kill_count) AS kill_count
FROM   daily_pilot_kills_mv
WHERE  kill_date >= $weekStart::date
  AND  kill_date <  ($weekStart::date + INTERVAL '7 days')
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over at most 7 pre-aggregated daily rows per character. The `GROUP BY` works on a tiny dataset compared to raw rows.

**Cache:** 5 minutes for the current week, 1 hour for past weeks.

---

### `topMonthlyPilots` — Monthly Leaderboard

**Filter:** `month: "YYYY-MM"` (defaults to current month)

```sql
SELECT character_id, SUM(kill_count) AS kill_count
FROM   daily_pilot_kills_mv
WHERE  kill_date >= $monthStart::date
  AND  kill_date <  $nextMonthStart::date
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over at most ~31 pre-aggregated daily rows per character.

**Cache:** 5 minutes for the current month, 1 hour for past months.

---

### `top90DaysPilots` — Rolling 90-Day Leaderboard

**Filter:** none (always the last 90 calendar days from today)

```sql
SELECT character_id, SUM(kill_count) AS kill_count
FROM   daily_pilot_kills_mv
WHERE  kill_date >= ($today::date - INTERVAL '89 days')
GROUP  BY character_id
ORDER  BY kill_count DESC
LIMIT  100
```

**DB cost:** Range scan over at most 90 pre-aggregated daily rows per character.

**Cache:** 5 minutes (always treated as "live" since the window rolls daily).

---

## Comparison Table

| Query              | Source                 | DB Operation                                           | Cache TTL                           |
| ------------------ | ---------------------- | ------------------------------------------------------ | ----------------------------------- |
| `topPilots`        | `daily_pilot_kills_mv` | Single date → exact index lookup, no aggregation       | 5 min (today) / 1 hr (past)         |
| `topWeeklyPilots`  | `daily_pilot_kills_mv` | 7-day range → `SUM GROUP BY` over ≤7 rows/character    | 5 min (current week) / 1 hr (past)  |
| `topMonthlyPilots` | `daily_pilot_kills_mv` | ~30-day range → `SUM GROUP BY` over ≤31 rows/character | 5 min (current month) / 1 hr (past) |
| `top90DaysPilots`  | `daily_pilot_kills_mv` | 90-day range → `SUM GROUP BY` over ≤90 rows/character  | 5 min (always)                      |

All queries follow the same two-phase pattern:

1. Fetch ranked `character_id` list from the MV.
2. Load full character rows (name, corporation, alliance, security status) via a single `prisma.character.findMany` batch.

After the first uncached call, all subsequent requests within the TTL window are served entirely from Redis with zero database load.
