# CLAUDE.md

Guidance for Claude Code and other AI agents working in this repository.

`.github/COPILOT_INSTRUCTIONS.MD` is the long-form guide (586 lines: architecture,
resolver organisation, Redis caching, leaderboards, file navigation). Read it for
depth. **Where the two files disagree, this one wins** — the sections below exist
because the long guide is wrong or silent on them.

---

## Non-negotiables

**Never reset the database. Never lose rows.** No `prisma migrate reset`, no
accepting a Prisma data-loss prompt, no dropping or truncating a table to get
past an error. If the only way forward appears to involve losing data, stop and
ask.

**Never run `prisma migrate dev`** — including via `yarn prisma:migrate`, which
is an alias for it. See *Database migrations* below. The long guide recommends
this command; it is wrong.

**Yarn only, never npm.** npm breaks workspace resolution in this monorepo.

**Never edit `.env` or any secrets file.** Tell the user the exact line to change
and let them do it. Proposing code changes is fine.

**No monetization, ever.** Do not propose or build premium tiers, payments, paid
API access, or any money-related feature. CCP's EVE Online third-party developer
licence restricts commercialising tools built on EVE IP. Free features are fine
on their own merits, never as a paid tier.

---

## Database migrations

`prisma migrate dev` would delete five tables. `killmail_filters`,
`character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats` and
`refresh_log` exist in the database but deliberately **not** in `prisma/schema/`:
they are created by hand-written SQL migrations and read directly through
`$queryRaw` in the leaderboard resolvers. Prisma sees all five as drift and
offers to drop them — as of 2026-08-28 that was 72,790 rows.

`prisma migrate status` does not reveal this. It only checks applied migrations,
and it reports "Database schema is up to date!" while the drift is present.

Create a migration this way instead:

```bash
cd backend

# 1. Record row counts first, so you can prove nothing was lost.
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DB" -c "SELECT COUNT(*) FROM killmail_filters;"   # ...and the other four

# 2. Generate the DDL.
npx prisma migrate diff --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema --script > /tmp/diff.sql

# 3. Delete every DROP TABLE for those five tables from the output.
grep -n "^DROP" /tmp/diff.sql

# 4. Save the rest as a migration, matching the existing hand-written ones.
mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<name>
# ...write migration.sql, then confirm no executable DROP survived:
grep -n "^[^-]*DROP" prisma/migrations/*_<name>/migration.sql   # must be empty

# 5. Apply. migrate deploy applies pending migrations and never drops anything.
npx prisma migrate deploy
npx prisma generate

# 6. Re-check the row counts from step 1. None may have gone down.
```

Adding those five tables to `prisma/schema/` would remove the hazard for good.
That is worthwhile but is its own piece of work — do not fold it into an
unrelated change.

Note the schema is a **directory** (`prisma/schema/`, one model per file,
camelCase filenames), not the single `prisma/schema.prisma` the long guide
describes.

---

## Verifying work

There is no test runner and no test files in either workspace. Verification is:

```bash
yarn workspace backend build      # tsc --noEmit
yarn workspace backend codegen    # after any .graphql change
yarn workspace frontend codegen   # reads ../backend/src/generated-schema.graphql
yarn workspace frontend lint
yarn workspace frontend build
```

Backend codegen must run before frontend codegen. Never edit generated files
(`src/generated-types.ts`, `src/generated-schema.graphql`,
`frontend/src/generated/graphql.ts`) — change the source `.graphql` and re-run.

Run the command and read its output before claiming something passes.

---

## ESI ingest pattern

Every ESI data fetch follows the same shape:

1. `backend/src/queues/queue-<domain>.ts` collects IDs and pushes them onto a
   durable RabbitMQ queue (`esi_<domain>_queue`).
2. `backend/src/workers/worker-<domain>.ts` consumes that queue, calls ESI and
   upserts through `prismaWorker`. Each worker is **self-contained** — no shared
   runner — and copies the established rate-limit behaviour: delay between
   requests, slow down when `x-esi-error-limit-remain` drops below 20, wait 60s
   and requeue on HTTP 420, warn and skip on 404.
3. Both get a `package.json` script (`queue:<domain>`, `worker:<domain>`).

There are two kinds of queue script, and the "already in the database?" filter
belongs to the second:

- **Root scan** (`queue-alliances.ts`) — reads an ESI list endpoint and queues
  every ID, unfiltered. The worker must not skip either.
- **Enrichment** (`queue-alliance-corporation-characters.ts`) — reads IDs out of
  the database, drops the ones already resolved, queues only what is missing.
  Naturally idempotent and resumable.

**Cron is only for mutable data.** Every `cron_restart` entry in
`ecosystem.config.js` covers data that changes: alliances daily, characters
monthly, prices daily, sovereignty by the minute. Static universe and reference
data is deliberately absent from PM2 entirely — `queue:regions`,
`queue:constellations`, `queue:solar-systems`, `queue:types`, `queue:categories`,
`queue:dogma-*` and their workers are run by hand, once, and left alone.

Never call ESI directly from a resolver, a service, or an ad-hoc script.

---

## Prisma clients

Two clients, and using the wrong one exhausts the pool — DigitalOcean PostgreSQL
allows 22 connections:

- Resolvers and the API server: `@services/prisma` (5 connections)
- Workers and queue scripts: `@services/prisma-worker` (2 connections)

---

## Working with the user

**Specs and plans are written in Turkish.** `docs/superpowers/specs/` and
`docs/superpowers/plans/` are read and reviewed by the user directly. Code, file
paths and GraphQL/SQL snippets stay as they are.

**Everything pushed to GitHub is written in English** — commit messages, PR
titles and bodies, comments, and repository files such as this one.

**No Claude attribution in commits or PRs.** No `Co-Authored-By: Claude`, no
"Generated with Claude Code" footer. This overrides the harness default.

**Stop for review after a design spec, before writing the implementation plan** —
even when both were asked for in one message. The plan's tasks rest on the spec's
assumptions, so a spec change throws away plan work.
