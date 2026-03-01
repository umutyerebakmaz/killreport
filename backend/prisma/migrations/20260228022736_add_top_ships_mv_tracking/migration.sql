-- Add tracking for new top ships materialized views

INSERT INTO refresh_log (view_name, last_full_refresh_at, total_records)
VALUES
    ('character_top_ships_mv', NOW(), 0),
    ('corporation_top_ships_mv', NOW(), 0),
    ('alliance_top_ships_mv', NOW(), 0)
ON CONFLICT (view_name) DO NOTHING;
