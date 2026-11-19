-- The real shape of `killmails`, generated, not hand-written:
--
--   pg_dump --schema-only --table=killmails --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.killmails (
    killmail_id integer NOT NULL,
    killmail_hash text NOT NULL,
    killmail_time timestamp(3) without time zone NOT NULL,
    solar_system_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    total_value double precision,
    destroyed_value double precision,
    dropped_value double precision,
    attacker_count integer,
    is_war_related boolean DEFAULT false NOT NULL,
    related_campaign_id integer
);
ALTER TABLE ONLY public.killmails
    ADD CONSTRAINT killmails_pkey PRIMARY KEY (killmail_id);
CREATE INDEX killmails_attacker_count_idx ON public.killmails USING btree (attacker_count);
CREATE INDEX killmails_is_war_related_idx ON public.killmails USING btree (is_war_related);
CREATE INDEX killmails_killmail_time_idx ON public.killmails USING btree (killmail_time);
CREATE INDEX killmails_related_campaign_id_idx ON public.killmails USING btree (related_campaign_id);
CREATE INDEX killmails_solar_system_id_idx ON public.killmails USING btree (solar_system_id);
CREATE INDEX killmails_solar_system_id_killmail_time_idx ON public.killmails USING btree (solar_system_id, killmail_time);
CREATE INDEX killmails_total_value_idx ON public.killmails USING btree (total_value DESC NULLS LAST);
