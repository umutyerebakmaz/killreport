-- Convert killmail_filters_mv from MATERIALIZED VIEW to regular TABLE
-- This allows incremental INSERT operations for better performance

-- Step 1: Create a regular table with the same structure
CREATE TABLE killmail_filters_table AS
SELECT * FROM killmail_filters_mv;

-- Step 2: Drop the materialized view
DROP MATERIALIZED VIEW killmail_filters_mv;

-- Step 3: Rename table to clean name (remove _mv suffix)
ALTER TABLE killmail_filters_table RENAME TO killmail_filters;

-- Step 4: Recreate all indexes
-- Victim filters
CREATE INDEX idx_kmfilters_victim_ship ON killmail_filters(victim_ship_type_id);
CREATE INDEX idx_kmfilters_victim_char ON killmail_filters(victim_character_id);
CREATE INDEX idx_kmfilters_victim_corp ON killmail_filters(victim_corporation_id);
CREATE INDEX idx_kmfilters_victim_alliance ON killmail_filters(victim_alliance_id);

-- Location indexes
CREATE INDEX idx_kmfilters_region ON killmail_filters(region_id);
CREATE INDEX idx_kmfilters_system ON killmail_filters(solar_system_id);
CREATE INDEX idx_kmfilters_constellation ON killmail_filters(constellation_id);

-- Time index
CREATE INDEX idx_kmfilters_time ON killmail_filters(killmail_time DESC);

-- GIN indexes for array searches
CREATE INDEX idx_kmfilters_attacker_ships ON killmail_filters USING GIN(attacker_ship_type_ids);
CREATE INDEX idx_kmfilters_attacker_chars ON killmail_filters USING GIN(attacker_character_ids);
CREATE INDEX idx_kmfilters_attacker_corps ON killmail_filters USING GIN(attacker_corporation_ids);
CREATE INDEX idx_kmfilters_attacker_alliances ON killmail_filters USING GIN(attacker_alliance_ids);

-- Composite indexes
CREATE INDEX idx_kmfilters_ship_time ON killmail_filters(victim_ship_type_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_region_time ON killmail_filters(region_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_ship_region_time ON killmail_filters(victim_ship_type_id, region_id, killmail_time DESC);

-- Unique index (PRIMARY KEY equivalent)
CREATE UNIQUE INDEX idx_kmfilters_killmail_id ON killmail_filters(killmail_id);

-- Add primary key
ALTER TABLE killmail_filters ADD PRIMARY KEY USING INDEX idx_kmfilters_killmail_id;
