# Sidebar Top Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three cards to the killmails sidebar — Most Active Factions, Most Active Systems, Most Active Regions — closing the gap against the competing site's seven-card sidebar.

**Architecture:** Systems and regions need no new storage: `killmail_filters` already carries `solar_system_id`, `constellation_id` and `region_id` per killmail, so both are a `GROUP BY` behind the existing 300 s cache. Factions need a reference table, because `faction_id` sits in nine columns today with nothing that can resolve one to a name. ESI has no per-faction endpoint — only a list returning all 27 objects in one call — so factions follow `worker-races.ts`: a queue-less worker run by hand, not a queue/worker chain with nothing to fan out to.

**Tech Stack:** GraphQL Yoga, graphql-codegen, Prisma (`$queryRaw` + `migrate deploy`), PostgreSQL, Redis, RabbitMQ (not used here), Vitest 5, Next.js App Router with Apollo Client.

**Spec:** `docs/superpowers/specs/2026-09-07-sidebar-top-cards-design.md`

**Prerequisite:** `docs/superpowers/plans/2026-09-07-leaderboard-query-shape.md` must be complete and its branch merged. That work is on `refactor/leaderboard-query-shape` (PR #177). **This plan builds on `TopFilter`, `LeaderboardPeriod` and `resolvePeriod`, none of which exist on `main` yet.** Branch from the merge commit, or from `refactor/leaderboard-query-shape` if the PR has not landed — do not branch from `main`.

## Global Constraints

- **Never reset the database. Never lose rows.** No `prisma migrate reset`, no accepting a Prisma data-loss prompt, no dropping or truncating a table. If the only way forward appears to involve losing data, stop and ask.
- **Never run `prisma migrate dev`** — including through `yarn prisma:migrate`, which is an alias for it. It would offer to drop five tables. Task 1 gives the safe procedure.
- **Five tables exist in the database but deliberately not in `prisma/schema/`** — `killmail_filters`, `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`, `refresh_log`. Prisma sees all five as drift. Their row counts at the start of this plan are **27,859 / 28,557 / 10,509 / 2,815 / 13**. None may go down.
- **Yarn only, never npm.**
- **Never edit generated files** — `backend/src/generated-types.ts`, `backend/src/generated-schema.graphql`, `frontend/src/generated/graphql.ts`. Change the source and re-run codegen; committing regenerated output is expected.
- **Never edit `.env` or any secrets file.**
- **Backend codegen must run before frontend codegen.**
- **Never call ESI from a resolver** or from a service a resolver uses. ESI calls belong to workers.
- **Cache keys carry every filter parameter**, format `{domain}:{action}:{param}:{param}`.
- **`::BIGINT` from `$queryRaw` arrives as `BigInt`; `JSON.stringify` throws on it.** Convert with `Number()` before caching.
- **Limit cap:** `Math.min(filter?.limit ?? 100, 100)`.
- **`yarn workspace frontend lint` is not clean and never has been** — `main` reports 148 errors and 85 warnings. The bar is _no new finding in a file you changed_, not a clean run. Do not fix unrelated lint errors.
- **Commit messages in English, no Claude attribution** — no `Co-Authored-By: Claude`, no `Claude-Session:`, no "Generated with Claude Code". The project's `CLAUDE.md` forbids these and overrides any harness default.
- **Test baseline entering this plan:** backend 557 tests / 19 files, frontend 255 tests / 22 files, all passing. `yarn test` from the root runs both.
- **`yarn format:check` is a CI gate and `main` passes it clean.** Run `yarn format` before every commit — `prettier --check .` covers `.ts`, `.tsx`, `.graphql` and `.md`, so the spec and plan documents in this repo are checked too. The leaderboard reshape's CI went red on exactly this: its plan listed test, codegen, build and lint but not format, so six tasks and a whole-branch review all passed over eight failing files.
- **Backend dev port comes from `backend/.env`** (`PORT`). Never hardcode 4000. **Never kill by process name** — `pkill node` reaches the user's other projects. `yarn kill` does not work on macOS (it uses Linux-only `fuser`); use `lsof -ti tcp:$PORT`.

---

## File Structure

**Created:**

| File                                                          | Responsibility                                        |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `backend/prisma/schema/faction.prisma`                        | The `Faction` model. Sibling of `race.prisma`.        |
| `backend/prisma/migrations/<ts>_add_factions/migration.sql`   | Hand-checked DDL creating `factions` only.            |
| `backend/src/services/faction/faction.service.ts`             | ESI client. `FactionService.getFactions()`.           |
| `backend/src/workers/worker-factions.ts`                      | Fetches the list, upserts 27 rows. No queue.          |
| `backend/src/schemas/Faction.graphql`                         | `Faction` type, `faction(id)` and `factions` queries. |
| `backend/src/resolvers/faction/queries.ts`                    | `factionQueries`.                                     |
| `backend/src/resolvers/faction/index.ts`                      | Re-export.                                            |
| `frontend/src/graphql/TopFactions.graphql`                    | Document.                                             |
| `frontend/src/graphql/TopSystems.graphql`                     | Document.                                             |
| `frontend/src/graphql/TopRegions.graphql`                     | Document.                                             |
| `frontend/src/components/TopFactionsCard/TopFactionsCard.tsx` | Logo, name, kill count.                               |
| `frontend/src/components/TopSystemsCard/TopSystemsCard.tsx`   | Name, security status, region, link.                  |
| `frontend/src/components/TopRegionsCard/TopRegionsCard.tsx`   | Name, kill count, link.                               |

**Modified:**

| File                                                                 | Change                                     |
| -------------------------------------------------------------------- | ------------------------------------------ |
| `backend/package.json`                                               | Adds `worker:factions`.                    |
| `backend/src/schemas/Leaderboard.graphql`                            | Three output types, three queries.         |
| `backend/src/resolvers/leaderboard/queries.ts`                       | Three resolvers.                           |
| `backend/src/resolvers/leaderboard/queries.spec.ts`                  | Three describe blocks.                     |
| `backend/src/resolvers/index.ts`                                     | Wires `factionQueries`.                    |
| `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`      | Three kinds, three hooks, three cases.     |
| `frontend/src/components/TopEntitySidebar/TopEntitySidebar.spec.tsx` | Extends the existing tests to eight hooks. |
| `frontend/src/app/killmails/page.tsx`                                | Reorders `SIDEBAR_CARDS` to eight cards.   |
| `frontend/src/components/SolarSystemDetail/KillmailsTab.tsx`         | Adds `factions` only.                      |

---

### Task 1: The `factions` table and its worker

The one task in this plan that touches the database. `prisma migrate dev` would offer to drop five tables holding 69,753 rows between them; the procedure below never lets it run.

**Files:**

- Create: `backend/prisma/schema/faction.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_factions/migration.sql`
- Create: `backend/src/services/faction/faction.service.ts`
- Create: `backend/src/workers/worker-factions.ts`
- Modify: `backend/package.json`

**Interfaces:**

- Produces: Prisma model `Faction` (`prisma.faction`) with fields `id`, `name`, `description`, `corporation_id`, `militia_corporation_id`, `created_at`, `updated_at`, mapped to table `factions`. Task 2 queries it; Task 4 joins against it via `prisma.faction.findMany`.
- Produces: `FactionService.getFactions(): Promise<ESIFaction[]>`.
- Produces: the `worker:factions` script.

- [ ] **Step 1: Record the protected tables' row counts**

```bash
cd /Users/umut/Sites/killreport/backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')
psql "$DB" -c "
SELECT 'killmail_filters' t, COUNT(*) FROM killmail_filters
UNION ALL SELECT 'character_kill_stats', COUNT(*) FROM character_kill_stats
UNION ALL SELECT 'corporation_kill_stats', COUNT(*) FROM corporation_kill_stats
UNION ALL SELECT 'alliance_kill_stats', COUNT(*) FROM alliance_kill_stats
UNION ALL SELECT 'refresh_log', COUNT(*) FROM refresh_log;"
```

Expected, at the time this plan was written: 27859 / 28557 / 10509 / 2815 / 13. Yours may be higher if killmails have arrived since. **Write down what you actually see** — Step 8 compares against it, and none may go down.

- [ ] **Step 2: Add the Prisma model**

Create `backend/prisma/schema/faction.prisma`:

```prisma
model Faction {
  id                     Int      @id
  name                   String
  description            String?
  corporation_id         Int?
  militia_corporation_id Int?
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt

  @@map("factions")
}
```

`id` is ESI's `faction_id` and is not remapped — the same shape `race.prisma` uses. `corporation_id` and `militia_corporation_id` are nullable because ESI omits them: faction 500021 has neither, and only the four militia factions plus Guristas and Angel Cartel have a `militia_corporation_id`.

- [ ] **Step 3: Generate the DDL and inspect it**

```bash
cd /Users/umut/Sites/killreport/backend
npx prisma migrate diff --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema --script > /tmp/faction-diff.sql
cat /tmp/faction-diff.sql
```

Expected: a `CREATE TABLE "factions"` block, **plus** `DROP TABLE` statements for the five untracked tables, because Prisma sees them as drift.

- [ ] **Step 4: Confirm which DROPs are present**

```bash
grep -n "^DROP\|DROP TABLE" /tmp/faction-diff.sql
```

Every line this prints is a table Prisma wants to delete. Read them. If any names something other than `killmail_filters`, `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats` or `refresh_log`, **stop and report** — the schema has drifted in a way this plan did not anticipate.

- [ ] **Step 5: Write the migration with every DROP removed**

```bash
cd /Users/umut/Sites/killreport/backend
mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_factions
```

Into that directory's `migration.sql`, put **only** the `CREATE TABLE "factions"` block from the diff and nothing else. It should look like:

```sql
-- CreateTable
CREATE TABLE "factions" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "corporation_id" INTEGER,
    "militia_corporation_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factions_pkey" PRIMARY KEY ("id")
);
```

Use the column types the diff actually produced rather than these if they differ.

- [ ] **Step 6: Prove no executable DROP survived**

```bash
grep -n "^[^-]*DROP" backend/prisma/migrations/*_add_factions/migration.sql
```

Expected: **no output**. If anything prints, remove it and run this again. Do not proceed while this prints a line.

- [ ] **Step 7: Apply the migration**

```bash
cd /Users/umut/Sites/killreport/backend
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` applies pending migrations and never drops anything. It is the only migrate command this plan runs.

- [ ] **Step 8: Re-check the protected tables**

Run the exact query from Step 1 again. **Every count must be greater than or equal to what you recorded.** If any went down, stop and report immediately — that is a data-loss event and this plan's first constraint.

- [ ] **Step 9: Write the ESI client**

Create `backend/src/services/faction/faction.service.ts`, modelled on `backend/src/services/race/race.service.ts`:

```typescript
import axios from 'axios';
import { esiRateLimiter } from '../rate-limiter';

export interface ESIFaction {
  faction_id: number;
  name: string;
  description: string;
  corporation_id?: number;
  militia_corporation_id?: number;
  solar_system_id?: number;
  station_count?: number;
  station_system_count?: number;
  size_factor?: number;
  is_unique?: boolean;
}

const ESI_BASE_URL = 'https://esi.evetech.net';

/**
 * Faction service for ESI API interactions.
 *
 * ESI has no /universe/factions/{id}/ endpoint — the list returns all 27
 * objects in full, which is why factions get a queue-less worker rather than
 * the queue/worker fan-out the by-ID domains use.
 */
export class FactionService {
  /**
   * Fetches all factions from ESI (public endpoint)
   * @returns Array of faction objects
   */
  static async getFactions(): Promise<ESIFaction[]> {
    return esiRateLimiter.execute(async () => {
      const response = await axios.get<ESIFaction[]>(
        `${ESI_BASE_URL}/universe/factions`,
      );
      return response.data;
    });
  }
}
```

The optional fields beyond `corporation_id` and `militia_corporation_id` are typed because ESI returns them, but the model does not store them — nothing in this plan needs them.

- [ ] **Step 10: Write the worker**

Create `backend/src/workers/worker-factions.ts`, modelled on `backend/src/workers/worker-races.ts`:

```typescript
/**
 * Faction Worker — fetches faction information from ESI and saves it.
 *
 * Run by hand, like worker:races and worker:bloodlines. Faction data is static
 * reference data: the list changes only when CCP adds a faction, so it belongs
 * in neither PM2's cron_restart nor the droplet's crontab.
 */

import logger from '@services/logger';
import prismaWorker from '@services/prisma-worker';
import { FactionService } from '@services/faction/faction.service';

async function fetchAndSaveFactions() {
  try {
    logger.info('🚀 Starting faction sync...');

    const factions = await FactionService.getFactions();
    logger.info(`✓ Fetched ${factions.length} factions from ESI`);

    for (const faction of factions) {
      try {
        await prismaWorker.faction.upsert({
          where: { id: faction.faction_id },
          create: {
            id: faction.faction_id,
            name: faction.name,
            description: faction.description,
            corporation_id: faction.corporation_id ?? null,
            militia_corporation_id: faction.militia_corporation_id ?? null,
          },
          update: {
            name: faction.name,
            description: faction.description,
            corporation_id: faction.corporation_id ?? null,
            militia_corporation_id: faction.militia_corporation_id ?? null,
          },
        });
        logger.debug(`  ✓ Saved: ${faction.name}`);
      } catch (error: any) {
        logger.error(
          `  ❌ Error saving faction ${faction.faction_id}:`,
          error.message,
        );
      }
    }

    logger.info(`✅ Faction sync completed! Total: ${factions.length}`);
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Error fetching factions:', error.message);
    process.exit(1);
  }
}

fetchAndSaveFactions();
```

- [ ] **Step 11: Add the script**

In `backend/package.json`, alongside `"worker:races"`, add:

```json
    "worker:factions": "tsx src/workers/worker-factions.ts",
```

Do **not** add a `queue:factions` script, an `ecosystem.config.js` entry, or a crontab line. There is nothing to queue and nothing that changes on a schedule.

- [ ] **Step 12: Run the worker and verify the data**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend worker:factions
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')
psql "$DB" -c "SELECT COUNT(*) AS total, COUNT(militia_corporation_id) AS with_militia FROM factions;"
psql "$DB" -c "SELECT id, name FROM factions WHERE id IN (500001,500003,500021) ORDER BY id;"
```

Expected: 27 rows total, 6 with a militia corporation, and the three named rows are Caldari State, Amarr Empire and the placeholder literally called `Unknown`.

- [ ] **Step 13: Build and test**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend build
yarn test
```

Expected: `tsc --noEmit` clean, backend 557 and frontend 255 still passing.

- [ ] **Step 14: Commit**

```bash
git add backend/prisma/schema/faction.prisma backend/prisma/migrations backend/src/services/faction backend/src/workers/worker-factions.ts backend/package.json
git commit -m "feat(db): add the factions reference table and its worker

faction_id already sits in nine columns across attackers, victims,
characters, corporations, alliances and the sovereignty tables, but
nothing could resolve one to a name — every faction in the app was a
bare number.

ESI has no /universe/factions/{id}/ endpoint, only a list returning all
27 objects in one call, so there is no ID list to fan out and a
queue/worker chain would spin on itself. This follows worker-races.ts
and worker-bloodlines.ts instead: a queue-less worker, run by hand,
absent from PM2 and crontab because the data is static.

The migration was generated with migrate diff and hand-stripped of the
DROP TABLE statements Prisma emits for the five tables that live outside
prisma/schema/. Row counts for all five were recorded before and after
and none moved."
```

---

### Task 2: The `Faction` GraphQL type and its resolver

**Files:**

- Create: `backend/src/schemas/Faction.graphql`
- Create: `backend/src/resolvers/faction/queries.ts`
- Create: `backend/src/resolvers/faction/index.ts`
- Modify: `backend/src/resolvers/index.ts`

**Interfaces:**

- Consumes: `prisma.faction` (Task 1).
- Produces: GraphQL `type Faction { id, name, description, corporationId, militiaCorporationId }` and the queries `faction(id: Int!)` / `factions`. Task 4's `TopFaction.faction` field resolves to this type.

Note the camelCase GraphQL fields over snake_case columns. `Faction.graphql` declares `corporationId` / `militiaCorporationId`; the Prisma rows carry `corporation_id` / `militia_corporation_id`. Field resolvers map them.

- [ ] **Step 1: Write the schema**

Create `backend/src/schemas/Faction.graphql`:

```graphql
type Faction {
  id: Int!
  name: String!
  description: String
  corporationId: Int
  militiaCorporationId: Int
}

extend type Query {
  faction(id: Int!): Faction
  factions: [Faction!]!
}
```

- [ ] **Step 2: Run codegen and confirm it fails to typecheck**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend codegen
yarn workspace backend build
```

Expected: codegen succeeds; `tsc --noEmit` reports that `Query.faction` and `Query.factions` have no resolver implementation, or compiles with the fields simply unimplemented. Either way the resolver does not exist yet — that is the point of running it now.

- [ ] **Step 3: Write the resolver**

Create `backend/src/resolvers/faction/queries.ts`, modelled on `backend/src/resolvers/race/queries.ts`:

```typescript
import { QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';

/**
 * Faction Query Resolvers
 * Handles fetching faction data
 */
export const factionQueries: QueryResolvers = {
  faction: async (_, { id }) => {
    const faction = await prisma.faction.findUnique({
      where: { id: Number(id) },
    });
    if (!faction) return null;
    return {
      ...faction,
      corporationId: faction.corporation_id,
      militiaCorporationId: faction.militia_corporation_id,
    };
  },

  factions: async () => {
    const factions = await prisma.faction.findMany({
      orderBy: { name: 'asc' },
    });
    return factions.map((faction) => ({
      ...faction,
      corporationId: faction.corporation_id,
      militiaCorporationId: faction.militia_corporation_id,
    }));
  },
};
```

- [ ] **Step 4: Re-export**

Create `backend/src/resolvers/faction/index.ts`:

```typescript
export { factionQueries } from './queries';
```

- [ ] **Step 5: Wire into the resolver map**

In `backend/src/resolvers/index.ts`, add the import alongside the others:

```typescript
import { factionQueries } from './faction';
```

and add it to the `Query` spread, alongside `...raceQueries`:

```typescript
    ...factionQueries,
```

- [ ] **Step 6: Verify**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend codegen
yarn workspace backend build
yarn test
```

Expected: all clean, test counts unchanged.

- [ ] **Step 7: Query it live**

Restart the backend so it serves the new schema. The port is in `backend/.env`; find the running process with `lsof -ti tcp:$PORT` and kill that PID — never by process name.

```bash
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2- | tr -d '"')
curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' \
  -d '{"query":"{ factions { id name militiaCorporationId } }"}' | head -c 400
```

Expected: 27 factions, with `militiaCorporationId` populated on Caldari State (500001), Minmatar Republic (500002), Amarr Empire (500003), Gallente Federation (500004), Guristas Pirates (500010) and Angel Cartel (500011), and `null` on the rest.

- [ ] **Step 8: Commit**

```bash
git add backend/src/schemas/Faction.graphql backend/src/resolvers/faction backend/src/resolvers/index.ts backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(graphql): expose factions through the API

A Faction type and the faction(id) / factions queries, mapping the
snake_case columns to the camelCase fields the schema uses everywhere
else. Nothing consumes them yet; the Most Active Factions card lands in
a later commit."
```

---

### Task 3: `topSystems` and `topRegions`

Neither needs new data. `killmail_filters` already carries the location columns, and both resolvers are Shape C — the same shape `topDestroyedShips` uses.

**Files:**

- Modify: `backend/src/schemas/Leaderboard.graphql`
- Modify: `backend/src/resolvers/leaderboard/queries.ts`
- Modify: `backend/src/resolvers/leaderboard/queries.spec.ts`

**Interfaces:**

- Consumes: `resolvePeriod` and `TopFilter` from the prerequisite plan; the `querySql` / `queryValues` / `call` helpers already in `queries.spec.ts`.
- Produces: `Query.topSystems(filter: TopFilter): [TopSystem!]!` and `Query.topRegions(filter: TopFilter): [TopRegion!]!`, output types `TopSystem { rank, killCount, solarSystem }` and `TopRegion { rank, killCount, region }`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/resolvers/leaderboard/queries.spec.ts`:

```typescript
describe('topSystems', () => {
  it('counts killmails per system straight out of killmail_filters', async () => {
    await call('topSystems', { limit: 10 });

    expect(querySql()).toContain('FROM killmail_filters');
    expect(querySql()).toContain('GROUP BY solar_system_id');
    expect(querySql()).not.toContain('FROM attackers');
  });

  it('bounds the upper edge with < next day', async () => {
    await call('topSystems', { limit: 10 });

    expect(querySql()).toContain("< ? ::date + INTERVAL '1 day'");
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topSystems', { limit: 10, regionId: 10000002 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topSystems:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:::10000002$/,
    );
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { solar_system_id: 30000142, kill_count: 91n },
    ]);
    prisma.solarSystem.findMany.mockResolvedValue([
      { id: 30000142, name: 'Jita' },
    ]);

    const result = (await call('topSystems', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(91);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe('topRegions', () => {
  it('groups by region rather than system', async () => {
    await call('topRegions', { limit: 10 });

    expect(querySql()).toContain('FROM killmail_filters');
    expect(querySql()).toContain('GROUP BY region_id');
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topRegions', { limit: 10 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topRegions:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:::$/,
    );
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { region_id: 10000002, kill_count: 337n },
    ]);
    prisma.region.findMany.mockResolvedValue([
      { id: 10000002, name: 'The Forge' },
    ]);

    const result = (await call('topRegions', { limit: 10 })) as Array<{
      killCount: number;
    }>;

    expect(result[0].killCount).toBe(337);
  });
});
```

The mock harness at the top of that file declares `prisma.character`, `prisma.corporation`, `prisma.alliance` and `prisma.type`. **Add `solarSystem: { findMany: vi.fn() }`, `region: { findMany: vi.fn() }` and `faction: { findMany: vi.fn() }` to the `vi.hoisted` block, and reset all three in `beforeEach`** alongside the existing ones — Task 4 needs `faction`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
```

Expected: FAIL — `leaderboardQueries.topSystems` is not a function.

- [ ] **Step 3: Add the schema**

In `backend/src/schemas/Leaderboard.graphql`, add the two output types alongside `TopShip`:

```graphql
type TopSystem {
  rank: Int!
  killCount: Int!
  solarSystem: SolarSystem
}

type TopRegion {
  rank: Int!
  killCount: Int!
  region: Region
}
```

and the two fields in `extend type Query`:

```graphql
  """
  Systems with the most kills over the window named by filter.period.
  """
  topSystems(filter: TopFilter): [TopSystem!]!

  """
  Regions with the most kills over the window named by filter.period.
  """
  topRegions(filter: TopFilter): [TopRegion!]!
```

No new input type. `TopFilter` already carries `systemId` / `constellationId` / `regionId`, and some combinations are degenerate — `topRegions` with a `regionId` returns one row. The resolvers apply filters unconditionally; write no special case.

- [ ] **Step 4: Write the resolvers**

Add to `backend/src/resolvers/leaderboard/queries.ts`, following the same seven-step skeleton as `topDestroyedShips`:

```typescript
  topSystems: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topSystems:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { solar_system_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT solar_system_id, COUNT(*)::BIGINT AS kill_count
      FROM   killmail_filters
      WHERE  killmail_time >= ${startDate}::date
        AND  killmail_time <  ${endDate}::date + INTERVAL '1 day'
        AND  solar_system_id IS NOT NULL
        ${systemId ? Prisma.sql`AND solar_system_id = ${systemId}` : Prisma.empty}
        ${constellationId ? Prisma.sql`AND constellation_id = ${constellationId}` : Prisma.empty}
        ${regionId ? Prisma.sql`AND region_id = ${regionId}` : Prisma.empty}
      GROUP  BY solar_system_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const systemIds = rows.map((r) => r.solar_system_id);
    const systems = await prisma.solarSystem.findMany({
      where: { id: { in: systemIds } },
    });
    const systemMap = new Map(systems.map((s) => [s.id, s]));

    const result = rows.map((row, idx) => ({
      rank: idx + 1,
      killCount: Number(row.kill_count),
      solarSystem: systemMap.get(row.solar_system_id) ?? null,
    }));

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },

  topRegions: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topRegions:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    type Row = { region_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT region_id, COUNT(*)::BIGINT AS kill_count
      FROM   killmail_filters
      WHERE  killmail_time >= ${startDate}::date
        AND  killmail_time <  ${endDate}::date + INTERVAL '1 day'
        AND  region_id IS NOT NULL
        ${systemId ? Prisma.sql`AND solar_system_id = ${systemId}` : Prisma.empty}
        ${constellationId ? Prisma.sql`AND constellation_id = ${constellationId}` : Prisma.empty}
        ${regionId ? Prisma.sql`AND region_id = ${regionId}` : Prisma.empty}
      GROUP  BY region_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const regionIds = rows.map((r) => r.region_id);
    const regions = await prisma.region.findMany({
      where: { id: { in: regionIds } },
    });
    const regionMap = new Map(regions.map((r) => [r.id, r]));

    const result = rows.map((row, idx) => ({
      rank: idx + 1,
      killCount: Number(row.kill_count),
      region: regionMap.get(row.region_id) ?? null,
    }));

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },
```

`prisma.solarSystem` and `prisma.region` are addressed by the Prisma field name `id`; the raw SQL above uses the mapped column names `solar_system_id` and `region_id`, which is why the two differ in the same resolver.

- [ ] **Step 5: Verify**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend codegen
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
yarn workspace backend build
```

Expected: PASS, `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/schemas/Leaderboard.graphql backend/src/resolvers/leaderboard backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(graphql): add topSystems and topRegions

Both read killmail_filters directly — it already carries
solar_system_id, constellation_id and region_id per killmail, so neither
needs new storage or a pre-aggregated table. At 27,859 rows a GROUP BY
over the window sits comfortably behind the existing 300 s cache.

Both take the shared TopFilter, so either can be asked for any of the
five periods rather than a fixed rolling week."
```

---

### Task 4: `topFactions`

Shape B — `attackers` joined to `killmail_filters` — because the faction lives on the attacker row, not on the killmail.

**Files:**

- Modify: `backend/src/schemas/Leaderboard.graphql`
- Modify: `backend/src/resolvers/leaderboard/queries.ts`
- Modify: `backend/src/resolvers/leaderboard/queries.spec.ts`

**Interfaces:**

- Consumes: `prisma.faction` (Task 1), the `Faction` GraphQL type (Task 2), `resolvePeriod` and `TopFilter`, and the `faction: { findMany: vi.fn() }` mock added in Task 3 Step 1.
- Produces: `Query.topFactions(filter: TopFilter): [TopFaction!]!`, output type `TopFaction { rank, killCount, faction }`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/resolvers/leaderboard/queries.spec.ts`:

```typescript
describe('topFactions', () => {
  it('joins attackers to killmail_filters and counts distinct killmails', async () => {
    await call('topFactions', { limit: 10 });

    expect(querySql()).toContain('FROM attackers a');
    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(querySql()).toContain('COUNT(DISTINCT kf.killmail_id)');
    expect(querySql()).toContain('GROUP BY a.faction_id');
  });

  it('excludes the 500021 placeholder', async () => {
    await call('topFactions', { limit: 10 });

    expect(queryValues()).toContain(500021);
    expect(querySql()).toContain('a.faction_id <> ?');
  });

  it('accepts a spatial filter and passes it to the query', async () => {
    await call('topFactions', { limit: 10, systemId: 30000142 });

    expect(querySql()).toContain('INNER JOIN killmail_filters kf');
    expect(queryValues()).toContain(30000142);
  });

  it('puts every filter parameter in the cache key', async () => {
    await call('topFactions', { limit: 10, systemId: 30000142 });

    const [key] = redis.get.mock.calls[0];
    expect(key).toMatch(
      /^leaderboard:topFactions:LAST_7_DAYS:\d{4}-\d{2}-\d{2}:10:30000142::$/,
    );
  });

  it('converts BigInt counts before caching', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { faction_id: 500003, kill_count: 25n },
    ]);
    prisma.faction.findMany.mockResolvedValue([
      {
        id: 500003,
        name: 'Amarr Empire',
        description: null,
        corporation_id: 1000084,
        militia_corporation_id: 1000179,
      },
    ]);

    const result = (await call('topFactions', { limit: 10 })) as Array<{
      killCount: number;
      faction: { corporationId: number | null } | null;
    }>;

    expect(result[0].killCount).toBe(25);
    expect(result[0].faction?.corporationId).toBe(1000084);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
```

The last assertion pins the snake_case → camelCase mapping. Without it the card's logo lookup would receive `undefined` and the test would still pass on `killCount`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
```

Expected: FAIL — `leaderboardQueries.topFactions` is not a function.

- [ ] **Step 3: Add the schema**

In `backend/src/schemas/Leaderboard.graphql`:

```graphql
type TopFaction {
  rank: Int!
  killCount: Int!
  faction: Faction
}
```

and in `extend type Query`:

```graphql
  """
  Factions whose members scored the most kills over the window named by
  filter.period. Counts distinct killmails, so a twenty-strong militia fleet
  counts once for that kill.
  """
  topFactions(filter: TopFilter): [TopFaction!]!
```

- [ ] **Step 4: Write the resolver**

Add to `backend/src/resolvers/leaderboard/queries.ts`:

```typescript
  topFactions: async (_, { filter }) => {
    const limit = Math.min(filter?.limit ?? 100, 100);
    const period = filter?.period ?? LeaderboardPeriod.Last_7Days;
    const { startDate, endDate, cacheTtl, cacheAnchor } = resolvePeriod(
      period,
      filter?.anchor,
    );
    const systemId = filter?.systemId;
    const constellationId = filter?.constellationId;
    const regionId = filter?.regionId;

    const cacheKey = `leaderboard:topFactions:${period}:${cacheAnchor}:${limit}:${systemId || ''}:${constellationId || ''}:${regionId || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // COUNT(DISTINCT kf.killmail_id), not COUNT(*): a twenty-strong militia
    // fleet counts once for that faction on that kill, not twenty times.
    //
    // 500021 is ESI's placeholder faction — its name is literally "Unknown"
    // and it has no corporation_id, so it has no logo and no meaning in a
    // leaderboard.
    type Row = { faction_id: number; kill_count: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT a.faction_id, COUNT(DISTINCT kf.killmail_id)::BIGINT AS kill_count
      FROM   attackers a
      INNER JOIN killmail_filters kf ON kf.killmail_id = a.killmail_id
      WHERE  kf.killmail_time >= ${startDate}::date
        AND  kf.killmail_time <  ${endDate}::date + INTERVAL '1 day'
        AND  a.faction_id IS NOT NULL
        AND  a.faction_id <> ${500021}
        ${systemId ? Prisma.sql`AND kf.solar_system_id = ${systemId}` : Prisma.empty}
        ${constellationId ? Prisma.sql`AND kf.constellation_id = ${constellationId}` : Prisma.empty}
        ${regionId ? Prisma.sql`AND kf.region_id = ${regionId}` : Prisma.empty}
      GROUP  BY a.faction_id
      ORDER  BY kill_count DESC
      LIMIT  ${limit}
    `;

    if (rows.length === 0) return [];

    const factionIds = rows.map((r) => r.faction_id);
    const factions = await prisma.faction.findMany({
      where: { id: { in: factionIds } },
    });
    const factionMap = new Map(factions.map((f) => [f.id, f]));

    const result = rows.map((row, idx) => {
      const faction = factionMap.get(row.faction_id);
      return {
        rank: idx + 1,
        killCount: Number(row.kill_count),
        faction: faction
          ? {
              ...faction,
              corporationId: faction.corporation_id,
              militiaCorporationId: faction.militia_corporation_id,
            }
          : null,
      };
    });

    await redis.setex(cacheKey, cacheTtl, JSON.stringify(result));
    return result;
  },
```

`${500021}` is bound as a parameter rather than inlined so the test can assert on it through `queryValues()`, the same way every other filter value is checked.

- [ ] **Step 5: Add the three subjects to the combination sweep**

`backend/src/resolvers/leaderboard/queries.spec.ts` carries a sweep named
`every subject accepts every period`, whose `SUBJECTS` array currently lists the
five existing queries and runs each against all five periods — 25 pairs. It
exists because GraphQL cannot express "this subject only supports these
periods", so every reachable pair has to work, and an unexercised one would
only fail in production.

Adding three subjects without adding them to that array leaves **15 pairs
unexercised**. Extend it:

```typescript
const SUBJECTS = [
  'topPilots',
  'topCorporations',
  'topAlliances',
  'topDestroyedShips',
  'topAttackerShips',
  'topFactions',
  'topSystems',
  'topRegions',
] as const;
```

Change nothing else in that block — it already freezes the clock, derives the
expected window from `resolvePeriod` rather than hardcoding dates, and asserts
the resolved `startDate` reaches the bound values. The three new subjects
inherit all of it.

- [ ] **Step 6: Verify**

```bash
cd /Users/umut/Sites/killreport
yarn workspace backend codegen
yarn workspace backend test src/resolvers/leaderboard/queries.spec.ts
yarn workspace backend build
yarn test
```

Expected: PASS with the sweep now running **40 pairs** rather than 25,
`tsc --noEmit` clean, frontend still 255.

- [ ] **Step 7: Query all three live**

Restart the backend (port from `backend/.env`, kill by PID via `lsof -ti tcp:$PORT`, never by name), then:

```bash
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2- | tr -d '"')
q() { curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' -d "{\"query\":\"$1\"}"; echo; }

q '{ topSystems(filter:{limit:5}){ rank killCount solarSystem{ id name } } }'
q '{ topRegions(filter:{limit:5}){ rank killCount region{ id name } } }'
q '{ topFactions(filter:{limit:5}){ rank killCount faction{ id name corporationId } } }'
q '{ topFactions(filter:{limit:5,systemId:30000142}){ rank killCount faction{ id name } } }'
```

Expected: all four return `data`, not `errors`. **No result may contain faction id 500021.** The spatially-filtered call may legitimately return an empty list if no faction kills happened in that system — an empty list is a pass, an error is not.

- [ ] **Step 8: Commit**

```bash
git add backend/src/schemas/Leaderboard.graphql backend/src/resolvers/leaderboard backend/src/generated-types.ts backend/src/generated-schema.graphql
git commit -m "feat(graphql): add topFactions

Counts the attacking side, joining attackers to killmail_filters because
the faction lives on the attacker row rather than the killmail. Distinct
killmails, not attacker rows: a twenty-strong militia fleet counts once
for that kill, matching the three entity leaderboards rather than
topAttackerShips.

500021 is excluded. ESI names it literally 'Unknown' and gives it no
corporation_id, so it has neither a logo nor a meaning in a ranked list."
```

---

### Task 5: The three card components

Presentational only. Each takes already-shaped data and renders it; no data fetching, no business logic.

**Files:**

- Create: `frontend/src/graphql/TopFactions.graphql`
- Create: `frontend/src/graphql/TopSystems.graphql`
- Create: `frontend/src/graphql/TopRegions.graphql`
- Create: `frontend/src/components/TopFactionsCard/TopFactionsCard.tsx`
- Create: `frontend/src/components/TopSystemsCard/TopSystemsCard.tsx`
- Create: `frontend/src/components/TopRegionsCard/TopRegionsCard.tsx`

**Interfaces:**

- Consumes: the three queries from Tasks 3 and 4.
- Produces: `useTopFactionsQuery`, `useTopSystemsQuery`, `useTopRegionsQuery` (generated), and three default-exported components with these props:
  - `TopFactionsCard({ title, subtitle?, factions, loading?, emptyText? })` where `factions: { id, name, killCount }[]`
  - `TopSystemsCard({ title, subtitle?, systems, loading?, emptyText? })` where `systems: { id, name, killCount, securityStatus, regionId, regionName }[]`
  - `TopRegionsCard({ title, subtitle?, regions, loading?, emptyText? })` where `regions: { id, name, killCount }[]`

- [ ] **Step 1: Write the three documents**

`frontend/src/graphql/TopFactions.graphql`:

```graphql
query TopFactions($filter: TopFilter) {
  topFactions(filter: $filter) {
    rank
    killCount
    faction {
      id
      name
    }
  }
}
```

`frontend/src/graphql/TopSystems.graphql` — the region name comes through the constellation, and both hops are DataLoader-backed (`resolvers/solar-system/fields.ts:26`, `resolvers/constellation/fields.ts:25`), so this does not cause an N+1:

```graphql
query TopSystems($filter: TopFilter) {
  topSystems(filter: $filter) {
    rank
    killCount
    solarSystem {
      id
      name
      securityStatus
      constellation {
        region {
          id
          name
        }
      }
    }
  }
}
```

`frontend/src/graphql/TopRegions.graphql`:

```graphql
query TopRegions($filter: TopFilter) {
  topRegions(filter: $filter) {
    rank
    killCount
    region {
      id
      name
    }
  }
}
```

- [ ] **Step 2: Run codegen**

```bash
cd /Users/umut/Sites/killreport
yarn workspace frontend codegen
grep -n "useTopFactionsQuery\|useTopSystemsQuery\|useTopRegionsQuery" frontend/src/generated/graphql.ts | head
```

Expected: all three hooks generated.

- [ ] **Step 3: Write `TopFactionsCard`**

Create `frontend/src/components/TopFactionsCard/TopFactionsCard.tsx`, following the skeleton of `frontend/src/components/TopShipsCard/TopShipsCard.tsx`:

```tsx
'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import { ReactNode } from 'react';

export interface TopFaction {
  id: number;
  name: string;
  killCount: number;
}

export interface TopFactionsCardProps {
  title: string;
  subtitle?: ReactNode;
  factions: TopFaction[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopFactionsCard({
  title,
  subtitle,
  factions,
  loading = false,
  emptyText = 'No factions yet',
}: TopFactionsCardProps) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle && (
        <span className="text-xs text-gray-500 shrink-0">{subtitle}</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card header={header}>
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card header={header}>
      {factions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {factions.map((faction, index) => (
            <div key={faction.id} className="card-row">
              <div className="flex items-center gap-3">
                <RankNumber rank={index + 1} />

                {/*
                  CCP's image server has no /factions/ path — it returns 400.
                  Faction ids live in the alliance id space there, so the
                  alliance endpoint is the correct source for a faction logo.
                */}
                <img
                  src={`https://images.evetech.net/alliances/${faction.id}/logo?size=64`}
                  alt={faction.name}
                  className="rounded-full shadow-md size-10 shrink-0"
                  loading="lazy"
                />

                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                  <span className="block min-w-0 font-medium text-orange-400 truncate">
                    {faction.name}
                  </span>
                  <span className="text-lg font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                    {faction.killCount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Write `TopSystemsCard`**

Create `frontend/src/components/TopSystemsCard/TopSystemsCard.tsx`:

```tsx
'use client';

import { Loader } from '@/components/Loader/Loader';
import SecurityStatus from '@/components/SecurityStatus/SecurityStatus';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Link from 'next/link';
import { ReactNode } from 'react';

export interface TopSystem {
  id: number;
  name: string;
  killCount: number;
  securityStatus?: number | null;
  regionId?: number | null;
  regionName?: string | null;
}

export interface TopSystemsCardProps {
  title: string;
  subtitle?: ReactNode;
  systems: TopSystem[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopSystemsCard({
  title,
  subtitle,
  systems,
  loading = false,
  emptyText = 'No systems yet',
}: TopSystemsCardProps) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle && (
        <span className="text-xs text-gray-500 shrink-0">{subtitle}</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card header={header}>
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card header={header}>
      {systems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {systems.map((system, index) => (
            <div key={system.id} className="card-row">
              <div className="flex items-center gap-3">
                <RankNumber rank={index + 1} />

                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <SecurityStatus securityStatus={system.securityStatus} />
                      <Link
                        href={`/solar-systems/${system.id}`}
                        className="block min-w-0 font-medium text-orange-400 truncate hover:underline"
                      >
                        {system.name}
                      </Link>
                    </div>
                    {system.regionName && (
                      <span className="block text-xs text-gray-500 truncate">
                        {system.regionName}
                      </span>
                    )}
                  </div>

                  <span className="text-lg font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                    {system.killCount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 5: Write `TopRegionsCard`**

Create `frontend/src/components/TopRegionsCard/TopRegionsCard.tsx`:

```tsx
'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Link from 'next/link';
import { ReactNode } from 'react';

export interface TopRegion {
  id: number;
  name: string;
  killCount: number;
}

export interface TopRegionsCardProps {
  title: string;
  subtitle?: ReactNode;
  regions: TopRegion[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopRegionsCard({
  title,
  subtitle,
  regions,
  loading = false,
  emptyText = 'No regions yet',
}: TopRegionsCardProps) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle && (
        <span className="text-xs text-gray-500 shrink-0">{subtitle}</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card header={header}>
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card header={header}>
      {regions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {regions.map((region, index) => (
            <div key={region.id} className="card-row">
              <div className="flex items-center gap-3">
                <RankNumber rank={index + 1} />

                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                  <Link
                    href={`/regions/${region.id}`}
                    className="block min-w-0 font-medium text-orange-400 truncate hover:underline"
                  >
                    {region.name}
                  </Link>
                  <span className="text-lg font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                    {region.killCount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 6: Verify**

```bash
cd /Users/umut/Sites/killreport
yarn workspace frontend lint
yarn workspace frontend build
yarn test
```

Expected: build succeeds, tests unchanged. Lint reports the repo's pre-existing 148 errors / 85 warnings; **confirm none of them names one of your three new files.** The `<img>` in `TopFactionsCard` will raise a `no-img-element` warning, which matches how every other card in this codebase renders an EVE image — leave it.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/graphql frontend/src/components/TopFactionsCard frontend/src/components/TopSystemsCard frontend/src/components/TopRegionsCard frontend/src/generated/graphql.ts
git commit -m "feat(frontend): add the faction, system and region cards

Three presentational cards on the TopShipsCard skeleton. Nothing renders
them yet; the sidebar wiring lands next.

Faction logos come from the alliance image endpoint: CCP's image server
has no /factions/ path and returns 400 for one, but faction ids live in
the alliance id space and resolve there — checked for all 27, including
the placeholder.

The system card reaches its region name through
solarSystem.constellation.region. Both hops are DataLoader-backed, so
ten rows are two batched queries rather than twenty."
```

---

### Task 6: Wire the cards into the sidebar

The last task. It also collapses the vestigial `variables` wrapper the leaderboard refactor's final review flagged — this task rewrites every hook call site in the file, so leaving it would mean touching them all again later.

**Files:**

- Modify: `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`
- Modify: `frontend/src/components/TopEntitySidebar/TopEntitySidebar.spec.tsx`
- Modify: `frontend/src/app/killmails/page.tsx`
- Modify: `frontend/src/components/SolarSystemDetail/KillmailsTab.tsx`

**Interfaces:**

- Consumes: the three hooks and three components from Task 5.
- Produces: `TopEntityCardKind` extended to `'characters' | 'corporations' | 'alliances' | 'factions' | 'attackerShips' | 'ships' | 'systems' | 'regions'`.

- [ ] **Step 1: Extend the sidebar's failing tests**

`frontend/src/components/TopEntitySidebar/TopEntitySidebar.spec.tsx` already mocks five hooks and asserts the shared scope reaches all of them. **Add `useTopFactionsQuery`, `useTopSystemsQuery` and `useTopRegionsQuery` to the mock factory**, add all three kinds to whatever list of card specs the existing tests render, and extend the shared-scope assertion so it covers **all eight** hooks rather than five.

Do not write a parallel set of three-hook tests beside the five-hook ones — the point of that file is that _every_ query in the sidebar receives the same scope, and a test that checks only some of them is the shape of the bug it exists to prevent.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/umut/Sites/killreport
yarn workspace frontend test src/components/TopEntitySidebar/TopEntitySidebar.spec.tsx
```

Expected: FAIL — the three new hooks are not called, so the shared-scope assertion finds nothing for them.

- [ ] **Step 3: Extend the card kind and collapse the variables wrapper**

In `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`:

```typescript
export type TopEntityCardKind =
  | 'characters'
  | 'corporations'
  | 'alliances'
  | 'factions'
  | 'attackerShips'
  | 'ships'
  | 'systems'
  | 'regions';
```

Replace

```typescript
const { limit = 10, ...scope } = filter ?? {};
const variables = { filter: { limit, ...scope } };
```

with

```typescript
const { limit = 10, ...scope } = filter ?? {};
// One filter object for every query in this sidebar. Keeping it shared is
// deliberate: it is what makes a card that silently stops accepting the
// page's scope impossible rather than merely unlikely.
const filterVars = { ...scope, limit, period: LeaderboardPeriod.Last_7Days };
```

and change all five existing hooks from `variables: { filter: { ...variables.filter, period: LeaderboardPeriod.Last_7Days } }` to `variables: { filter: filterVars }`.

- [ ] **Step 4: Add the three hooks**

Add to the imports:

```typescript
  useTopFactionsQuery,
  useTopRegionsQuery,
  useTopSystemsQuery,
```

and alongside the existing five hooks:

```typescript
const { data: factions, loading: factionsLoading } = useTopFactionsQuery({
  variables: { filter: filterVars },
  skip: !has('factions'),
});
const { data: systems, loading: systemsLoading } = useTopSystemsQuery({
  variables: { filter: filterVars },
  skip: !has('systems'),
});
const { data: regions, loading: regionsLoading } = useTopRegionsQuery({
  variables: { filter: filterVars },
  skip: !has('regions'),
});
```

- [ ] **Step 5: Add the three switch cases**

Import the three components at the top of the file, then add to the `switch (card.kind)` block:

```tsx
          case 'factions':
            return (
              <TopFactionsCard
                key={card.kind}
                title={card.title}
                subtitle={LAST_7_DAYS}
                factions={
                  factions?.topFactions?.map((entry) => ({
                    id: entry.faction?.id || 0,
                    name: entry.faction?.name || 'Unknown',
                    killCount: entry.killCount,
                  })) || []
                }
                loading={factionsLoading}
                emptyText={card.emptyText}
              />
            );

          case 'systems':
            return (
              <TopSystemsCard
                key={card.kind}
                title={card.title}
                subtitle={LAST_7_DAYS}
                systems={
                  systems?.topSystems?.map((entry) => ({
                    id: entry.solarSystem?.id || 0,
                    name: entry.solarSystem?.name || 'Unknown',
                    killCount: entry.killCount,
                    securityStatus: entry.solarSystem?.securityStatus,
                    regionId: entry.solarSystem?.constellation?.region?.id,
                    regionName: entry.solarSystem?.constellation?.region?.name,
                  })) || []
                }
                loading={systemsLoading}
                emptyText={card.emptyText}
              />
            );

          case 'regions':
            return (
              <TopRegionsCard
                key={card.kind}
                title={card.title}
                subtitle={LAST_7_DAYS}
                regions={
                  regions?.topRegions?.map((entry) => ({
                    id: entry.region?.id || 0,
                    name: entry.region?.name || 'Unknown',
                    killCount: entry.killCount,
                  })) || []
                }
                loading={regionsLoading}
                emptyText={card.emptyText}
              />
            );
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd /Users/umut/Sites/killreport
yarn workspace frontend test src/components/TopEntitySidebar/TopEntitySidebar.spec.tsx
```

Expected: PASS, with the shared-scope test now covering eight hooks.

- [ ] **Step 7: Reorder the killmails page to eight cards**

In `frontend/src/app/killmails/page.tsx`, replace `SIDEBAR_CARDS` with:

```typescript
const SIDEBAR_CARDS: TopEntityCardSpec[] = [
  {
    kind: 'characters',
    title: 'Most Active Pilots',
    emptyText: 'No pilot data available',
  },
  {
    kind: 'corporations',
    title: 'Most Active Corporations',
    emptyText: 'No corporation data available',
  },
  {
    kind: 'alliances',
    title: 'Most Active Alliances',
    emptyText: 'No alliance data available',
  },
  {
    kind: 'factions',
    title: 'Most Active Factions',
    emptyText: 'No faction data available',
  },
  {
    kind: 'attackerShips',
    title: 'Most Used Ships',
    emptyText: 'No ship data available',
  },
  {
    kind: 'ships',
    title: 'Most Killed Ships',
    emptyText: 'No ship data available',
  },
  {
    kind: 'systems',
    title: 'Most Active Systems',
    emptyText: 'No system data available',
  },
  {
    kind: 'regions',
    title: 'Most Active Regions',
    emptyText: 'No region data available',
  },
];
```

- [ ] **Step 8: Add factions to the solar system page**

In `frontend/src/components/SolarSystemDetail/KillmailsTab.tsx`, add one entry to its `SIDEBAR_CARDS`, after `alliances` and matching that file's own title style (it uses "Top X" and "No X activity in the last 7 days", not the killmails page's wording):

```typescript
  {
    kind: 'factions',
    title: 'Top Factions',
    emptyText: 'No faction activity in the last 7 days',
  },
```

Do **not** add `systems` or `regions` there. On a page scoped to one system, `topSystems` returns that system and `topRegions` returns its region — a one-row list either way.

- [ ] **Step 9: Verify everything**

```bash
cd /Users/umut/Sites/killreport
yarn test
yarn workspace frontend lint
yarn workspace frontend build
```

Expected: all tests pass with the frontend count up by however many assertions Step 1 added; build succeeds; lint reports the pre-existing 148 errors / 85 warnings with none in a file you changed.

- [ ] **Step 10: Check the cards against live data**

Restart the backend and frontend, then query the three new fields through the same shape the sidebar uses:

```bash
PORT=$(grep -m1 '^PORT' backend/.env | cut -d= -f2- | tr -d '"')
curl -s "http://localhost:$PORT/graphql" -H 'content-type: application/json' \
  -d '{"query":"query($f: TopFilter){ topFactions(filter:$f){ killCount faction{ id name } } topSystems(filter:$f){ killCount solarSystem{ name constellation{ region{ name } } } } topRegions(filter:$f){ killCount region{ name } } }","variables":{"f":{"limit":5,"period":"LAST_7_DAYS"}}}'
```

Expected: one `data` object carrying all three lists, no `errors`, and no faction with id 500021.

Then tell the user what to look at: `/killmails` should show eight cards in the order above, and `/solar-systems/30000142` should show a Top Factions card among its existing ones. **Visual confirmation is theirs, not yours — do not drive a browser.**

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/TopEntitySidebar frontend/src/app/killmails/page.tsx frontend/src/components/SolarSystemDetail/KillmailsTab.tsx
git commit -m "feat(frontend): show factions, systems and regions in the sidebar

The killmails sidebar goes from five cards to eight, ordered to match
the reference layout with our two ship cards kept apart rather than
merged. The solar system page gets factions only: on a page scoped to
one system, top systems and top regions are one-row lists.

The shared variables wrapper collapses into a single filterVars object.
Every hook already spread it and re-added the period; the wrapper only
made it look as though something else was passed. Keeping one filter
object across all eight queries is what makes a card that silently stops
accepting the page's scope impossible rather than merely unlikely — that
was a real bug on the solar system page before the query reshape."
```

---

## Follow-on

Not in this plan, recorded so they are not lost:

- `characters.faction_id` is populated on **0 of 50,953** rows. ESI returns it only for characters in a militia, so a low number is expected — zero is not. Worth its own investigation; no card depends on it.
- The `factions` table now makes a faction name resolvable anywhere. 363 corporations and 76 alliances carry a `faction_id` that could be shown on their pages. Out of scope here.
- `yarn kill` in both workspaces uses Linux-only `fuser` and does not work on macOS.
