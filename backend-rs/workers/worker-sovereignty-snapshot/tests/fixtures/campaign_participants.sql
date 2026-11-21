-- The real shape of `campaign_participants`, generated, not hand-written:
--
--   pg_dump --schema-only --table=campaign_participants --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.campaign_participants (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    alliance_id integer NOT NULL,
    score double precision NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);
CREATE SEQUENCE public.campaign_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.campaign_participants_id_seq OWNED BY public.campaign_participants.id;
ALTER TABLE ONLY public.campaign_participants ALTER COLUMN id SET DEFAULT nextval('public.campaign_participants_id_seq'::regclass);
ALTER TABLE ONLY public.campaign_participants
    ADD CONSTRAINT campaign_participants_pkey PRIMARY KEY (id);
CREATE INDEX campaign_participants_alliance_id_idx ON public.campaign_participants USING btree (alliance_id);
CREATE UNIQUE INDEX campaign_participants_campaign_id_alliance_id_key ON public.campaign_participants USING btree (campaign_id, alliance_id);
ALTER TABLE ONLY public.campaign_participants
    ADD CONSTRAINT campaign_participants_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.sovereignty_campaigns(campaign_id) ON UPDATE CASCADE ON DELETE CASCADE;
