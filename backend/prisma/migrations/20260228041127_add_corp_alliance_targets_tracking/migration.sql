-- Add tracking for new corporation and alliance top targets views

INSERT INTO refresh_log (view_name, last_full_refresh_at, total_records)
VALUES
    ('corporation_top_alliance_targets_mv', NOW(), 0),
    ('corporation_top_corporation_targets_mv', NOW(), 0),
    ('alliance_top_corporation_targets_mv', NOW(), 0)
ON CONFLICT (view_name) DO NOTHING;
