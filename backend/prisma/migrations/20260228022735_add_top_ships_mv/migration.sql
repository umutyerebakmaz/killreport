-- CreateMaterializedView: character_top_ships_mv
-- Pre-computes top 10 ship types killed by each character
-- Refreshed every 5 minutes with other materialized views

CREATE MATERIALIZED VIEW character_top_ships_mv AS
WITH ranked_kills AS (
    SELECT
        a.character_id,
        v.ship_type_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.character_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.character_id IS NOT NULL
      AND v.ship_type_id IS NOT NULL
    GROUP BY a.character_id, v.ship_type_id
)
SELECT
    rk.character_id,
    rk.ship_type_id,
    rk.kill_count,
    t.name as ship_name
FROM ranked_kills rk
INNER JOIN types t ON rk.ship_type_id = t.id
WHERE rk.rn <= 10
ORDER BY rk.character_id, rk.kill_count DESC;

-- Index for fast character_id lookup
CREATE INDEX idx_char_top_ships_char_id ON character_top_ships_mv(character_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_char_top_ships_char_ship ON character_top_ships_mv(character_id, ship_type_id);

-- Composite index for character + kill_count ordering
CREATE INDEX idx_char_top_ships_char_kills ON character_top_ships_mv(character_id, kill_count DESC);

-- CreateMaterializedView: corporation_top_ships_mv
-- Pre-computes top 10 ship types killed by each corporation
-- Refreshed every 5 minutes with other materialized views

CREATE MATERIALIZED VIEW corporation_top_ships_mv AS
WITH ranked_kills AS (
    SELECT
        a.corporation_id,
        v.ship_type_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.corporation_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.corporation_id IS NOT NULL
      AND v.ship_type_id IS NOT NULL
    GROUP BY a.corporation_id, v.ship_type_id
)
SELECT
    rk.corporation_id,
    rk.ship_type_id,
    rk.kill_count,
    t.name as ship_name
FROM ranked_kills rk
INNER JOIN types t ON rk.ship_type_id = t.id
WHERE rk.rn <= 10
ORDER BY rk.corporation_id, rk.kill_count DESC;

-- Index for fast corporation_id lookup
CREATE INDEX idx_corp_top_ships_corp_id ON corporation_top_ships_mv(corporation_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_corp_top_ships_corp_ship ON corporation_top_ships_mv(corporation_id, ship_type_id);

-- Composite index for corporation + kill_count ordering
CREATE INDEX idx_corp_top_ships_corp_kills ON corporation_top_ships_mv(corporation_id, kill_count DESC);

-- CreateMaterializedView: alliance_top_ships_mv
-- Pre-computes top 10 ship types killed by each alliance
-- Refreshed every 5 minutes with other materialized views

CREATE MATERIALIZED VIEW alliance_top_ships_mv AS
WITH ranked_kills AS (
    SELECT
        a.alliance_id,
        v.ship_type_id,
        COUNT(*) as kill_count,
        ROW_NUMBER() OVER (PARTITION BY a.alliance_id ORDER BY COUNT(*) DESC) as rn
    FROM attackers a
    INNER JOIN victims v ON a.killmail_id = v.killmail_id
    WHERE a.alliance_id IS NOT NULL
      AND v.ship_type_id IS NOT NULL
    GROUP BY a.alliance_id, v.ship_type_id
)
SELECT
    rk.alliance_id,
    rk.ship_type_id,
    rk.kill_count,
    t.name as ship_name
FROM ranked_kills rk
INNER JOIN types t ON rk.ship_type_id = t.id
WHERE rk.rn <= 10
ORDER BY rk.alliance_id, rk.kill_count DESC;

-- Index for fast alliance_id lookup
CREATE INDEX idx_alliance_top_ships_alliance_id ON alliance_top_ships_mv(alliance_id);

-- Enable concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_alliance_top_ships_alliance_ship ON alliance_top_ships_mv(alliance_id, ship_type_id);

-- Composite index for alliance + kill_count ordering
CREATE INDEX idx_alliance_top_ships_alliance_kills ON alliance_top_ships_mv(alliance_id, kill_count DESC);
