-- Rename daily tables to better reflect their actual usage
-- These tables store all-time kill statistics, not just daily aggregates
-- The "daily" prefix was misleading since they accumulate data incrementally

-- Rename tables
ALTER TABLE IF EXISTS daily_pilot_kills RENAME TO character_kill_stats;
ALTER TABLE IF EXISTS daily_corporation_kills RENAME TO corporation_kill_stats;
ALTER TABLE IF EXISTS daily_alliance_kills RENAME TO alliance_kill_stats;

-- Update refresh_log references
UPDATE refresh_log SET view_name = 'character_kill_stats' WHERE view_name = 'daily_pilot_kills';
UPDATE refresh_log SET view_name = 'corporation_kill_stats' WHERE view_name = 'daily_corporation_kills';
UPDATE refresh_log SET view_name = 'alliance_kill_stats' WHERE view_name = 'daily_alliance_kills';
