-- CreateMaterializedView: daily_pilot_kills_mv
-- Pre-aggregates per-character kill counts per UTC day from the attackers table.
-- Eliminates the expensive live GROUP BY on the full attackers+killmails join
-- and reduces the daily leaderboard query to a single indexed scan.

CREATE MATERIALIZED VIEW daily_pilot_kills_mv AS
SELECT
    DATE(k.killmail_time AT TIME ZONE 'UTC') AS kill_date,
    a.character_id,
    COUNT(*)::int                             AS kill_count
FROM attackers a
INNER JOIN killmails k ON a.killmail_id = k.killmail_id
WHERE a.character_id IS NOT NULL
GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.character_id;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_daily_pilot_kills_mv_unique
    ON daily_pilot_kills_mv (kill_date, character_id);

-- Primary leaderboard access pattern: filter by date, sort by count desc
CREATE INDEX idx_daily_pilot_kills_mv_date_count
    ON daily_pilot_kills_mv (kill_date, kill_count DESC);
