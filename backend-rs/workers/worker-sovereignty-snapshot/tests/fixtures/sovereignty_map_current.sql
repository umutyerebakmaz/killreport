-- The real shape of `sovereignty_map_current`, generated, not hand-written:
--
--   pg_dump --schema-only --table=sovereignty_map_current --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.sovereignty_map_current (
    solar_system_id integer NOT NULL,
    alliance_id integer,
    corporation_id integer,
    faction_id integer,
    last_updated timestamp(3) without time zone NOT NULL
);
ALTER TABLE ONLY public.sovereignty_map_current
    ADD CONSTRAINT sovereignty_map_current_pkey PRIMARY KEY (solar_system_id);
CREATE INDEX sovereignty_map_current_alliance_id_idx ON public.sovereignty_map_current USING btree (alliance_id);
CREATE INDEX sovereignty_map_current_faction_id_idx ON public.sovereignty_map_current USING btree (faction_id);
