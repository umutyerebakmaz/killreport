-- CreateMaterializedView: corporation_top_alliance_targets_mv
-- Pre-computes top 10 alliance targets for each corporation
-- Refreshed every 5 minutes with other materialized views

CREATE MATERIALIZED VIEW corporation_top_alliance_targets_mv AS
WITH ranked_kills AS (
    SELECT
        a.corporation_id,
        v.alliance_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.corporation_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.corporation_id IS NOT NULL
      AND v.alliance_id IS NOT NULL
    GROUP BY a.corporation_id, v.alliance_id
)
SELECT
    rk.corporation_id,
    rk.alliance_id,
    rk.kill_count,
    al.name as alliance_name
FROM ranked_kills rk
INNER JOIN alliances al ON rk.alliance_id = al.id
WHERE rk.rn <= 10
ORDER BY rk.corporation_id, rk.kill_count DESC;

-- Index for fast corporation_id lookup
CREATE INDEX idx_corp_top_alliance_corp_id ON corporation_top_alliance_targets_mv(corporation_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_corp_top_alliance_corp_alliance ON corporation_top_alliance_targets_mv(corporation_id, alliance_id);

-- Composite index for corporation + kill_count ordering
CREATE INDEX idx_corp_top_alliance_corp_kills ON corporation_top_alliance_targets_mv(corporation_id, kill_count DESC);

-- CreateMaterializedView: corporation_top_corporation_targets_mv
-- Pre-computes top 10 corporation targets for each corporation
-- Refreshed every 5 minutes with other materialized views

CREATE MATERIALIZED VIEW corporation_top_corporation_targets_mv AS
WITH ranked_kills AS (
    SELECT
        a.corporation_id,
        v.corporation_id as victim_corporation_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.corporation_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.corporation_id IS NOT NULL
      AND v.corporation_id IS NOT NULL
      AND a.corporation_id != v.corporation_id  -- Exclude self-kills
    GROUP BY a.corporation_id, v.corporation_id
)
SELECT
    rk.corporation_id,
    rk.victim_corporation_id as target_corporation_id,
    rk.kill_count,
    co.name as corporation_name
FROM ranked_kills rk
INNER JOIN corporations co ON rk.victim_corporation_id = co.id
WHERE rk.rn <= 10
ORDER BY rk.corporation_id, rk.kill_count DESC;

-- Index for fast corporation_id lookup
CREATE INDEX idx_corp_top_corp_corp_id ON corporation_top_corporation_targets_mv(corporation_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_corp_top_corp_corp_target ON corporation_top_corporation_targets_mv(corporation_id, target_corporation_id);

-- Composite index for corporation + kill_count ordering
CREATE INDEX idx_corp_top_corp_corp_kills ON corporation_top_corporation_targets_mv(corporation_id, kill_count DESC);

-- CreateMaterializedView: alliance_top_corporation_targets_mv
-- Pre-computes top 10 corporation targets for each alliance
-- Refreshed every 5 minutes with other materialized views

CREATE MATERIALIZED VIEW alliance_top_corporation_targets_mv AS
WITH ranked_kills AS (
    SELECT
        a.alliance_id,
        v.corporation_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.alliance_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.alliance_id IS NOT NULL
      AND v.corporation_id IS NOT NULL
    GROUP BY a.alliance_id, v.corporation_id
)
SELECT
    rk.alliance_id,
    rk.corporation_id,
    rk.kill_count,
    co.name as corporation_name
FROM ranked_kills rk
INNER JOIN corporations co ON rk.corporation_id = co.id
WHERE rk.rn <= 10
ORDER BY rk.alliance_id, rk.kill_count DESC;

-- Index for fast alliance_id lookup
CREATE INDEX idx_alliance_top_corp_alliance_id ON alliance_top_corporation_targets_mv(alliance_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_alliance_top_corp_alliance_corp ON alliance_top_corporation_targets_mv(alliance_id, corporation_id);

-- Composite index for alliance + kill_count ordering
CREATE INDEX idx_alliance_top_corp_alliance_kills ON alliance_top_corporation_targets_mv(alliance_id, kill_count DESC);
