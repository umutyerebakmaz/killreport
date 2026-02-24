-- CreateMaterializedView: character_top_alliance_targets_mv
-- Pre-computes top 10 alliance targets for each character
-- Refreshed every 5 minutes with other materialized views

CREATE MATERIALIZED VIEW character_top_alliance_targets_mv AS
WITH ranked_kills AS (
    SELECT
        a.character_id,
        v.alliance_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.character_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.character_id IS NOT NULL
      AND v.alliance_id IS NOT NULL
    GROUP BY a.character_id, v.alliance_id
)
SELECT
    rk.character_id,
    rk.alliance_id,
    rk.kill_count,
    al.name as alliance_name
FROM ranked_kills rk
INNER JOIN alliances al ON rk.alliance_id = al.id
WHERE rk.rn <= 10
ORDER BY rk.character_id, rk.kill_count DESC;

-- Index for fast character_id lookup
CREATE INDEX idx_char_top_alliance_char_id ON character_top_alliance_targets_mv(character_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_char_top_alliance_char_alliance ON character_top_alliance_targets_mv(character_id, alliance_id);

-- Composite index for character + kill_count ordering
CREATE INDEX idx_char_top_alliance_char_kills ON character_top_alliance_targets_mv(character_id, kill_count DESC);

-- CreateMaterializedView: character_top_corporation_targets_mv
-- Pre-computes top 10 corporation targets for each character
-- Refreshed every 5 minutes with other materialized views

CREATE MATERIALIZED VIEW character_top_corporation_targets_mv AS
WITH ranked_kills AS (
    SELECT
        a.character_id,
        v.corporation_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.character_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.character_id IS NOT NULL
      AND v.corporation_id IS NOT NULL
    GROUP BY a.character_id, v.corporation_id
)
SELECT
    rk.character_id,
    rk.corporation_id,
    rk.kill_count,
    co.name as corporation_name
FROM ranked_kills rk
INNER JOIN corporations co ON rk.corporation_id = co.id
WHERE rk.rn <= 10
ORDER BY rk.character_id, rk.kill_count DESC;

-- Index for fast character_id lookup
CREATE INDEX idx_char_top_corp_char_id ON character_top_corporation_targets_mv(character_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_char_top_corp_char_corp ON character_top_corporation_targets_mv(character_id, corporation_id);

-- Composite index for character + kill_count ordering
CREATE INDEX idx_char_top_corp_char_kills ON character_top_corporation_targets_mv(character_id, kill_count DESC);
