# CLAUDE.md

Guidance for Claude Code and other AI agents working in this repository.

This file replaces `.github/COPILOT_INSTRUCTIONS.MD`, removed on 2026-08-28.
Everything still true was carried over. Where the old guide had drifted from the
code the entry is marked **Correction:** so the difference is visible rather than
silently overwritten.

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

**Never run `prisma migrate dev`** — including through `yarn prisma:migrate`,
which is an alias for it. See _Database migrations_.

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

**Correction:** the old guide said schemas live in `src/schema/` and queue
scripts in `src/scripts/`. They are `src/schemas/` and `src/queues/`.

### The service layer, in practice

The table above is the target, not a description of the code. As of 2026-09-03
`backend/src/services/` holds two different things, and only one of them is what
the table means by a service:

- **ESI clients** — `AllianceService`, `CharacterService`, `TypeService`,
  `CategoryService`, `killmail/killmail.service.ts` and the rest. A class of
  `static` methods wrapping `fetch` behind `esiRateLimiter`. Almost every caller
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
Worthwhile, but its own piece of work — do not fold it into an unrelated change.

**Correction:** the schema is a **directory** (`prisma/schema/`, one model per
file, camelCase filenames), not the single `prisma/schema.prisma` the old guide
described. The old guide also recommended `yarn prisma:migrate`, which is the
dangerous command.

### Prisma naming

Models are singular PascalCase (`Alliance`, `SolarSystem`); tables are plural
snake_case via `@@map` (`alliances`, `solar_systems`). Columns stay snake_case,
so field resolvers map them to camelCase for GraphQL.

Primary keys are usually remapped too: a model's `id` field is `system_id`,
`planet_id`, `moon_id`, `asteroid_belt_id`, `stargate_id`, `star_id` or
`station_id` in the database. Raw SQL and `psql` must use the mapped name —
`SELECT id FROM planets` fails with `column "id" does not exist`.

### Two Prisma clients

Using the wrong one exhausts the pool — DigitalOcean PostgreSQL allows 22
connections:

- Resolvers and the API server: `@services/prisma` (5 connections)
- Workers and queue scripts: `@services/prisma-worker` (2 connections)

---

## Verifying work

Run the two servers from the repo root:

```bash
yarn dev:backend     # GraphQL Yoga on :4000 by default
yarn dev:frontend    # Next.js on :3000 by default
yarn install         # installs both workspaces
```

There is no test runner and no test files in either workspace. Verification is:

```bash
yarn workspace backend build      # tsc --noEmit
yarn workspace backend codegen    # after any .graphql change — run this first
yarn workspace frontend codegen   # reads ../backend/src/generated-schema.graphql
yarn workspace frontend lint
yarn workspace frontend build
```

Backend codegen must run before frontend codegen. Run the command and read its
output before claiming anything passes.

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
  already resolved the port.

Never kill by process name. `pkill -f 'next.*dev'` and `pkill node` reach every
project on the machine, not just this one.

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

**Correction:** the old guide said frontend `.graphql` files are co-located with
components. In practice every document lives in `frontend/src/graphql/`.

### Frontend components

App Router: any component using hooks or state needs the `"use client"`
directive at the top of the file. Components stay presentational — data fetching
belongs in the page or a container, business logic in `utils/`.

### Resolver organisation

```text
backend/src/resolvers/
├── index.ts              # combines everything with the spread operator
├── character/
│   ├── fields.ts         # field resolvers, relations via DataLoader
│   ├── mutations.ts
│   └── queries.ts
├── leaderboard/queries.ts
└── ...
```

Export one object per file — `characterQueries`, `characterMutations`,
`characterFields` — and combine them in `index.ts`:

```typescript
export const resolvers: Resolvers = {
  Query: { ...userQueries, ...characterQueries, ...leaderboardQueries },
  Mutation: { ...userMutations, ...characterMutations },
  Character: characterFields,
};
```

### DataLoaders

Every field resolver that follows a relation must use a DataLoader. They are
created per request in `server.ts` via `createDataLoaders()`; the implementations
are in `backend/src/services/dataloaders.ts`. The pattern is one batched
`WHERE id IN (...)` per tick. Grouping loaders return `[]` rather than `null`, so
an empty relation is an empty list and not an error.

### Redis caching

```typescript
const cacheKey = `domain:action:${param1}:${param2}:${limit}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await /* ...query... */;

await redis.setex(cacheKey, isToday ? 300 : 3600, JSON.stringify(data));
return data;
```

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

### Common patterns

```typescript
// Dynamic limit with a hard cap
const limit = Math.min(filter?.limit ?? 100, 100);

// Batch + Map lookup instead of a query inside a loop
const characters = await prisma.character.findMany({ where: { id: { in: ids } } });
const charMap = new Map(characters.map((c) => [c.id, c]));

