# CLAUDE.md

Guidance for Claude Code and other AI agents working in this repository.

**KillReport** — a full-stack EVE Online killmail tracker. Yarn workspaces
monorepo: GraphQL Yoga backend on :4000, Next.js App Router frontend on :3000,
PostgreSQL via Prisma, RabbitMQ workers, Redis cache.

```text
User request → GraphQL → DataLoader (batching) → Prisma → PostgreSQL
                     ↓
             RabbitMQ queue → Workers → ESI / zKillboard → PostgreSQL
```

---

## Non-negotiables

**Never reset the database. Never lose rows.** No `prisma migrate reset`, no
accepting a Prisma data-loss prompt, no dropping or truncating a table to get
past an error. If the only way forward appears to involve losing data, stop and
ask.

**Never run `prisma migrate dev`.** A `PreToolUse` hook in
`.claude/settings.json` denies it, together with `migrate reset` and
`db push --force-reset`. The `prisma:migrate` script that used to alias it
was removed on 2026-09-22. See _Database migrations_.

**Yarn only, never npm.** Yarn workspaces are configured in the root
`package.json`; npm writes a conflicting `package-lock.json` and breaks workspace
resolution. `yarn install`, `yarn add`, `yarn remove`, `yarn dev`, `yarn codegen`.
If you catch yourself typing `npm`, stop and rewrite it.

**Never edit `.env` or any secrets file.** Tell the user the exact line to change
and let them do it. Proposing code changes is fine.

**Never edit generated files** — `backend/src/generated-types.ts`,
`backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`.
Change the source `.graphql` and re-run codegen.

**No monetization, ever.** Do not propose or build premium tiers, payments, paid
API access, or any money-related feature. CCP's EVE Online third-party developer
licence restricts commercialising tools built on EVE IP. Free features are fine
on their own merits, never as a paid tier.

---

## Separation of concerns

Mandatory, and the codebase does not always obey it — follow it in new code
anyway.

| Layer      | Path                       | Responsibility                                                |
| ---------- | -------------------------- | ------------------------------------------------------------- |
| Services   | `backend/src/services/`    | Business logic, database queries, external API calls, caching |
| Resolvers  | `backend/src/resolvers/`   | GraphQL orchestration only — delegate to services             |
| Schema     | `backend/src/schemas/`     | GraphQL type definitions, modular, `extend type Query`        |
| Workers    | `backend/src/workers/`     | Queue processing, isolated from API logic                     |
| Queues     | `backend/src/queues/`      | Job publishers                                                |
| Components | `frontend/src/components/` | Reusable presentational UI, no business logic                 |
| Utilities  | `utils/`, `helpers/`       | Pure functions, no side effects                               |

- ✅ Resolver calls a service; the service queries the database.
- ✅ Services own Redis caching; resolvers do not know a cache exists.
- ✅ Independent top-level queries for statistics, executed in parallel.
- ❌ Database query logic inside a resolver.
- ❌ Nested resolvers that cause N+1.

### The service layer, in practice

The table above is the target, not a description of the code. As of 2026-09-03
`backend/src/services/` holds two different things, and only one of them is what
the table means by a service:

- **ESI clients** — `AllianceService`, `CharacterService`, `TypeService`,
  `CategoryService`, `killmail/killmail.service.ts` and the rest. A class of
  `static` methods wrapping `esiClient`. Almost every caller
  is a worker or a queue script, which is correct: resolvers must never call ESI.
- **Read services the resolvers call** — there are four:
  `alliance/alliance-stats.service.ts`, `character/character-stats.service.ts`,
  `corporation/corporation-stats.service.ts` (all three exporting plain
  `async function`s) and `solar-system/solar-system-stats.service.ts` (a class of
  `static` methods). Each one is `redis.get` → `$queryRaw` → `redis.setex`, with
  every filter parameter in the cache key.

Everything else reads the database straight from the resolver — every query in
`resolvers/killmail/queries.ts` among them. That is the debt, and it is why a new
service can look out of place next to its neighbours. It isn't: **a new read path
gets a service in the second style, whatever the file beside it does.** Prefer the
plain-function form; the `static`-method class is the odd one out and exists only
because `solar-system-stats` was written that way first.

