-- The real shape of `constellations`, generated, not hand-written:
--
--   pg_dump --schema-only --table=constellations --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.constellations (
    constellation_id integer NOT NULL,
    name text NOT NULL,
    region_id integer,
    position_x double precision,
    position_y double precision,
    position_z double precision
);
ALTER TABLE ONLY public.constellations
    ADD CONSTRAINT constellations_pkey PRIMARY KEY (constellation_id);
CREATE INDEX constellations_region_id_idx ON public.constellations USING btree (region_id);
ALTER TABLE ONLY public.constellations
    ADD CONSTRAINT constellations_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(region_id) ON UPDATE CASCADE ON DELETE RESTRICT;
