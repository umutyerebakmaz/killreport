-- Add daily_corporation_kills and daily_alliance_kills tables
-- Similar to daily_pilot_kills, these pre-aggregate kill counts per day
-- to eliminate expensive live GROUP BY queries on the full attackers+killmails join

-- Daily Corporation Kills Table
CREATE TABLE daily_corporation_kills (
    kill_date DATE NOT NULL,
    corporation_id INT NOT NULL,
    kill_count INT NOT NULL,
    PRIMARY KEY (kill_date, corporation_id)
);

-- Primary access pattern: filter by date range, sort by count desc
CREATE INDEX idx_daily_corporation_kills_date_count
    ON daily_corporation_kills (kill_date, kill_count DESC);

-- Daily Alliance Kills Table
CREATE TABLE daily_alliance_kills (
    kill_date DATE NOT NULL,
    alliance_id INT NOT NULL,
    kill_count INT NOT NULL,
    PRIMARY KEY (kill_date, alliance_id)
);

-- Primary access pattern: filter by date range, sort by count desc
CREATE INDEX idx_daily_alliance_kills_date_count
    ON daily_alliance_kills (kill_date, kill_count DESC);

-- Initial populate of daily_corporation_kills
INSERT INTO daily_corporation_kills (kill_date, corporation_id, kill_count)
SELECT
    DATE(k.killmail_time AT TIME ZONE 'UTC') AS kill_date,
    a.corporation_id,
    COUNT(DISTINCT a.killmail_id)::int AS kill_count
FROM attackers a
INNER JOIN killmails k ON a.killmail_id = k.killmail_id
WHERE a.corporation_id IS NOT NULL
GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.corporation_id;

-- Initial populate of daily_alliance_kills
INSERT INTO daily_alliance_kills (kill_date, alliance_id, kill_count)
SELECT
    DATE(k.killmail_time AT TIME ZONE 'UTC') AS kill_date,
    a.alliance_id,
    COUNT(DISTINCT a.killmail_id)::int AS kill_count
FROM attackers a
INNER JOIN killmails k ON a.killmail_id = k.killmail_id
WHERE a.alliance_id IS NOT NULL
GROUP BY DATE(k.killmail_time AT TIME ZONE 'UTC'), a.alliance_id;

-- Add entries to refresh_log for tracking
INSERT INTO refresh_log (view_name, last_full_refresh_at, last_incremental_refresh_at, total_records)
VALUES
    ('daily_corporation_kills', NOW(), NOW(), (SELECT COUNT(*) FROM daily_corporation_kills)),
    ('daily_alliance_kills', NOW(), NOW(), (SELECT COUNT(*) FROM daily_alliance_kills))
ON CONFLICT (view_name) DO NOTHING;

