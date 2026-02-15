-- CreateMaterializedView: killmail_filters_mv
-- This materialized view pre-computes killmail filter data for better query performance
-- Eliminates need for complex JOINs and provides O(1) indexed lookups

CREATE MATERIALIZED VIEW killmail_filters_mv AS
SELECT
    k.killmail_id,
    k.killmail_time,
    k.solar_system_id,
    k.attacker_count,
    ss.constellation_id,
    c.region_id,
    v.ship_type_id as victim_ship_type_id,
    v.character_id as victim_character_id,
    v.corporation_id as victim_corporation_id,
    v.alliance_id as victim_alliance_id,
    -- Attacker arrays for fast ANY queries
    array_agg(DISTINCT a.ship_type_id) FILTER (WHERE a.ship_type_id IS NOT NULL) as attacker_ship_type_ids,
    array_agg(DISTINCT a.character_id) FILTER (WHERE a.character_id IS NOT NULL) as attacker_character_ids,
    array_agg(DISTINCT a.corporation_id) FILTER (WHERE a.corporation_id IS NOT NULL) as attacker_corporation_ids,
    array_agg(DISTINCT a.alliance_id) FILTER (WHERE a.alliance_id IS NOT NULL) as attacker_alliance_ids
FROM killmails k
INNER JOIN victims v ON k.killmail_id = v.killmail_id
LEFT JOIN attackers a ON k.killmail_id = a.killmail_id
LEFT JOIN solar_systems ss ON k.solar_system_id = ss.system_id
LEFT JOIN constellations c ON ss.constellation_id = c.constellation_id
GROUP BY
    k.killmail_id,
    k.killmail_time,
    k.solar_system_id,
    k.attacker_count,
    ss.constellation_id,
    c.region_id,
    v.ship_type_id,
    v.character_id,
    v.corporation_id,
    v.alliance_id;

-- Indexes for victim filters (most common)
CREATE INDEX idx_kmfilters_victim_ship ON killmail_filters_mv(victim_ship_type_id);
CREATE INDEX idx_kmfilters_victim_char ON killmail_filters_mv(victim_character_id);
CREATE INDEX idx_kmfilters_victim_corp ON killmail_filters_mv(victim_corporation_id);
CREATE INDEX idx_kmfilters_victim_alliance ON killmail_filters_mv(victim_alliance_id);

-- Location indexes
CREATE INDEX idx_kmfilters_region ON killmail_filters_mv(region_id);
CREATE INDEX idx_kmfilters_system ON killmail_filters_mv(solar_system_id);
CREATE INDEX idx_kmfilters_constellation ON killmail_filters_mv(constellation_id);

-- Time index (DESC for recent killmails first)
CREATE INDEX idx_kmfilters_time ON killmail_filters_mv(killmail_time DESC);

-- GIN indexes for array searches (attacker filters)
CREATE INDEX idx_kmfilters_attacker_ships ON killmail_filters_mv USING GIN(attacker_ship_type_ids);
CREATE INDEX idx_kmfilters_attacker_chars ON killmail_filters_mv USING GIN(attacker_character_ids);
CREATE INDEX idx_kmfilters_attacker_corps ON killmail_filters_mv USING GIN(attacker_corporation_ids);
CREATE INDEX idx_kmfilters_attacker_alliances ON killmail_filters_mv USING GIN(attacker_alliance_ids);

-- Composite indexes for common filter combinations
CREATE INDEX idx_kmfilters_ship_time ON killmail_filters_mv(victim_ship_type_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_region_time ON killmail_filters_mv(region_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_ship_region_time ON killmail_filters_mv(victim_ship_type_id, region_id, killmail_time DESC);

-- Enable concurrent refresh (requires unique index on killmail_id)
CREATE UNIQUE INDEX idx_kmfilters_killmail_id ON killmail_filters_mv(killmail_id);
