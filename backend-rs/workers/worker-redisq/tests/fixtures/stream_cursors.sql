-- The real shape of `stream_cursors`, generated, not hand-written:
--
--   pg_dump --schema-only --table=stream_cursors --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | sed -e '/^--/d' -e '/^.restrict /d' -e '/^.unrestrict /d' \
--       -e '/^SET /d' -e '/^SELECT pg_catalog.set_config/d' -e '/^$/d'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.stream_cursors (
    stream text NOT NULL,
    sequence bigint NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);
ALTER TABLE ONLY public.stream_cursors
    ADD CONSTRAINT stream_cursors_pkey PRIMARY KEY (stream);
