-- The real shape of `item_groups`, generated, not hand-written:
--
--   pg_dump --schema-only --table=item_groups --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.item_groups (
    id integer NOT NULL,
    name text NOT NULL,
    category_id integer NOT NULL,
    published boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);
ALTER TABLE ONLY public.item_groups
    ADD CONSTRAINT item_groups_pkey PRIMARY KEY (id);
CREATE INDEX item_groups_category_id_idx ON public.item_groups USING btree (category_id);