// Prisma Date → ISO string for GraphQL
{ ...char, birthday: char.birthday.toISOString(),
  updatedAt: char.updated_at?.toISOString() ?? null,
  securityStatus: char.security_status ?? null }

// Week Monday, UTC
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();              // 0=Sun
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split("T")[0];
}
```

---

## Workers and queues

Each queue has one dedicated worker, and every worker hardcodes its queue name as
a `QUEUE_NAME` constant. Queue names carry a source prefix — `esi_*` for EVE ESI,
`zkillboard_*` for zKillboard.

### The ingest pattern

1. `backend/src/queues/queue-<domain>.ts` collects IDs and pushes them onto a
   durable queue (`esi_<domain>_queue`).
2. `backend/src/workers/worker-<domain>.ts` consumes it, calls ESI, upserts via
   `prismaWorker`. Each worker is **self-contained** — no shared runner.
3. Both get a `package.json` script (`queue:<domain>`, `worker:<domain>`).

Two kinds of queue script, and the "already in the database?" filter belongs to
the second:

- **Root scan** (`queue-alliances.ts`) — reads an ESI list endpoint and queues
  every ID, unfiltered. The worker must not skip either.
- **Enrichment** (`queue-alliance-corporation-characters.ts`) — reads IDs out of
  the database, drops the ones already resolved, queues only what is missing.
  Naturally idempotent and resumable.

RabbitMQ is a conveyor belt, not a store. The durable record of outstanding work
is the database.

Established ESI queues and their consumers:

| Queue                             | Worker script                  |
| --------------------------------- | ------------------------------ |
| `esi_alliance_info_queue`         | `worker:info:alliances`        |
| `esi_character_info_queue`        | `worker:info:characters`       |
| `esi_corporation_info_queue`      | `worker:info:corporations`     |
| `esi_type_info_queue`             | `worker:info:types`            |
| `esi_alliance_corporations_queue` | `worker:alliance-corporations` |
| `esi_solar_systems_queue`         | `worker:solar-systems`         |
| `zkillboard_character_queue`      | `worker:zkillboard`            |

### Entity enrichment

`yarn scan:entities` walks killmails and queues the character, corporation,
alliance and type IDs that are missing from the database; four workers then fetch
them from ESI. Upserts keep concurrent workers from racing. NPCs are filtered out
by ID range — the real predicate, in
`queues/queue-alliance-corporation-characters.ts`, is
`id < 1_000_000 || (id >= 3_000_000 && id < 4_000_000)`.

**Correction:** the old guide gave this filter as "character_id < 3000000 or

> 100000000", which is not what the code does.

### zKillboard sync

No auth needed for public character history. Fetch IDs from zKillboard, then
details from ESI, then save. 200 killmails per page.
`worker-zkillboard-sync.ts` defaults to `MAX_PAGES = 100` (20,000 killmails);
the direct script defaults to 50 and takes an override:
`yarn sync:character 95465499 10`.

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

ESI allows 150 req/sec; this project uses 50 as a safety margin.
`esiRateLimiter.execute()` in `backend/src/services/rate-limiter.ts` dispatches at
up to 50/sec with a 20 ms minimum gap and up to 50 concurrent in flight. Wrap ESI
calls in it. zKillboard needs 10 seconds between calls to the same endpoint.

The ceiling is per **process**, and `ESI_MAX_RPS` moves it — the budget is shared
by however many workers run at once, so two at the default 50 is 100 req/sec.
Raise it only for a single worker that has the run to itself, never to squeeze
more out of several at once. `ESI_PREFETCH` is the matching knob for how many
messages a worker holds unacked. Both default to the numbers above.

Concurrency is `channel.prefetch(N)`. Two families of worker exist today:

- Most workers set a `PREFETCH_COUNT` constant (3–50) and rely on
  `esiRateLimiter` for the real ceiling.
- `worker-regions` and `worker-constellations` use `prefetch(1)` with a manual
  100 ms sleep, which is 10 req/sec serial. Slower, but simple and safe for
  workers whose write path is a large transaction.

**Correction:** `worker-solar-systems` belonged in that second group until the
topology chain reduced it to a single table and four publishes. The transaction
that justified `prefetch(1)` is gone, so it now sets `PREFETCH_COUNT` like the
first group.

Every worker copies the same error handling: back off when
`x-esi-error-limit-remain` drops below 20, wait 60 s and requeue on HTTP 420, warn
and skip on 404.

### Scheduling is only for mutable data

There are **two** scheduling mechanisms, and both are documented:

1. **PM2 `cron_restart`** in `ecosystem.config.js` — alliances daily, characters
   monthly, prices daily, sovereignty by the minute, system kills hourly.
   Described in `backend/docs/ops/pm2.md`.
2. **The operating system crontab** on the droplet — `queue:characters` and
   `queue:character-corporations` weekly, plus log cleanup, a nightly database
   backup and PM2 log rotation. Described in `backend/docs/ops/crontab.md`.
   Checking `ecosystem.config.js` alone will not tell you whether something is
   scheduled.

Everything either one schedules is data that changes. Static universe and
reference data appears in **neither**: `queue:regions`, `queue:constellations`,
`queue:solar-systems`, `queue:types`, `queue:categories`, `queue:dogma-*` and
their workers are run by hand, once, and left alone.

Never call ESI directly from a resolver, a service used by resolvers, or an
ad-hoc script — it goes through a queue and a worker.

### ESI endpoint shapes worth knowing

Checked against `https://esi.evetech.net/meta/openapi.json` on 2026-08-28.

