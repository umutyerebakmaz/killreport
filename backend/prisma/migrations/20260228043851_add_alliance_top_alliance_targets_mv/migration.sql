-- CreateMaterializedView: alliance_top_alliance_targets_mv
-- Pre-computes top 10 alliance targets for each alliance
-- Refreshed every 10 minutes with other materialized views

CREATE MATERIALIZED VIEW alliance_top_alliance_targets_mv AS
WITH ranked_kills AS (
    SELECT
        a.alliance_id,
        v.alliance_id as victim_alliance_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.alliance_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.alliance_id IS NOT NULL
      AND v.alliance_id IS NOT NULL
      AND a.alliance_id != v.alliance_id  -- Exclude self-kills
    GROUP BY a.alliance_id, v.alliance_id
)
SELECT
    rk.alliance_id,
    rk.victim_alliance_id as target_alliance_id,
    rk.kill_count,
    al.name as alliance_name,
    al.ticker as alliance_ticker
FROM ranked_kills rk
INNER JOIN alliances al ON rk.victim_alliance_id = al.id
WHERE rk.rn <= 10
ORDER BY rk.alliance_id, rk.kill_count DESC;

-- Index for fast alliance_id lookup
CREATE INDEX idx_alliance_top_alliance_alliance_id ON alliance_top_alliance_targets_mv(alliance_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_alliance_top_alliance_alliance_target ON alliance_top_alliance_targets_mv(alliance_id, target_alliance_id);

-- Composite index for alliance + kill_count ordering
CREATE INDEX idx_alliance_top_alliance_alliance_kills ON alliance_top_alliance_targets_mv(alliance_id, kill_count DESC);
