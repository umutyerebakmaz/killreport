-- The real shape of `users`, generated, not hand-written:
--
--   pg_dump --schema-only --table=users --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.users (
    id integer NOT NULL,
    character_id integer NOT NULL,
    character_name text NOT NULL,
    character_owner_hash text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp(3) without time zone NOT NULL,
    email text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    last_killmail_id integer,
    last_killmail_sync_at timestamp(3) without time zone,
    corporation_id integer,
    last_corp_killmail_id integer,
    last_corp_killmail_sync_at timestamp(3) without time zone,
    corp_killmails_denied_at timestamp(3) without time zone
);
CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE INDEX users_character_id_idx ON public.users USING btree (character_id);
CREATE UNIQUE INDEX users_character_id_key ON public.users USING btree (character_id);
CREATE INDEX users_corporation_id_idx ON public.users USING btree (corporation_id);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX users_expires_at_idx ON public.users USING btree (expires_at);
CREATE INDEX users_last_corp_killmail_sync_at_idx ON public.users USING btree (last_corp_killmail_sync_at);
CREATE INDEX users_last_killmail_sync_at_idx ON public.users USING btree (last_killmail_sync_at);