Do not refactor the existing resolvers into services as a side effect of an
unrelated change. It is real work with its own review, and mixing it into a
feature diff hides both.

---

## Database migrations

`prisma migrate dev` would delete five tables. `killmail_filters`,
`character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats` and
`refresh_log` exist in the database but deliberately **not** in `prisma/schema/`:
they are created by hand-written SQL migrations and read through `$queryRaw` in
the leaderboard resolvers. Prisma sees all five as drift and offers to drop them
— as of 2026-08-28 that was 72,790 rows.

`prisma migrate status` does not reveal this. It only checks applied migrations
and reports "Database schema is up to date!" while the drift is present.

Create one with the procedure in `backend/prisma/CLAUDE.md`, which loads when
you work under `backend/prisma/`. It records row counts, generates the DDL with
`prisma migrate diff`, strips the `DROP TABLE`s for those five tables and
applies with `migrate deploy`.

### Prisma naming

Models are singular PascalCase (`Alliance`, `SolarSystem`); tables are plural
snake_case via `@@map` (`alliances`, `solar_systems`). Columns stay snake_case,
so field resolvers map them to camelCase for GraphQL.

Primary keys are usually remapped too: a model's `id` field is `system_id`,
`planet_id`, `moon_id`, `asteroid_belt_id`, `stargate_id`, `star_id` or
`station_id` in the database. Raw SQL and `psql` must use the mapped name —
`SELECT id FROM planets` fails with `column "id" does not exist`.

### Two Prisma clients

The two clients are sized for different jobs. Do not swap them:

- Resolvers and the API server: `@services/prisma` (5 connections)
- Workers and queue scripts: `@services/prisma-worker` (10 connections per
  process; the Rust `db` crate matches it)

Idle worker connections are released, so only busy workers hold any. The budget
is busy workers × 10, plus the API's 5, which must stay under PostgreSQL's
`max_connections` (default 100). DigitalOcean managed PostgreSQL, whose
22-connection cap the old sizes (API 5, workers 2) were cut for, is no longer
used. The `backend/docs/deployment/` pages describing it are historical.

---

## Verifying work

Run the two servers from the repo root:

```bash
yarn dev:backend     # GraphQL Yoga on :4000 by default
yarn dev:frontend    # Next.js on :3000 by default
yarn install         # installs both workspaces
```

Vitest 5 runs in both workspaces — `yarn test` from the root runs backend then
frontend. The full set is:

```bash
yarn test
yarn workspace backend build      # tsc --noEmit
yarn workspace backend codegen    # after any .graphql change — run this first
yarn workspace frontend codegen   # reads ../backend/src/generated-schema.graphql
yarn workspace frontend lint
yarn workspace frontend build
```

Backend codegen must run before frontend codegen. Run the command and read its
output before claiming anything passes.

### When to run which

CI runs the full set on every PR, so locally run only what the edit can
actually break — per edit and before the PR alike. The full set runs locally
only for a **serious** change: logic in a resolver, service, worker or queue,
a `.graphql` or Prisma schema, a migration, a dependency bump, or build and
tooling config. Anything lighter — class strings, CSS, copy, Markdown — goes
to the PR on the table's row alone and CI is the full pass.

When the full set does run, hand it to the `qa` agent in the background
rather than running it in the main session, and keep working while it goes.
Migrations and `$queryRaw` column questions go to the `database` agent.

| The edit touches                       | What can break                  | Run                     |
| -------------------------------------- | ------------------------------- | ----------------------- |
| `className` or a `.css` file           | nothing type- or test-checkable | nothing                 |
| `.tsx` structure, props, an interface  | types                           | `build`                 |
| a `.graphql` document                  | generated types, call sites     | `codegen`, then `build` |
| logic, `utils/`, a resolver, a service | behaviour                       | `test`, then `build`    |

