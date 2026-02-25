-- Convert daily_pilot_kills_mv from MATERIALIZED VIEW to regular TABLE
-- This allows incremental DELETE/INSERT operations for better performance

-- Step 1: Create a regular table with the same structure
CREATE TABLE daily_pilot_kills_table AS
SELECT * FROM daily_pilot_kills_mv;

-- Step 2: Drop the materialized view
DROP MATERIALIZED VIEW daily_pilot_kills_mv;

-- Step 3: Rename table to clean name (remove _mv suffix)
ALTER TABLE daily_pilot_kills_table RENAME TO daily_pilot_kills;

-- Step 4: Recreate all indexes
-- Unique index (was required for REFRESH CONCURRENTLY, now for PRIMARY KEY)
CREATE UNIQUE INDEX idx_daily_pilot_kills_unique
    ON daily_pilot_kills (kill_date, character_id);

-- Primary leaderboard access pattern
CREATE INDEX idx_daily_pilot_kills_date_count
    ON daily_pilot_kills (kill_date, kill_count DESC);

-- Add primary key
ALTER TABLE daily_pilot_kills ADD PRIMARY KEY USING INDEX idx_daily_pilot_kills_unique;
