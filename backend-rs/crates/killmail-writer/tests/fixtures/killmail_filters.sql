-- The real shape of `killmail_filters`, generated, not hand-written:
--
--   pg_dump --schema-only --table=killmail_filters --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.killmail_filters (
    killmail_id integer NOT NULL,
    killmail_time timestamp(3) without time zone,
    solar_system_id integer,
    attacker_count integer,
    constellation_id integer,
    region_id integer,
    victim_ship_type_id integer,
    victim_character_id integer,
    victim_corporation_id integer,
    victim_alliance_id integer,
    attacker_ship_type_ids integer[],
    attacker_character_ids integer[],
    attacker_corporation_ids integer[],
    attacker_alliance_ids integer[],
    security_status double precision,
    security_class character varying(2),
    victim_ship_group_id integer,
    total_value double precision,
    victim_faction_id integer,
    attacker_faction_ids integer[]
);
ALTER TABLE ONLY public.killmail_filters
    ADD CONSTRAINT idx_kmfilters_killmail_id PRIMARY KEY (killmail_id);
CREATE INDEX idx_kmfilters_attacker_alliances ON public.killmail_filters USING gin (attacker_alliance_ids);
CREATE INDEX idx_kmfilters_attacker_chars ON public.killmail_filters USING gin (attacker_character_ids);
CREATE INDEX idx_kmfilters_attacker_corps ON public.killmail_filters USING gin (attacker_corporation_ids);
CREATE INDEX idx_kmfilters_attacker_factions ON public.killmail_filters USING gin (attacker_faction_ids);
CREATE INDEX idx_kmfilters_attacker_ships ON public.killmail_filters USING gin (attacker_ship_type_ids);
CREATE INDEX idx_kmfilters_constellation ON public.killmail_filters USING btree (constellation_id);
CREATE INDEX idx_kmfilters_region ON public.killmail_filters USING btree (region_id);
CREATE INDEX idx_kmfilters_region_time ON public.killmail_filters USING btree (region_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_security_class ON public.killmail_filters USING btree (security_class);
CREATE INDEX idx_kmfilters_security_class_time ON public.killmail_filters USING btree (security_class, killmail_time DESC);
CREATE INDEX idx_kmfilters_security_status ON public.killmail_filters USING btree (security_status);
CREATE INDEX idx_kmfilters_security_status_time ON public.killmail_filters USING btree (security_status, killmail_time DESC);
CREATE INDEX idx_kmfilters_ship_region_time ON public.killmail_filters USING btree (victim_ship_type_id, region_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_ship_time ON public.killmail_filters USING btree (victim_ship_type_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_system ON public.killmail_filters USING btree (solar_system_id);
CREATE INDEX idx_kmfilters_time ON public.killmail_filters USING btree (killmail_time DESC);
CREATE INDEX idx_kmfilters_time_value ON public.killmail_filters USING btree (killmail_time DESC, total_value DESC);
CREATE INDEX idx_kmfilters_victim_alliance ON public.killmail_filters USING btree (victim_alliance_id);
CREATE INDEX idx_kmfilters_victim_char ON public.killmail_filters USING btree (victim_character_id);
CREATE INDEX idx_kmfilters_victim_corp ON public.killmail_filters USING btree (victim_corporation_id);
CREATE INDEX idx_kmfilters_victim_faction ON public.killmail_filters USING btree (victim_faction_id);
CREATE INDEX idx_kmfilters_victim_group_time ON public.killmail_filters USING btree (victim_ship_group_id, killmail_time DESC);
CREATE INDEX idx_kmfilters_victim_ship ON public.killmail_filters USING btree (victim_ship_type_id);
CREATE INDEX idx_kmfilters_wormhole ON public.killmail_filters USING btree (solar_system_id) WHERE (security_class IS NULL);
