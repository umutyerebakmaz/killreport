-- The real shape of `sovereignty_campaigns`, generated, not hand-written:
--
--   pg_dump --schema-only --table=sovereignty_campaigns --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.sovereignty_campaigns (
    campaign_id integer NOT NULL,
    constellation_id integer NOT NULL,
    solar_system_id integer NOT NULL,
    structure_id bigint NOT NULL,
    event_type text NOT NULL,
    defender_id integer,
    defender_score double precision,
    attackers_score double precision,
    start_time timestamp(3) without time zone NOT NULL,
    end_time timestamp(3) without time zone,
    outcome text,
    first_seen timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);
ALTER TABLE ONLY public.sovereignty_campaigns
    ADD CONSTRAINT sovereignty_campaigns_pkey PRIMARY KEY (campaign_id);
CREATE INDEX sovereignty_campaigns_constellation_id_idx ON public.sovereignty_campaigns USING btree (constellation_id);
CREATE INDEX sovereignty_campaigns_defender_id_idx ON public.sovereignty_campaigns USING btree (defender_id);
CREATE INDEX sovereignty_campaigns_end_time_idx ON public.sovereignty_campaigns USING btree (end_time);
CREATE INDEX sovereignty_campaigns_solar_system_id_start_time_idx ON public.sovereignty_campaigns USING btree (solar_system_id, start_time);
