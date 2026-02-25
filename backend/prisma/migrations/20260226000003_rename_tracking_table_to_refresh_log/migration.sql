-- Rename tracking table to reflect that it tracks both tables and materialized views

ALTER TABLE materialized_view_refresh_log RENAME TO refresh_log;

-- Update index names to match new table name
ALTER INDEX idx_mv_refresh_log_view_name RENAME TO idx_refresh_log_view_name;
ALTER INDEX idx_mv_refresh_log_last_full RENAME TO idx_refresh_log_last_full;
