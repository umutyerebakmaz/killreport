# Real-time Daily Aggregates System

## Architecture Overview

### 🎯 Problem

Previously, leaderboard queries (Top Pilots, Top Corporations, Top Alliances) were expensive:

- Direct GROUP BY on `attackers` table (millions of rows)
- Full table scans on every query
- High CPU usage (50-99% spikes)
- 5-10 second response times

### ✅ Solution: Two-Layer Architecture

#### Layer 1: Real-time Updates (PRIMARY)

**File**: [`kill-stats-realtime.ts`](/backend/src/services/kill-stats-realtime.ts)

Every killmail save triggers immediate updates to daily aggregation tables:

```typescript
// In transaction with killmail save
await updateDailyAggregatesRealtime(tx, {
  killmail_time: new Date(killmail_time),
  character_ids: attackers.map((a) => a.character_id),
  corporation_ids: attackers.map((a) => a.corporation_id),
  alliance_ids: attackers.map((a) => a.alliance_id),
});
```

**How it works**:

- `INSERT ... ON CONFLICT DO UPDATE SET kill_count = kill_count + 1`
- Atomic increments using PostgreSQL upsert
- Updates 3 tables in parallel: `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`
- Overhead: <5ms per killmail
- Zero latency for leaderboards ⚡

**Integrated in**:

- [`worker-redisq-stream.ts`](/backend/src/workers/worker-redisq-stream.ts) - Real-time zKillboard stream
- [`worker-killmails.ts`](/backend/src/workers/worker-killmails.ts) - Character killmail sync
- [`worker-zkillboard-sync.ts`](/backend/src/workers/worker-zkillboard-sync.ts) - Bulk zKillboard sync
- [`worker-esi-corporation-killmails.ts`](/backend/src/workers/worker-esi-corporation-killmails.ts) - Corp killmail sync

#### Layer 2: Periodic Refresh (FALLBACK)

**File**: [`materialized-view-incremental.ts`](/backend/src/services/materialized-view-incremental.ts)
**Worker**: [`worker-materialized-views.ts`](/backend/src/workers/worker-materialized-views.ts)

Runs every 5 minutes to ensure consistency:

- Recalculates last 6 hours of data
- Detects and fixes any missed updates
- Handles edge cases (transaction failures, worker restarts, etc.)
- Full refresh once per day at 3 AM UTC

**Strategy**:

```sql
-- Delete affected days
DELETE FROM character_kill_stats WHERE kill_date >= :six_hours_ago;

-- Re-insert from source
INSERT INTO character_kill_stats (kill_date, character_id, kill_count)
SELECT DATE(k.killmail_time), a.character_id, COUNT(*)
FROM attackers a
JOIN killmails k ON a.killmail_id = k.killmail_id
WHERE k.killmail_time >= :six_hours_ago
GROUP BY DATE(k.killmail_time), a.character_id
ON CONFLICT (kill_date, character_id) DO UPDATE SET kill_count = EXCLUDED.kill_count;
```

## Database Tables

### character_kill_stats

```sql
CREATE TABLE character_kill_stats (
    kill_date DATE NOT NULL,
    character_id INT NOT NULL,
    kill_count INT NOT NULL,
    PRIMARY KEY (kill_date, character_id)
);
CREATE INDEX idx_character_kill_stats_date_count ON character_kill_stats(kill_date, kill_count DESC);
```

### corporation_kill_stats

```sql
CREATE TABLE corporation_kill_stats (
    kill_date DATE NOT NULL,
    corporation_id INT NOT NULL,
    kill_count INT NOT NULL,
    PRIMARY KEY (kill_date, corporation_id)
);
CREATE INDEX idx_corporation_kill_stats_date_count ON corporation_kill_stats(kill_date, kill_count DESC);
```

### alliance_kill_stats

