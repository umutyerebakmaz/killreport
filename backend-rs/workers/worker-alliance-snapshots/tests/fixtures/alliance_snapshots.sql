-- The real shape of `alliance_snapshots`, generated, not hand-written:
--
--   pg_dump --schema-only --table=alliance_snapshots --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.alliance_snapshots (
    id bigint NOT NULL,
    alliance_id integer NOT NULL,
    member_count integer NOT NULL,
    corporation_count integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    snapshot_date date NOT NULL
);
CREATE SEQUENCE public.alliance_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.alliance_snapshots_id_seq OWNED BY public.alliance_snapshots.id;
ALTER TABLE ONLY public.alliance_snapshots ALTER COLUMN id SET DEFAULT nextval('public.alliance_snapshots_id_seq'::regclass);
ALTER TABLE ONLY public.alliance_snapshots
    ADD CONSTRAINT alliance_snapshots_pkey PRIMARY KEY (id);
CREATE INDEX alliance_snapshots_alliance_id_idx ON public.alliance_snapshots USING btree (alliance_id);
CREATE UNIQUE INDEX alliance_snapshots_alliance_id_snapshot_date_key ON public.alliance_snapshots USING btree (alliance_id, snapshot_date);
CREATE INDEX alliance_snapshots_created_at_idx ON public.alliance_snapshots USING btree (created_at);
CREATE INDEX alliance_snapshots_snapshot_date_idx ON public.alliance_snapshots USING btree (snapshot_date);
ALTER TABLE ONLY public.alliance_snapshots
    ADD CONSTRAINT alliance_snapshots_alliance_id_fkey FOREIGN KEY (alliance_id) REFERENCES public.alliances(id) ON UPDATE CASCADE ON DELETE CASCADE;
