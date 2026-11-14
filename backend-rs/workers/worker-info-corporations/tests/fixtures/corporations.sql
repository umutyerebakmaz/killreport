-- The real shape of `corporations`, generated, not hand-written:
--
--   pg_dump --schema-only --table=corporations --no-owner --no-privileges "$DATABASE_URL" \
--     | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. The filter drops comments, psql-only \restrict lines and session
-- settings: an empty search_path would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.corporations (
    id integer NOT NULL,
    name text NOT NULL,
    ticker text NOT NULL,
    member_count integer NOT NULL,
    ceo_id integer NOT NULL,
    creator_id integer NOT NULL,
    date_founded timestamp(3) without time zone,
    description text,
    alliance_id integer,
    faction_id integer,
    home_station_id integer,
    shares bigint,
    tax_rate double precision NOT NULL,
    url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);
ALTER TABLE ONLY public.corporations
    ADD CONSTRAINT corporations_pkey PRIMARY KEY (id);
CREATE INDEX corporations_alliance_id_idx ON public.corporations USING btree (alliance_id);
CREATE INDEX corporations_faction_id_idx ON public.corporations USING btree (faction_id);