Class strings are the row worth stating outright: no spec asserts on one, and
ESLint does not parse Tailwind, so `test` and `lint` cannot fail on a class
change. Those are verified by looking at the page, which is the user's job.

One check sits outside the table because it applies to every row, including a
change that touches nothing but Markdown: CI runs **Format**, which is
`prettier --check .` over the whole repo. Run `npx prettier --check <file>` on
whatever you edited before opening the PR. `.husky/pre-commit` calls
`lint-staged` to do this automatically, but the hook only fires where husky is
installed — `git config core.hooksPath` is empty in a checkout where it is
not, and there the commit is formatted by nobody.

The cost of skipping is honesty about it. **Until a check has run, say "not
verified yet" rather than "passes"** — for a light change that means naming
CI as the pass that will run it. Skipping a command is a scheduling
decision; claiming its result without running it is not.

`lint` reports pre-existing problems across the repo — 141 as of 2026-09-17.
The number, not a clean exit, is the signal: compare it against `main` and
confirm none of the entries name a file the branch touched.

Other debugging entry points:

```bash
cd backend && yarn prisma:studio            # data browser on :5555
# worker queue depths, through the API:
#   query { workerStatus { queueName messageCount consumerCount } }
```

### Running a second checkout alongside this one

Both ports are configurable, and every kill script derives its target from the
same place the server itself does — so a second checkout can never kill the
first one's processes.

- **Backend:** `PORT` in `backend/.env`, read by `src/config/config.ts`.
  `yarn kill` greps that same line. With no `PORT` it kills nothing rather than
  falling back to 4000, which would be another project's port.
- **Frontend:** `PORT` in the real environment — the `next` CLI resolves
  `-p` flag > `PORT` > 3000, so `yarn kill` uses `${PORT:-3000}`. Reading it
  from `.env.local` would be wrong: Next loads env files only after the CLI has
  already resolved the port. `yarn dev` passes the **same expression** as `-p`,
  and that is load-bearing: with neither `-p` nor `PORT` given, `next dev`
  treats its port as a suggestion and silently moves to the next free one
  (`server/lib/start-server.js`, `port += 1`, ten times over), guarded by
  `allowRetry = portSource === 'default'` in `cli/next-dev.js`. A server that
  drifted to 3001 is one `yarn kill` can never reach again, because the script
  only ever knows one port. With `-p` Next fails on EADDRINUSE instead, the way
  the backend already does.

Never kill by process name. `pkill -f 'next.*dev'` and `pkill node` reach every
project on the machine, not just this one.

Both scripts delegate the killing to `scripts/kill-port.sh`. Why it picks its
tool per platform, and the silent failures it guards against, are in
`scripts/CLAUDE.md`.

Redis needs the same treatment. Keys carry no project prefix, and the
response-cache `invalidate` runs a `KEYS` pattern scan across the whole database
(`backend/src/plugins/response-cache.plugin.ts`), so it can delete another
application's keys. Give each checkout its own logical database:

```bash
REDIS_URL="redis://localhost:6379/1"
```

Two caveats: Redis pub/sub is global and ignores the database index, so
`NEW_KILLMAIL` and `SOVEREIGNTY_ALERT` stay shared — real isolation there needs
a second Redis instance. And logical databases do not exist in Redis Cluster,
so keep this to a local `.env`.

---

## GraphQL

### Workflow

1. Edit `.graphql` under `backend/src/schemas/` (`extend type Query` for
   modularity).
2. `yarn codegen` in backend → regenerates `generated-types.ts` and
   `generated-schema.graphql`.
3. Implement resolvers under `backend/src/resolvers/{domain}/`.
4. Wire them into `backend/src/resolvers/index.ts`.
5. Add the frontend document under `frontend/src/graphql/`, then `yarn codegen`
   in frontend for typed hooks.

### Frontend components

App Router: any component using hooks or state needs the `"use client"`
directive at the top of the file. Components stay presentational — data fetching
belongs in the page or a container, business logic in `utils/`.

### DataLoaders

