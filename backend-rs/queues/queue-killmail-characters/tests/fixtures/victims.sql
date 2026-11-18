-- The real shape of `victims`, generated, not hand-written:
--
--   pg_dump --schema-only --table=victims --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.victims (
    killmail_id integer NOT NULL,
    character_id integer,
    corporation_id integer NOT NULL,
    alliance_id integer,
    faction_id integer,
    ship_type_id integer NOT NULL,
    damage_taken integer NOT NULL,
    position_x double precision,
    position_y double precision,
    position_z double precision,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE ONLY public.victims
    ADD CONSTRAINT victims_pkey PRIMARY KEY (killmail_id);
CREATE INDEX victims_alliance_id_idx ON public.victims USING btree (alliance_id);
CREATE INDEX victims_alliance_id_killmail_id_idx ON public.victims USING btree (alliance_id, killmail_id);
CREATE INDEX victims_character_id_idx ON public.victims USING btree (character_id);
CREATE INDEX victims_character_id_killmail_id_idx ON public.victims USING btree (character_id, killmail_id);
CREATE INDEX victims_corporation_id_idx ON public.victims USING btree (corporation_id);
CREATE INDEX victims_corporation_id_killmail_id_idx ON public.victims USING btree (corporation_id, killmail_id);
CREATE INDEX victims_ship_type_id_idx ON public.victims USING btree (ship_type_id);
ALTER TABLE ONLY public.victims
    ADD CONSTRAINT victims_killmail_id_fkey FOREIGN KEY (killmail_id) REFERENCES public.killmails(killmail_id) ON UPDATE CASCADE ON DELETE CASCADE;
