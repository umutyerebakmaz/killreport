-- The real shape of `alliance_territory_stats`, generated, not hand-written:
--
--   pg_dump --schema-only --table=alliance_territory_stats --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.alliance_territory_stats (
    id integer NOT NULL,
    alliance_id integer NOT NULL,
    date date NOT NULL,
    systems_controlled integer DEFAULT 0 NOT NULL,
    tcu_count integer DEFAULT 0 NOT NULL,
    ihub_count integer DEFAULT 0 NOT NULL,
    campaigns_attacking integer DEFAULT 0 NOT NULL,
    campaigns_defending integer DEFAULT 0 NOT NULL,
    systems_gained integer DEFAULT 0 NOT NULL,
    systems_lost integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE public.alliance_territory_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.alliance_territory_stats_id_seq OWNED BY public.alliance_territory_stats.id;
ALTER TABLE ONLY public.alliance_territory_stats ALTER COLUMN id SET DEFAULT nextval('public.alliance_territory_stats_id_seq'::regclass);
ALTER TABLE ONLY public.alliance_territory_stats
    ADD CONSTRAINT alliance_territory_stats_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX alliance_territory_stats_alliance_id_date_key ON public.alliance_territory_stats USING btree (alliance_id, date);
CREATE INDEX alliance_territory_stats_date_idx ON public.alliance_territory_stats USING btree (date);
CREATE INDEX alliance_territory_stats_systems_controlled_idx ON public.alliance_territory_stats USING btree (systems_controlled);
