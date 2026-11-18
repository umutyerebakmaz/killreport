-- The real shape of `character_corporation_history`, generated, not
-- hand-written:
--
--   pg_dump --schema-only --table=character_corporation_history --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.character_corporation_history (
    record_id bigint NOT NULL,
    character_id integer NOT NULL,
    corporation_id integer NOT NULL,
    start_date timestamp(3) without time zone NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    fetched_at timestamp(3) without time zone NOT NULL
);
ALTER TABLE ONLY public.character_corporation_history
    ADD CONSTRAINT character_corporation_history_pkey PRIMARY KEY (record_id);
CREATE INDEX character_corporation_history_character_id_idx ON public.character_corporation_history USING btree (character_id);
