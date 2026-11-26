-- The real shape of `market_prices`, generated, not hand-written:
--
--   pg_dump --schema-only --table=market_prices --no-owner --no-privileges "$DATABASE_URL" \
--     | tr -d '\r' | grep -Ev '^(--|\\(un)?restrict|SET |SELECT pg_catalog\.set_config)' | grep -v '^$'
--
-- against a database with every migration in backend/prisma/migrations
-- applied. `tr` strips the CR a Windows pg_dump ends its lines with, which
-- would keep the filter from matching. The filter drops comments,
-- psql-only \restrict lines and session settings: an empty search_path
-- would outlive the fixture on its connection.
-- Regenerate it after a migration that touches this table.
CREATE TABLE public.market_prices (
    type_id integer NOT NULL,
    buy double precision DEFAULT 0 NOT NULL,
    sell double precision DEFAULT 0 NOT NULL,
    average double precision DEFAULT 0 NOT NULL,
    volume double precision DEFAULT 0 NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE ONLY public.market_prices
    ADD CONSTRAINT market_prices_pkey PRIMARY KEY (type_id);
CREATE INDEX market_prices_updated_at_idx ON public.market_prices USING btree (updated_at);
ALTER TABLE ONLY public.market_prices
    ADD CONSTRAINT market_prices_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.types(id) ON UPDATE CASCADE ON DELETE CASCADE;
