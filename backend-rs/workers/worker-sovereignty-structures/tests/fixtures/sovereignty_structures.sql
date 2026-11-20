-- The real shape of `sovereignty_structures`, generated, not hand-written:
--
--   pg_dump --schema-only --table=sovereignty_structures --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.sovereignty_structures (
    structure_id bigint NOT NULL,
    solar_system_id integer NOT NULL,
    structure_type_id integer NOT NULL,
    alliance_id integer NOT NULL,
    vulnerability_occupancy_level double precision,
    vulnerable_start_time timestamp(3) without time zone,
    vulnerable_end_time timestamp(3) without time zone,
    first_seen timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen timestamp(3) without time zone NOT NULL,
    destroyed_at timestamp(3) without time zone
);
ALTER TABLE ONLY public.sovereignty_structures
    ADD CONSTRAINT sovereignty_structures_pkey PRIMARY KEY (structure_id);
CREATE INDEX sovereignty_structures_alliance_id_idx ON public.sovereignty_structures USING btree (alliance_id);
CREATE INDEX sovereignty_structures_solar_system_id_idx ON public.sovereignty_structures USING btree (solar_system_id);
CREATE INDEX sovereignty_structures_structure_type_id_idx ON public.sovereignty_structures USING btree (structure_type_id);
CREATE INDEX sovereignty_structures_vulnerable_start_time_idx ON public.sovereignty_structures USING btree (vulnerable_start_time);
