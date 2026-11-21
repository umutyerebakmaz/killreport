-- The real shape of `sovereignty_map_snapshots`, generated, not hand-written:
--
--   pg_dump --schema-only --table=sovereignty_map_snapshots --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.sovereignty_map_snapshots (
    id integer NOT NULL,
    solar_system_id integer NOT NULL,
    alliance_id integer,
    corporation_id integer,
    faction_id integer,
    snapshot_date date NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE public.sovereignty_map_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.sovereignty_map_snapshots_id_seq OWNED BY public.sovereignty_map_snapshots.id;
ALTER TABLE ONLY public.sovereignty_map_snapshots ALTER COLUMN id SET DEFAULT nextval('public.sovereignty_map_snapshots_id_seq'::regclass);
ALTER TABLE ONLY public.sovereignty_map_snapshots
    ADD CONSTRAINT sovereignty_map_snapshots_pkey PRIMARY KEY (id);
CREATE INDEX sovereignty_map_snapshots_alliance_id_snapshot_date_idx ON public.sovereignty_map_snapshots USING btree (alliance_id, snapshot_date);
CREATE INDEX sovereignty_map_snapshots_snapshot_date_idx ON public.sovereignty_map_snapshots USING btree (snapshot_date);
CREATE UNIQUE INDEX sovereignty_map_snapshots_solar_system_id_snapshot_date_key ON public.sovereignty_map_snapshots USING btree (solar_system_id, snapshot_date);
