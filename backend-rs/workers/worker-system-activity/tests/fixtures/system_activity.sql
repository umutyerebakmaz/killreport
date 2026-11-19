-- The real shape of `system_activity`, generated, not hand-written:
--
--   pg_dump --schema-only --table=system_activity --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.system_activity (
    id integer NOT NULL,
    system_id integer NOT NULL,
    npc_kills integer DEFAULT 0 NOT NULL,
    pod_kills integer DEFAULT 0 NOT NULL,
    ship_kills integer DEFAULT 0 NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ship_jumps integer
);
CREATE SEQUENCE public.system_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.system_activity_id_seq OWNED BY public.system_activity.id;
ALTER TABLE ONLY public.system_activity ALTER COLUMN id SET DEFAULT nextval('public.system_activity_id_seq'::regclass);
ALTER TABLE ONLY public.system_activity
    ADD CONSTRAINT system_activity_pkey PRIMARY KEY (id);
CREATE INDEX system_activity_ship_kills_idx ON public.system_activity USING btree (ship_kills);
CREATE INDEX system_activity_system_id_timestamp_idx ON public.system_activity USING btree (system_id, "timestamp");
CREATE UNIQUE INDEX system_activity_system_id_timestamp_key ON public.system_activity USING btree (system_id, "timestamp");
ALTER TABLE ONLY public.system_activity
    ADD CONSTRAINT system_activity_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.solar_systems(system_id) ON UPDATE CASCADE ON DELETE CASCADE;
