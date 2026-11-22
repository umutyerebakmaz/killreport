-- The real shape of `campaign_combat_stats`, generated, not hand-written:
--
--   pg_dump --schema-only --table=campaign_combat_stats --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.campaign_combat_stats (
    campaign_id integer NOT NULL,
    war_kills integer DEFAULT 0 NOT NULL,
    isk_destroyed double precision DEFAULT 0 NOT NULL,
    ships_destroyed integer DEFAULT 0 NOT NULL,
    last_correlated timestamp(3) without time zone NOT NULL,
    defender_isk_lost double precision DEFAULT 0 NOT NULL,
    attacker_isk_lost double precision DEFAULT 0 NOT NULL,
    defender_ships_lost integer DEFAULT 0 NOT NULL,
    attacker_ships_lost integer DEFAULT 0 NOT NULL
);
ALTER TABLE ONLY public.campaign_combat_stats
    ADD CONSTRAINT campaign_combat_stats_pkey PRIMARY KEY (campaign_id);
CREATE INDEX campaign_combat_stats_isk_destroyed_idx ON public.campaign_combat_stats USING btree (isk_destroyed);
ALTER TABLE ONLY public.campaign_combat_stats
    ADD CONSTRAINT campaign_combat_stats_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.sovereignty_campaigns(campaign_id) ON UPDATE CASCADE ON DELETE CASCADE;
