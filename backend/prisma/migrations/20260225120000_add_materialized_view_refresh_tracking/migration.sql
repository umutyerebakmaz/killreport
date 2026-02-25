-- Add tracking table for materialized view refresh optimization
-- This prevents full refresh every time and enables incremental updates

CREATE TABLE materialized_view_refresh_log (
    view_name VARCHAR(255) PRIMARY KEY,
    last_full_refresh_at TIMESTAMPTZ,
    last_incremental_refresh_at TIMESTAMPTZ,
    last_processed_killmail_id INT,
    last_processed_killmail_time TIMESTAMPTZ,
    total_records BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize with current state
INSERT INTO materialized_view_refresh_log (view_name, last_full_refresh_at, total_records)
VALUES
    ('killmail_filters_mv', NOW(), 0),
    ('daily_pilot_kills_mv', NOW(), 0),
    ('character_top_alliance_targets_mv', NOW(), 0),
    ('character_top_corporation_targets_mv', NOW(), 0)
ON CONFLICT (view_name) DO NOTHING;

-- Index for quick lookups
CREATE INDEX idx_mv_refresh_log_view_name ON materialized_view_refresh_log(view_name);
CREATE INDEX idx_mv_refresh_log_last_full ON materialized_view_refresh_log(last_full_refresh_at);
