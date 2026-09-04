-- killmail_filters: repair NULL location columns and add two derived columns.
--
-- region_id and constellation_id have been NULL on every row written since the
-- materialized view became a real table (migration 20260226000000): the join that
-- derived them was not carried into insertKillmailFilter, which expects them from
-- callers that never pass them. 37,781 of 44,493 rows were affected.
--
-- victim_ship_group_id and total_value are new. They let a scope-and-value query run
-- against this table alone, without joining types or killmails.
--
-- This migration only adds columns, fills columns and creates indexes. It drops
-- nothing and deletes nothing; row counts are unchanged.

ALTER TABLE killmail_filters
  ADD COLUMN IF NOT EXISTS victim_ship_group_id INT,
  ADD COLUMN IF NOT EXISTS total_value          DOUBLE PRECISION;

-- Location and security, derived the way the original materialized view did.
-- Runs over every row and is idempotent.
UPDATE killmail_filters f
SET constellation_id = ss.constellation_id,
    region_id        = c.region_id,
    security_status  = ss.security_status,
    security_class   = ss.security_class
FROM solar_systems ss
LEFT JOIN constellations c ON c.constellation_id = ss.constellation_id
WHERE ss.system_id = f.solar_system_id;

-- Victim ship group. A type's group never changes, so this needs no later sync.
UPDATE killmail_filters f
SET victim_ship_group_id = t.group_id
FROM types t
WHERE t.id = f.victim_ship_type_id;

-- Cached ISK value. worker-backfill-values.ts keeps this in step from here on.
UPDATE killmail_filters f
SET total_value = k.total_value
FROM killmails k
WHERE k.killmail_id = f.killmail_id;

CREATE INDEX IF NOT EXISTS idx_kmfilters_victim_group_time
  ON killmail_filters(victim_ship_group_id, killmail_time DESC);

CREATE INDEX IF NOT EXISTS idx_kmfilters_time_value
  ON killmail_filters(killmail_time DESC, total_value DESC);
