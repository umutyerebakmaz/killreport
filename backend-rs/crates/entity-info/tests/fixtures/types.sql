-- The real shape of `types`, generated, not hand-written:
--
--   pg_dump --schema-only --table=types --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.types (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    group_id integer NOT NULL,
    published boolean DEFAULT true NOT NULL,
    volume double precision,
    capacity double precision,
    mass double precision,
    icon_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    meta_group_id integer
);
ALTER TABLE ONLY public.types
    ADD CONSTRAINT types_pkey PRIMARY KEY (id);
CREATE INDEX types_group_id_idx ON public.types USING btree (group_id);
