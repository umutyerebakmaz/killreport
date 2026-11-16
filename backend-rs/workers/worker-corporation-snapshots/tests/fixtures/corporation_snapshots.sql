-- The real shape of `corporation_snapshots`, generated, not hand-written:
--
--   pg_dump --schema-only --table=corporation_snapshots --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.corporation_snapshots (
    id bigint NOT NULL,
    corporation_id integer NOT NULL,
    member_count integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    snapshot_date date NOT NULL
);
CREATE SEQUENCE public.corporation_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.corporation_snapshots_id_seq OWNED BY public.corporation_snapshots.id;
ALTER TABLE ONLY public.corporation_snapshots ALTER COLUMN id SET DEFAULT nextval('public.corporation_snapshots_id_seq'::regclass);
ALTER TABLE ONLY public.corporation_snapshots
    ADD CONSTRAINT corporation_snapshots_pkey PRIMARY KEY (id);
CREATE INDEX corporation_snapshots_corporation_id_idx ON public.corporation_snapshots USING btree (corporation_id);
CREATE UNIQUE INDEX corporation_snapshots_corporation_id_snapshot_date_key ON public.corporation_snapshots USING btree (corporation_id, snapshot_date);
CREATE INDEX corporation_snapshots_created_at_idx ON public.corporation_snapshots USING btree (created_at);
CREATE INDEX corporation_snapshots_snapshot_date_idx ON public.corporation_snapshots USING btree (snapshot_date);
ALTER TABLE ONLY public.corporation_snapshots
    ADD CONSTRAINT corporation_snapshots_corporation_id_fkey FOREIGN KEY (corporation_id) REFERENCES public.corporations(id) ON UPDATE CASCADE ON DELETE CASCADE;