Under `/universe/`, only `systems`, `regions`, `constellations`, `types`,
`categories`, `groups` and `graphics` have a **list** form. `stargates`, `stars`,
`planets`, `moons`, `asteroid_belts` and `stations` are by-ID only — so for those
the database is the only possible source of "what still needs fetching".

`POST /universe/names` resolves up to 1000 IDs per call, but only for `alliance`,
`character`, `constellation`, `corporation`, `inventory_type`, `region`,
`solar_system`, `station` and `faction`. Star, planet, moon, asteroid belt and
stargate IDs return 404.

`/universe/systems/{id}/` omits keys entirely rather than returning empty arrays:
`stargates`, `stations`, `security_class` and the per-planet `moons` /
`asteroid_belts` can all be absent. Read them with `?? []` / `?? null`.

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

## File map

| What                     | Where                                                          |
| ------------------------ | -------------------------------------------------------------- |
| Resolvers                | `backend/src/resolvers/{domain}/{queries,mutations,fields}.ts` |
| Services                 | `backend/src/services/`                                        |
| GraphQL schema           | `backend/src/schemas/*.graphql`                                |
| Env config               | `backend/src/config.ts`                                        |
| Prisma client (API)      | `backend/src/services/prisma.ts`                               |
| Prisma client (workers)  | `backend/src/services/prisma-worker.ts`                        |
| DataLoaders              | `backend/src/services/dataloaders.ts`                          |
| ESI rate limiter         | `backend/src/services/rate-limiter.ts`                         |
| Live leaderboard updates | `backend/src/services/kill-stats-realtime.ts`                  |
| Workers                  | `backend/src/workers/`                                         |
| Queue publishers         | `backend/src/queues/`                                          |
| Prisma models            | `backend/prisma/schema/*.prisma` (one model per file)          |
| Frontend documents       | `frontend/src/graphql/*.graphql`                               |
| Generated frontend types | `frontend/src/generated/graphql.ts`                            |
| Apollo Client            | `frontend/src/lib/apolloClient.ts`                             |
| Components               | `frontend/src/components/`                                     |
| Routes                   | `frontend/src/app/`                                            |
| PM2 process definitions  | `ecosystem.config.js`                                          |

**Correction:** the old guide also listed `yarn test:enrichment` and
`test-killmails.sh` under debugging. Neither exists.

---

## Documentation

Living docs are under `backend/docs/` — `architecture.md`, `workers/`,
`leaderboards/`, `esi/`, `redis-cache/`, `authentication/`, `deployment/`.
Design specs and implementation plans live under `docs/superpowers/`.

**Correction:** the old guide's "Documentation References" pointed at paths that
had all been moved into `backend/docs/` and renamed to kebab-case. The documents
themselves are alive:

| Old reference                                | Current location                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `backend/EVE_SSO_README.md`                  | `backend/docs/authentication/eve-sso-readme.md`                                                                              |
| `backend/ENRICHMENT_README.md`               | `backend/docs/workers/enrichment.md`                                                                                         |
| `backend/CHARACTER_KILLMAIL_WORKER.md`       | `backend/docs/workers/character-killmail-worker.md`                                                                          |
| `backend/MODULAR_ARCHITECTURE.md`            | `backend/docs/architecture.md`                                                                                               |
| `backend/docs/LEADERBOARD_QUERIES.MD`        | `backend/docs/leaderboards/leaderboard-queries.md`                                                                           |
| `backend/docs/CACHE_OPTIMIZATION_SUMMARY.MD` | `backend/docs/redis-cache/cache-optimization-summary.md`                                                                     |
| `backend/docs/CAPSULE_VALUE_CALCULATION.MD`  | `backend/docs/workers/capsule-value-calculation.md`                                                                          |
| `backend/POOL_CONNECTION_FIX.md`             | no longer its own file; the connection-limit reasoning is in `backend/docs/deployment/cost-comparison.md` and repeated above |

Directories worth knowing: `backend/docs/ops/` (PM2, crontab, daily operations,
performance), `workers/`, `leaderboards/`, `redis-cache/`, `esi/`,
`authentication/`, `deployment/`, `api/`.

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
