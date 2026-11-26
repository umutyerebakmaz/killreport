-- The real shape of `killmail_refs`, generated, not hand-written:
--
--   pg_dump --schema-only --table=killmail_refs --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.killmail_refs (
    killmail_id integer NOT NULL,
    killmail_hash text NOT NULL,
    source text NOT NULL,
    discovered_at timestamp(3) without time zone NOT NULL,
    queued_count integer DEFAULT 0 NOT NULL,
    last_queued_at timestamp(3) without time zone
);
ALTER TABLE ONLY public.killmail_refs
    ADD CONSTRAINT killmail_refs_pkey PRIMARY KEY (killmail_id);
CREATE INDEX killmail_refs_last_queued_at_idx ON public.killmail_refs USING btree (last_queued_at);
