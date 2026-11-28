-- The real shape of `character_kill_stats`, generated, not hand-written:
--
--   pg_dump --schema-only --table=character_kill_stats --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.character_kill_stats (
    kill_date date NOT NULL,
    character_id integer NOT NULL,
    kill_count integer
);
ALTER TABLE ONLY public.character_kill_stats
    ADD CONSTRAINT idx_daily_pilot_kills_unique PRIMARY KEY (kill_date, character_id);
CREATE INDEX idx_daily_pilot_kills_date_count ON public.character_kill_stats USING btree (kill_date, kill_count DESC);
