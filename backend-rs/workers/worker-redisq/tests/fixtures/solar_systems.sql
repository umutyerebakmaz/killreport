-- The real shape of `solar_systems`, generated, not hand-written:
--
--   pg_dump --schema-only --table=solar_systems --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.solar_systems (
    system_id integer NOT NULL,
    name text NOT NULL,
    constellation_id integer,
    security_status double precision,
    security_class text,
    star_id integer,
    position_x double precision,
    position_y double precision,
    position_z double precision,
    position_2d_x double precision,
    position_2d_y double precision
);
ALTER TABLE ONLY public.solar_systems
    ADD CONSTRAINT solar_systems_pkey PRIMARY KEY (system_id);
CREATE INDEX solar_systems_constellation_id_idx ON public.solar_systems USING btree (constellation_id);
ALTER TABLE ONLY public.solar_systems
    ADD CONSTRAINT solar_systems_constellation_id_fkey FOREIGN KEY (constellation_id) REFERENCES public.constellations(constellation_id) ON UPDATE CASCADE ON DELETE RESTRICT;