Every field resolver that follows a relation must use a DataLoader. They are
created per request in `server.ts` via `createDataLoaders()`; the implementations
are in `backend/src/services/dataloaders.ts`. The pattern is one batched
`WHERE id IN (...)` per tick. Grouping loaders return `[]` rather than `null`, so
an empty relation is an empty list and not an error.

### Redis caching

Key format is `{domain}:{action}:{param}:{param}` and **every** filter parameter
must appear, or one query poisons another's cache.

| Data                                   | TTL     |
| -------------------------------------- | ------- |
| Real-time (today, current week/month)  | 300 s   |
| Historical (past dates, never changes) | 3600 s  |
| Rarely changing (alliance/corp info)   | 7200 s  |
| Static (type info, system info)        | 86400 s |

`::BIGINT` columns come back from `$queryRaw` as JavaScript `BigInt`, and
`JSON.stringify` throws on those — convert with `Number()` before caching.

---

## Workers and queues

Each queue has one dedicated worker, and every worker hardcodes its queue name as
a `QUEUE_NAME` constant. Queue names carry a source prefix — `esi_*` for EVE ESI,
`zkillboard_*` for zKillboard.

### The ingest pattern

1. `backend/src/queues/queue-<domain>.ts` collects IDs and pushes them onto a
   durable queue (`esi_<domain>_queue`).
2. `backend/src/workers/worker-<domain>.ts` consumes it, calls ESI, upserts via
   `prismaWorker`. Each worker is **self-contained at runtime**: its own
   process, its own connection and pool, its own `QUEUE_NAME`, so one worker
   crashing, stopping or restarting never affects another. Rust workers share
   the consume loop as a library (`backend-rs/crates/runner`) compiled into
   each binary; that is shared code, not a shared process. Never run several
   workers inside one process.
3. Both get a `package.json` script (`queue:<domain>`, `worker:<domain>`).

Two kinds of queue script, and the "already in the database?" filter belongs to
the second:

- **Root scan** (`queue-alliances.ts`) — reads an ESI list endpoint and queues
  every ID, unfiltered. The worker must not skip either.
- **Enrichment** (`queue-alliance-corporation-characters.ts`) — reads IDs out of
  the database, drops the ones already resolved, queues only what is missing.
  Naturally idempotent and resumable.

The Rust `queue-types` sits between the two. It reads its candidates from an
ESI list endpoint (`/universe/types/`, every page), but applies the "already
in the database?" filter like an enrichment queue, so the Rust
`worker-info-types` never skips: it upserts what it is given (the Node worker
still does). The Node `queue-types.ts` collects
types group by group and reads only the first page of `/universe/groups/`, so
it misses every group past it.

The Rust `queue-alliance-corporations` is a root scan that reads the alliance list from ESI (`/alliances`), while the Node `queue-alliance-corporations.ts` reads alliance IDs from the database.

RabbitMQ is a conveyor belt, not a store. The durable record of outstanding work
is the database.

### Entity enrichment

`yarn scan:entities:rs` queues the character, corporation, alliance and type
IDs that killmails name but the database does not have, one SQL anti-join over
victims, attackers and killmail items per domain; four workers then fetch them
from ESI. It is a chain of four `queue-killmail-*` binaries; the Node
`scan:entities` runs the same SQL. Upserts keep concurrent workers from racing.
It does **not** filter NPCs: ESI resolves them and killmail pages show their
names. The one NPC filter, in `queues/queue-alliance-corporation-characters.ts`,
is `id < 1_000_000 || (id >= 3_000_000 && id < 4_000_000)`.

### zKillboard sync

No auth needed for public character history. Fetch IDs from zKillboard, then
details from ESI, then save. 200 killmails per page.
`worker-zkillboard-sync.ts` defaults to `MAX_PAGES = 100` (20,000 killmails);
the direct script defaults to 50 and takes an override:
`yarn sync:character 365974960 10`.

### Declaring a queue

**Every `assertQueue` call must pass `arguments: { 'x-max-priority': 10 }`.**
`server.ts` calls `ensureAllQueuesExist()` on startup and declares every queue
that way, so a declaration that omits it fails with:

