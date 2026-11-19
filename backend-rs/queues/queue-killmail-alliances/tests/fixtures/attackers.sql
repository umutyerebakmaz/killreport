-- The real shape of `attackers`, generated, not hand-written:
--
--   pg_dump --schema-only --table=attackers --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.attackers (
    killmail_id integer NOT NULL,
    character_id integer,
    corporation_id integer,
    alliance_id integer,
    ship_type_id integer,
    weapon_type_id integer,
    damage_done integer NOT NULL,
    final_blow boolean NOT NULL,
    security_status double precision,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    faction_id integer,
    id bigint NOT NULL
);
CREATE SEQUENCE public.attackers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.attackers_id_seq OWNED BY public.attackers.id;
ALTER TABLE ONLY public.attackers ALTER COLUMN id SET DEFAULT nextval('public.attackers_id_seq'::regclass);
ALTER TABLE ONLY public.attackers
    ADD CONSTRAINT attackers_pkey PRIMARY KEY (id);
CREATE INDEX attackers_alliance_id_idx ON public.attackers USING btree (alliance_id);
CREATE INDEX attackers_alliance_id_killmail_id_idx ON public.attackers USING btree (alliance_id, killmail_id);
CREATE INDEX attackers_character_id_idx ON public.attackers USING btree (character_id);
CREATE INDEX attackers_character_id_killmail_id_idx ON public.attackers USING btree (character_id, killmail_id);
CREATE INDEX attackers_corporation_id_idx ON public.attackers USING btree (corporation_id);
CREATE INDEX attackers_corporation_id_killmail_id_idx ON public.attackers USING btree (corporation_id, killmail_id);
CREATE INDEX attackers_killmail_id_idx ON public.attackers USING btree (killmail_id);
CREATE INDEX attackers_ship_type_id_idx ON public.attackers USING btree (ship_type_id);
ALTER TABLE ONLY public.attackers
    ADD CONSTRAINT attackers_killmail_id_fkey FOREIGN KEY (killmail_id) REFERENCES public.killmails(killmail_id) ON UPDATE CASCADE ON DELETE CASCADE;
