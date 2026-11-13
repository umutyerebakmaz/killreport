-- The real shape of `alliances`, generated, not hand-written:
--
--   pg_dump --schema-only --table=alliances --no-owner --no-privileges "$DATABASE_URL" \
--     | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. The filter drops comments, psql-only \restrict lines and session
-- settings: an empty search_path would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.alliances (
    id integer NOT NULL,
    name text NOT NULL,
    ticker text NOT NULL,
    date_founded timestamp(3) without time zone NOT NULL,
    creator_corporation_id integer NOT NULL,
    creator_id integer NOT NULL,
    executor_corporation_id integer,
    faction_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    corporation_count integer DEFAULT 0 NOT NULL,
    member_count integer DEFAULT 0 NOT NULL
);
ALTER TABLE ONLY public.alliances
    ADD CONSTRAINT alliances_pkey PRIMARY KEY (id);