```text
406 PRECONDITION_FAILED - inequivalent arg 'x-max-priority' for queue '...':
received none but current is the value '10' of type 'byte'
```

The worker then exits immediately. This bit the region, constellation and solar
system queues and workers, which were all unable to start until it was fixed on
2026-08-28.

### Rate limiting

ESI rate limits, the shared Redis budget, `ESI_MAX_RPS`, worker prefetch and
`handleWorkerError` are described in `backend/CLAUDE.md`, which loads when you
work under `backend/`. The rules:

**Every ESI request goes through `esiClient.get`**
(`backend/src/services/esi-client.ts`). It sends the `User-Agent` and
`X-Compatibility-Date` headers, takes a limiter slot, reports the response
headers back to the limiter, throws `EsiThrottledError` on 420/429 and keeps the
`Authorization` header out of error messages. `esi-client.guard.spec.ts` fails
if any other file names `esi.evetech.net`. Do not write a rate limit, an
error-limit check or a retry sleep of your own. zKillboard needs 10 seconds
between calls to the same endpoint.

### Scheduling is only for mutable data

There is **one** scheduling mechanism: **systemd timers** in `deploy/systemd/`,
one `.timer` beside each job's `Type=oneshot` service. Alliances run daily,
`queue:characters` and `queue:character-corporations` weekly (Monday 16:10
and 17:00 UTC), prices daily, sovereignty every few minutes, system kills
hourly, and the database backup nightly. systemd is also the only process
manager: PM2 and `ecosystem.config.js` were removed on 2026-11-16, and the OS
crontab stays empty. Described in `backend/docs/ops/systemd.md`;
`backend/src/ops/systemd-units.guard.spec.ts` pins every unit to that
inventory.

One schedule lives inside an application instead: the API server publishes
the user and corporation killmail syncs every 10 minutes itself
(`backend/src/services/killmail-sync-cron.ts`, started in `server.ts`). Never
add a timer for those two queues.

