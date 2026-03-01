-- Add tracking entry for alliance_top_alliance_targets_mv to refresh_log table
INSERT INTO refresh_log (view_name, last_full_refresh_at, total_records)
VALUES ('alliance_top_alliance_targets_mv', NOW(), 0)
ON CONFLICT (view_name) DO NOTHING;
