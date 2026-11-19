-- The real shape of `killmail_items`, generated, not hand-written:
--
--   pg_dump --schema-only --table=killmail_items --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.killmail_items (
    id bigint NOT NULL,
    killmail_id integer NOT NULL,
    item_type_id integer NOT NULL,
    flag integer NOT NULL,
    quantity_dropped integer,
    quantity_destroyed integer,
    singleton integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE public.killmail_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.killmail_items_id_seq OWNED BY public.killmail_items.id;
ALTER TABLE ONLY public.killmail_items ALTER COLUMN id SET DEFAULT nextval('public.killmail_items_id_seq'::regclass);
ALTER TABLE ONLY public.killmail_items
    ADD CONSTRAINT killmail_items_pkey PRIMARY KEY (id);
CREATE INDEX killmail_items_item_type_id_idx ON public.killmail_items USING btree (item_type_id);
CREATE INDEX killmail_items_killmail_id_flag_idx ON public.killmail_items USING btree (killmail_id, flag);
CREATE INDEX killmail_items_killmail_id_idx ON public.killmail_items USING btree (killmail_id);
ALTER TABLE ONLY public.killmail_items
    ADD CONSTRAINT killmail_items_killmail_id_fkey FOREIGN KEY (killmail_id) REFERENCES public.killmails(killmail_id) ON UPDATE CASCADE ON DELETE CASCADE;