A job is scheduled by exactly one timer. The character queues once sat in
both PM2 and the crontab and ran twice (#316); a second mechanism is how that
comes back.

Everything a timer schedules is data that changes. Static universe and
reference data has **no** timer: `queue:regions`, `queue:constellations`,
`queue:solar-systems`, `queue:types`, `queue:categories`, `queue:dogma-*` and
their workers are run by hand, once, and left alone.

Never call ESI directly from a resolver, a service used by resolvers, or an
ad-hoc script — it goes through a queue and a worker, and every request in the
worker goes through `esiClient`.

---

## Leaderboards

Pre-aggregated daily tables — `character_kill_stats`, `corporation_kill_stats`,
`alliance_kill_stats` — keyed on `(kill_date, entity_id, kill_count)` with a
composite index on `(kill_date, kill_count DESC)`.

They are updated **inside the transaction that saves a killmail**, with an atomic
`ON CONFLICT DO UPDATE`. No cron, no refresh job, no materialized view; a new
kill shows up within seconds. The update logic lives in
`backend/src/services/kill-stats-realtime.ts` and the resolvers in
`backend/src/resolvers/leaderboard/queries.ts`.

Never aggregate over raw `killmails` or `attackers` for a leaderboard.

---

## Authentication

1. Frontend calls the `login` mutation → receives an EVE SSO URL.
2. User authenticates at EVE SSO → callback carries `code`.
3. Frontend calls `authenticateWithCode(code, state)` → receives a JWT.
4. Token is stored in `localStorage` as `eve_access_token`.
5. Apollo's `authLink` sends `Authorization: Bearer <token>`.
6. `server.ts` validates it through `verifyToken()` in `eve-sso.ts`.

Subscriptions use WebSocket (`graphql-ws`), not SSE. Browsers cap ~6 HTTP/1.1
connections per origin and the always-on subscriptions used to saturate that in
local dev. Because the handshake cannot carry headers, auth travels in
`connectionParams`. **Deploy gotcha:** the production Nginx proxy for `/graphql`
must forward the upgrade — `proxy_http_version 1.1`,
`proxy_set_header Upgrade $http_upgrade`, `proxy_set_header Connection "upgrade"`
— or production subscriptions break.

Environment variables load through `backend/src/config.ts`, the single source of
truth. Required: `EVE_CLIENT_ID`, `EVE_CLIENT_SECRET`, `DATABASE_URL`,
`RABBITMQ_URL`. The frontend reads `process.env.NEXT_PUBLIC_*` directly.

---

## Performance checklist

**Always**

- Use the pre-aggregated stats tables for leaderboards.
- Cache with contextual keys that include every filter parameter.
- Use DataLoaders in every relation-following field resolver.
- Add composite indexes for sorted queries — `(date, count DESC)`.
- Cap limits: `Math.min(filter?.limit ?? default, max)`.
- Batch with `WHERE id IN (...)`, then `Map` for O(1) lookup.
- Different TTLs for live and historical data.

**Never**

- Aggregate over raw `killmails` / `attackers`.
- Fetch everything and filter in JavaScript.
- Query inside a loop.
- Omit a parameter from a cache key.
- Share a Prisma client between workers and the API.
- Edit generated files, or reach for npm.

---

---

## Documentation

Living docs are under `backend/docs/` — `architecture.md`, `workers/`,
`leaderboards/`, `esi/`, `redis-cache/`, `authentication/`, `deployment/`.
Design specs and implementation plans live under `docs/superpowers/`.

### Markdown links

Use paths relative to the file containing the link. A leading slash resolves
against the site root, so `/backend/src/x.ts` renders on GitHub as
`https://github.com/backend/src/x.ts` — a 404. From
`backend/docs/workers/x.md` to `backend/src/workers/y.ts` that is
`../../src/workers/y.ts`.

Verify before committing — a link that renders is not proof it resolves:

```bash
grep -rn --include='*.md' -oE '\]\([^)#][^)]*\)' . | grep -v node_modules
```

---

## Working with the user

**Specs and plans are written in Turkish.** `docs/superpowers/specs/` and
`docs/superpowers/plans/` are read and reviewed by the user directly. Code, file
paths and GraphQL/SQL snippets stay as they are.

**Everything pushed to GitHub is written in English** — branch names, commit
messages, PR titles and bodies, comments, and repository files such as this one.
Branch names included even when the branch was created from a Turkish request,
and even before it is pushed: rename it at the start, not at review time.

**No Claude attribution in commits or PRs.** No `Co-Authored-By: Claude`, no
"Generated with Claude Code" footer. This overrides the harness default.

**Check whether one `package.json` line does the job before adding a file under
`scripts/`.** Files there are welcome when the work needs one — `backup-db.sh`
and `reset-rabbitmq.sh` earn their place. The failure mode is reaching for a
file when a single line would do, usually because of invented defensive branches
(quote stripping, whitespace tolerance, extra fallbacks) for inputs the real
data never produces; that padding is what makes a one-liner look like it needs
a file. Yarn Berry runs scripts through its own portable shell, which handles
`{ ...; }`, `${VAR:-default}`, `$(...)` and `&&` / `||` / `;`. Functions, arrays
and `trap` are where a script file genuinely becomes necessary.

**Uniformity beats the local optimum.** One queue and one worker per domain,
each worker owning a single table. A design that departs from the established
pattern is wrong however well it fits the case at hand. Present constraints as
items the design must solve, cited with `file:line` — never as objections to the
user's proposal. Own past design decisions instead of defending them.

**The user often raises these as questions rather than directions** — "do we
really need this?", "you know better". Weigh the merits and say plainly when
they are right, rather than deferring automatically or defending the original.

**Stop for review after a design spec, before writing the implementation plan** —
even when both were asked for in one message. The plan's tasks rest on the spec's
assumptions, so a spec change throws away plan work.

**UI and visual verification belong to the user.** Do not drive a browser to
check a page; it is slower than the user simply looking. Verify frontend work
with `lint` and `build`, verify data with a direct GraphQL query against the
backend, then say what to look at.