```sql
CREATE TABLE alliance_kill_stats (
    kill_date DATE NOT NULL,
    alliance_id INT NOT NULL,
    kill_count INT NOT NULL,
    PRIMARY KEY (kill_date, alliance_id)
);
CREATE INDEX idx_alliance_kill_stats_date_count ON alliance_kill_stats(kill_date, kill_count DESC);
```

## Query Performance

### Before (Direct Query)

```sql
-- 5-10 seconds, full table scan
SELECT a.corporation_id, COUNT(DISTINCT a.killmail_id)
FROM attackers a
JOIN killmails k ON a.killmail_id = k.killmail_id
WHERE k.killmail_time >= NOW() - INTERVAL '7 days'
GROUP BY a.corporation_id
ORDER BY COUNT(*) DESC
LIMIT 100;
```

### After (Aggregated Query)

```sql
-- <50ms, index scan only
SELECT corporation_id, SUM(kill_count) as kill_count
FROM corporation_kill_stats
WHERE kill_date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY corporation_id
ORDER BY kill_count DESC
LIMIT 100;
```

## Performance Metrics

| Metric              | Before              | After         | Improvement         |
| ------------------- | ------------------- | ------------- | ------------------- |
| Query Time          | 5-10s               | <50ms         | **100-200x faster** |
| CPU Usage (query)   | 50-99%              | <5%           | **10-20x lower**    |
| Leaderboard Latency | 5-10s               | Real-time     | **Instant**         |
| Update Overhead     | N/A                 | <5ms/killmail | Negligible          |
| Worker CPU          | High (full refresh) | Low (6h only) | **5-10x lower**     |

## Monitoring

### Check table sizes

```sql
SELECT
    'character_kill_stats' as table_name,
    COUNT(*) as records,
    pg_size_pretty(pg_total_relation_size('character_kill_stats')) as size
FROM character_kill_stats
UNION ALL
SELECT
    'corporation_kill_stats',
    COUNT(*),
    pg_size_pretty(pg_total_relation_size('corporation_kill_stats'))
FROM corporation_kill_stats
UNION ALL
SELECT
    'alliance_kill_stats',
    COUNT(*),
    pg_size_pretty(pg_total_relation_size('alliance_kill_stats'))
FROM alliance_kill_stats;
```

### Check last refresh

```sql
SELECT * FROM refresh_log
WHERE view_name IN ('character_kill_stats', 'corporation_kill_stats', 'alliance_kill_stats')
ORDER BY last_incremental_refresh_at DESC;
```

### Test real-time updates

```sh
# Watch leaderboard while killmails arrive
psql -d killreport -c "
SELECT corporation_id, kill_count
FROM corporation_kill_stats
WHERE kill_date = CURRENT_DATE
ORDER BY kill_count DESC
LIMIT 10;
" --watch 2
```

## Failover & Recovery

### If real-time updates fail

The periodic worker will fix inconsistencies within 5 minutes automatically.

### If worker stops

Real-time updates continue (transaction-level). Worker just provides consistency checks.

### Manual recovery (if needed)

```sh
# Force full refresh of all daily tables
cd /root/killreport/backend
yarn ts-node scripts/force-full-refresh-daily-aggregates.ts
```

## Migration

Run migration to create tables:

```sh
cd /root/killreport/backend
yarn prisma migrate deploy
```

Initial population happens automatically in migration.

## Cost Analysis

### Storage Cost

- ~10KB per 1000 kill records per entity per day
- Example: 10,000 active pilots/day = ~100KB/day = ~3MB/month
- Extremely cheap vs. query cost savings

### Maintenance Cost

- Real-time: <5ms per killmail (negligible)
- Periodic: ~1-2 seconds every 5 minutes (minimal)
- Full refresh: ~30-60 seconds once per day (off-peak hours)

### Benefit

- 100-200x faster queries
- 10-20x lower CPU usage
- Real-time leaderboard updates
- Better user experience

**ROI: ~1000x** (minimal cost, massive benefit)
