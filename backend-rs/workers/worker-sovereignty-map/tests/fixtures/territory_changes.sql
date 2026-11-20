-- The real shape of `territory_changes`, generated, not hand-written:
--
--   pg_dump --schema-only --table=territory_changes --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.territory_changes (
    id bigint NOT NULL,
    solar_system_id integer NOT NULL,
    previous_owner_id integer,
    new_owner_id integer,
    previous_faction_id integer,
    new_faction_id integer,
    change_type text NOT NULL,
    detected_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE public.territory_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.territory_changes_id_seq OWNED BY public.territory_changes.id;
ALTER TABLE ONLY public.territory_changes ALTER COLUMN id SET DEFAULT nextval('public.territory_changes_id_seq'::regclass);
ALTER TABLE ONLY public.territory_changes
    ADD CONSTRAINT territory_changes_pkey PRIMARY KEY (id);
CREATE INDEX territory_changes_new_owner_id_idx ON public.territory_changes USING btree (new_owner_id);
CREATE INDEX territory_changes_previous_owner_id_idx ON public.territory_changes USING btree (previous_owner_id);
CREATE INDEX territory_changes_solar_system_id_detected_at_idx ON public.territory_changes USING btree (solar_system_id, detected_at);
