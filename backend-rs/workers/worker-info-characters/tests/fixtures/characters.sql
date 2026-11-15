-- The real shape of `characters`, generated, not hand-written:
--
--   pg_dump --schema-only --table=characters --no-owner --no-privileges "$DATABASE_URL" \
--     | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. The filter drops comments, psql-only \restrict lines and session
-- settings: an empty search_path would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.characters (
    id integer NOT NULL,
    name text NOT NULL,
    corporation_id integer NOT NULL,
    alliance_id integer,
    birthday timestamp(3) without time zone NOT NULL,
    bloodline_id integer NOT NULL,
    race_id integer NOT NULL,
    gender text NOT NULL,
    security_status double precision,
    description text,
    title text,
    faction_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    achievement_score integer,
    character_title_id uuid
);
ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);
CREATE INDEX characters_faction_id_idx ON public.characters USING btree (faction_id);
