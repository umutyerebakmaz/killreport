-- Update tracking log with new table names (removed _mv suffix)

UPDATE materialized_view_refresh_log
SET view_name = 'killmail_filters'
WHERE view_name = 'killmail_filters_mv';

UPDATE materialized_view_refresh_log
SET view_name = 'daily_pilot_kills'
WHERE view_name = 'daily_pilot_kills_mv';
