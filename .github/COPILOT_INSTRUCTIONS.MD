# KillReport - AI Coding Agent Instructions

## Core Development Principles

### Package Manager

## ⚠️ CRITICAL: YARN ONLY - NO NPM ALLOWED ⚠️

**THIS IS NOT OPTIONAL**: This project EXCLUSIVELY uses Yarn. Using npm commands will break the project.

**WHY THIS MATTERS**:

- Yarn workspaces configured in root `package.json`
- `yarn.lock` maintains exact dependency versions
- npm creates conflicting `package-lock.json` and breaks workspace resolution
- npm install will corrupt the dependency tree

**CORRECT COMMANDS** (✅ ALWAYS USE THESE):

```bash
yarn install          # NOT: npm install
yarn add package      # NOT: npm install package
yarn remove package   # NOT: npm uninstall package
yarn dev             # NOT: npm run dev
yarn codegen         # NOT: npm run codegen
yarn prisma:migrate  # NOT: npm run prisma:migrate
```

**FORBIDDEN COMMANDS** (❌ NEVER USE THESE):

```bash
npm install          # ❌ WRONG
npm i                # ❌ WRONG
npm run anything     # ❌ WRONG
npm install package  # ❌ WRONG
```

**IF YOU CATCH YOURSELF WRITING `npm`**: STOP IMMEDIATELY and rewrite with `yarn`.

### Separation of Concerns (SoC)

**MANDATORY**: Always follow separation of concerns principle in all implementations:

- **Services Layer** (`backend/src/services/`): Business logic, database queries, external API calls
- **Resolvers Layer** (`backend/src/resolvers/`): GraphQL orchestration only, delegate to services
- **Schema Layer** (`backend/src/schemas/`): GraphQL type definitions, independent and modular
- **Workers Layer** (`backend/src/workers/`): Queue processing, isolated from API logic
- **Components Layer** (`frontend/src/components/`): Reusable UI, no business logic
- **Utilities Layer** (`utils/`, `helpers/`): Pure functions, no side effects

**Examples**:

- ✅ Resolver calls service → Service queries database
- ❌ Resolver contains database query logic
- ✅ Independent top-level queries for statistics (parallel execution)
- ❌ Nested resolvers that cause N+1 problems
- ✅ Services use Redis caching, resolvers don't know about cache
- ❌ Mixing API logic with worker queue processing

## Architecture Overview

**Full-stack EVE Online killmail tracker**: Next.js 15 frontend + GraphQL Yoga backend + PostgreSQL + RabbitMQ workers

### Service Boundaries

- **Backend** (`/backend`): GraphQL API server on port 4000
- **Frontend** (`/frontend`): Next.js App Router on port 3000
- **Workers**: RabbitMQ-based distributed task processors (independent processes)
- **External APIs**: EVE ESI (rate limited 50 req/sec) + zKillboard (rate limited)

### Data Flow Pattern

```
User Request → GraphQL → DataLoader (batching) → Prisma → PostgreSQL
                    ↓
            RabbitMQ Queue → Workers → ESI/zKillboard APIs → Database
```

## Critical Development Workflows

### Monorepo Structure

- Root manages workspaces: `yarn install` installs both
- Run from root: `yarn dev:frontend` or `yarn dev:backend`
- Each workspace has independent `package.json`

### GraphQL Schema Changes (Backend)

1. Edit `.graphql` files in `backend/src/schema/` (use `extend type Query` for modularity)
2. Run `yarn codegen` to regenerate `generated-types.ts` and `generated-schema.graphql`
3. Implement resolvers in domain-specific files (e.g., `character.resolver.ts`)
4. Import/export in `backend/src/resolvers/index.ts`
5. **Never edit generated files manually**

### GraphQL Client Changes (Frontend)

1. Create `.graphql` files co-located with components (e.g., `alliances/alliances.graphql`)
2. Run `yarn codegen` to generate typed hooks in `src/generated/graphql.ts`
3. Use generated hooks: `useAlliancesQuery()`, `useLoginMutation()`, etc.
4. ApolloClient configured in `src/lib/apolloClient.ts` with auth link

### Database Migrations

```bash
# Make schema changes in backend/prisma/schema.prisma
cd backend
yarn prisma:migrate      # Creates migration + applies
yarn prisma:generate     # Regenerates Prisma client
yarn prisma:studio       # GUI for data inspection
```

### Database Connection Pool Management

**CRITICAL**: Use the correct Prisma client based on context:

- **API Server & Resolvers**: Import from `services/prisma.ts` (5 connections max)
- **Workers & Queue Scripts**: Import from `services/prisma-worker.ts` (2 connections max per worker)

```typescript
// ✅ Correct - for workers/queue scripts
import prismaWorker from "@services/prisma-worker";
await prismaWorker.character.findMany();

// ✅ Correct - for resolvers (API context)
import prisma from "@services/prisma";
await prisma.character.findMany();
```

**Reason**: DigitalOcean PostgreSQL has 22 connection limit. Separate pools prevent exhaustion when running multiple workers. See `backend/POOL_CONNECTION_FIX.md` for details.

### Worker System

**Pattern**: Each queue has dedicated worker. Never mix concerns.

**Queue Names** (hardcoded in workers with source prefix):

**ESI Queues** (EVE ESI API):

- `esi_alliance_info_queue` → `worker:info:alliances` (3 concurrent)
- `esi_character_info_queue` → `worker:info:characters` (10 concurrent)
- `esi_corporation_info_queue` → `worker:info:corporations` (5 concurrent)
- `esi_type_info_queue` → `worker:info:types` (10 concurrent)
- `esi_alliance_corporations_queue` → `worker:alliance-corporations` (5 concurrent)

**zKillboard Queues**:

- `zkillboard_character_queue` → `worker:zkillboard`

**Workflow**:

1. Queue jobs: `yarn queue:alliances` or `yarn scan:entities`
2. Start workers (separate terminals): `yarn worker:info:characters`
3. Workers use `channel.prefetch(N)` for concurrency control
4. All ESI calls go through `esiRateLimiter.execute()` (50 req/sec max)

## Project-Specific Conventions

### Resolver Pattern (Backend)

- **Domain-based files**: `alliance.resolver.ts`, `character.resolver.ts`
- Export separate objects: `allianceQueries`, `allianceMutations`, `allianceFieldResolvers`
- Combine in `resolvers/index.ts` using spread: `Query: { ...userQueries, ...characterQueries }`
- Field resolvers for relations: `Character.corporation` resolver fetches via DataLoader

### DataLoader N+1 Prevention

- Always use DataLoaders for relations: `context.allianceLoader.load(id)`
- Created per-request in `server.ts`: `createDataLoaders()` returns fresh instances
- Pattern: Batch multiple IDs into single `WHERE id IN (...)` query
- See `backend/src/services/dataloaders.ts` for examples

### Authentication Flow

1. Frontend calls `login` mutation → gets SSO URL
2. User redirects to EVE SSO → callback with `code`
3. Frontend calls `authenticateWithCode(code, state)` → receives JWT
4. Token stored in `localStorage` as `eve_access_token`
5. ApolloClient's `authLink` injects `Authorization: Bearer <token>` header
6. Backend `server.ts` context validates token via `verifyToken()` from `eve-sso.ts`

### Rate Limiting Strategy

- ESI allows 150 req/sec but workers use 50 req/sec per instance for safety
- `esiRateLimiter.execute()` wraps all ESI calls with 20ms minimum delay
- Workers use `channel.prefetch(N)` to limit concurrent processing
- zKillboard requires 10 second delay between same endpoint calls

### Environment Configuration

- Backend uses `backend/src/config.ts` as single source of truth
- All env vars loaded via `dotenv` in `config.ts`
- Frontend uses `process.env.NEXT_PUBLIC_*` directly in client code
- Required vars: `EVE_CLIENT_ID`, `EVE_CLIENT_SECRET`, `DATABASE_URL`, `RABBITMQ_URL`

## Key Integration Points

### Enrichment System

**Purpose**: Auto-populate missing character/corp/alliance/type data from killmails

**Process**:

1. `yarn scan:entities` analyzes killmails → queues missing entities
2. 4 specialized workers fetch from ESI independently
3. Uses `upsert` to prevent race conditions with concurrent workers
4. Filters out NPCs (character_id < 3000000 or > 100000000)

### zKillboard Sync

- Public API: No auth needed for character history
- Pagination: 200 killmails per page, max configurable
- Pattern: Fetch IDs from zKillboard → fetch details from ESI → save to DB
- Direct sync: `yarn sync:character 95465499 50` (50 pages = 10k killmails)

### Prisma Naming Strategy

- Models use singular PascalCase: `Alliance`, `Character`
- Tables use plural snake_case: `alliances`, `characters` (via `@@map`)
- This allows idiomatic code while following SQL conventions

## Common Pitfalls

1. **Don't restart codegen manually**: Use `yarn codegen` after schema changes
2. **Don't modify generated files**: Edit source `.graphql` or `schema.prisma` instead
3. **Don't forget DataLoaders**: New field resolvers must use loaders to prevent N+1
4. **Don't mix queue names**: Each worker hardcodes its queue name as `QUEUE_NAME` constant
5. **Worker concurrency**: Match `PREFETCH_COUNT` to API rate limits (ESI: 10, zKillboard: 1)
6. **Next.js Client Components**: Use `"use client"` directive when using hooks/state (App Router)

## Testing & Debugging

### Check Worker Status

```bash
# Backend GraphQL API includes worker monitoring
query { workerStatus { queueName messageCount consumerCount } }
```

### Direct Database Access

```bash
cd backend
yarn prisma:studio  # Opens GUI on localhost:5555
```

### Test Specific Features

```bash
# Backend has documented test scripts
yarn test:enrichment          # Test enrichment system
bash test-killmails.sh        # Test killmail fetching
```

## Leaderboard System Architecture

**Real-Time Aggregation Tables**: O(1) lookup with zero latency updates

- `character_kill_stats` - Daily aggregated: (kill_date, character_id, kill_count)
- `corporation_kill_stats` - Daily aggregated per corporation
- `alliance_kill_stats` - Daily aggregated per alliance

**Real-Time Update Strategy**:

- ✅ **Transaction-based**: Updates happen IN TRANSACTION when saving killmails
- ✅ **Atomic UPSERT**: Uses `ON CONFLICT DO UPDATE` for concurrency safety
- ✅ **Zero latency**: Leaderboards reflect new kills within seconds
- ✅ **No scheduled jobs**: No cron, no refresh delays, no materialized views
- Composite indexes: `(kill_date, kill_count DESC)` for fast sorted queries
- All resolvers located in: `backend/src/resolvers/leaderboard/queries.ts`
- Update logic in: `backend/src/services/kill-stats-realtime.ts`

**Query Pattern Example**:

```typescript
// Dynamic limit with maximum cap
const limit = Math.min(filter?.limit ?? 100, 100);

// Cache key includes ALL parameters for granular control
const cacheKey = `leaderboard:topPilots:${targetDate}:${limit}`;

// Fast index scan - O(1) lookup
const rows = await prisma.$queryRaw`
  SELECT character_id, kill_count
  FROM character_kill_stats
  WHERE kill_date = ${targetDate}::date
  ORDER BY kill_count DESC
  LIMIT ${limit}
`;
```

**Cache Strategy**:

- **Current day/week/month**: 300 seconds (5 min) - balances freshness vs performance
- **Past dates**: 3600 seconds (1 hour) - historical data never changes
- **Cache key pattern**: `leaderboard:{queryName}:{dateParam}:{limitParam}`
- Cache provides fast reads while real-time updates ensure data accuracy

**Available Queries**:

- `topPilots` - Daily top killers
- `topWeeklyPilots` - Weekly leaderboard (Monday-Sunday)
- `topMonthlyPilots` - Monthly leaderboard
- `topLast7DaysPilots` - Rolling 7-day window
- `top90DaysPilots` - Rolling 90-day window
- `topLast7DaysCorporations` - Corp leaderboard (7 days)
- `topLast7DaysAlliances` - Alliance leaderboard (7 days)
- `topLast7DaysShips` - Most destroyed ships (7 days)
- `topLast7DaysAttackerShips` - Most used attacker ships (7 days)

## Redis Caching Best Practices

**Standard Pattern in All Resolvers**:

```typescript
// 1. Generate contextual cache key with ALL parameters
const cacheKey = `domain:action:${param1}:${param2}:${limit}`;

// 2. Check cache first
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// 3. Fetch from database
const data = await prisma...

// 4. Cache with appropriate TTL
const isToday = dateStr === new Date().toISOString().split('T')[0];
await redis.setex(cacheKey, isToday ? 300 : 3600, JSON.stringify(data));

return data;
```

**TTL Guidelines**:

- **Real-time data** (today/current week/month): `300` (5 minutes)
- **Historical data** (past dates): `3600` (1 hour)
- **Static data** (type info, system info): `86400` (24 hours)
- **Rarely changing** (alliance/corp info): `7200` (2 hours)

**Cache Key Naming Convention**:

- Format: `{domain}:{action}:{param1}:{param2}:{...}`
- Include ALL filter parameters (date, limit, filters)
- Examples:
  - `leaderboard:topPilots:2025-03-15:50`
  - `killmails:character:95465499:page:1:limit:25`
  - `character:info:95465499`

## Common Code Patterns

### Dynamic Limit with Maximum Cap

```typescript
// Default: 100, Frontend can request less, Max: 100
const limit = Math.min(filter?.limit ?? 100, 100);
```

### Date Helper: Get Week Monday (UTC)

```typescript
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}
```

### Character/Entity Map Pattern (Prevent N+1)

```typescript
// ✅ CORRECT: Single batch query + Map lookup
const characterIds = rows.map((r) => r.character_id);
const characters = await prisma.character.findMany({
  where: { id: { in: characterIds } },
});
const charMap = new Map(characters.map((c) => [c.id, c]));

// Usage in loop - O(1) lookup
const character = charMap.get(row.character_id);
```

```typescript
// ❌ WRONG: N+1 query problem
for (const row of rows) {
  const character = await prisma.character.findUnique({
    where: { id: row.character_id },
  });
}
```

### Date Serialization for GraphQL

```typescript
// Convert Prisma Date objects to ISO strings
character: char
  ? {
      ...char,
      birthday: char.birthday.toISOString(),
      updatedAt: char.updated_at?.toISOString() ?? null,
      securityStatus: char.security_status ?? null,
    }
  : null;
```

## Resolver File Organization

**Location Pattern**: `backend/src/resolvers/{domain}/{type}.ts`

**Directory Structure**:

```
backend/src/resolvers/
├── index.ts              # Combines all resolvers with spread operator
├── user/
│   ├── mutations.ts
│   └── queries.ts
├── character/
│   ├── fields.ts         # Field resolvers (relations via DataLoader)
│   ├── mutations.ts
│   └── queries.ts
├── corporation/
│   ├── fields.ts
│   └── queries.ts
├── alliance/
│   ├── fields.ts
│   └── queries.ts
├── leaderboard/
│   └── queries.ts        # 8 different leaderboard queries
├── killmail/
│   ├── fields.ts
│   └── queries.ts
└── victim/
    └── fields.ts
```

**Naming Convention & Export Pattern**:

```typescript
// In character/queries.ts
export const characterQueries: QueryResolvers = {
  character: async (_, { id }, { characterLoader }) => {
    return characterLoader.load(id);
  },
  // ... more queries
};

// In character/mutations.ts
export const characterMutations: MutationResolvers = {
  addCharacter: async (_, { input }) => { ... },
};

// In character/fields.ts
export const characterFieldResolvers: CharacterResolvers = {
  corporation: async (parent, _, { corporationLoader }) => {
    return corporationLoader.load(parent.corporation_id);
  },
};

// In resolvers/index.ts - combine with spread
import { characterQueries } from './character/queries';
import { characterMutations } from './character/mutations';
import { characterFieldResolvers } from './character/fields';

export const resolvers: Resolvers = {
  Query: {
    ...userQueries,
    ...characterQueries,
    ...allianceQueries,
    ...leaderboardQueries,
  },
  Mutation: {
    ...userMutations,
    ...characterMutations,
  },
  Character: characterFieldResolvers,
};
```

## Quick File Navigation Reference

### Backend Core Files

- **Resolvers**: `backend/src/resolvers/` (domain-organized)
- **Services**: `backend/src/services/` (business logic)
- **Schema**: `backend/src/schema/*.graphql` (modular type definitions)
- **Config**: `backend/src/config.ts` (single source of truth for env vars)
- **Prisma Client (API)**: `backend/src/services/prisma.ts` (5 connections)
- **Prisma Client (Workers)**: `backend/src/services/prisma-worker.ts` (2 connections)
- **DataLoaders**: `backend/src/services/dataloaders.ts` (N+1 prevention)

### Leaderboard System

- **Resolvers**: `backend/src/resolvers/leaderboard/queries.ts`
- **Schema**: `backend/src/schema/leaderboard.graphql`
- **Stats Tables**: `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats`
- **Documentation**: `backend/docs/LEADERBOARD_QUERIES.MD`

### Frontend Structure

- **GraphQL Queries**: Co-located `.graphql` files with components
- **Generated Types**: `frontend/src/generated/graphql.ts` (auto-generated)
- **Apollo Client**: `frontend/src/lib/apolloClient.ts` (auth + cache config)
- **Components**: `frontend/src/components/` (presentational only)
- **App Routes**: `frontend/src/app/` (Next.js App Router)

### Worker & Queue System

- **Workers**: `backend/src/workers/` (RabbitMQ consumers)
- **Queue Scripts**: `backend/src/scripts/queue-*.ts` (job publishers)
- **Rate Limiter**: `backend/src/services/esi-rate-limiter.ts` (50 req/sec)

## Performance Optimization Checklist

### ✅ ALWAYS DO

- Use pre-aggregated stats tables for leaderboards (NOT raw `killmails` or `attackers`)
- Include Redis caching with contextual keys (include ALL filter params)
- Use DataLoaders for all field resolvers to prevent N+1 queries
- Optimize indexes: Composite indexes on `(date, count DESC)` for sorted queries
- Implement dynamic limits: `Math.min(filter?.limit ?? default, max)`
- Batch database queries: `WHERE id IN (...)` instead of loops
- Use different TTL for current vs historical data (300s vs 3600s)
- Use Map/Set for O(1) lookups when mapping IDs to entities

### ❌ NEVER DO

- Query raw `attackers` or `killmails` tables for aggregations (use stats tables)
- Fetch all records then filter in JavaScript (filter at database level)
- Make queries inside loops (batch with `WHERE IN` or DataLoader)
- Forget to include all parameters in cache keys (causes cache pollution)
- Use same Prisma client for workers and API (connection pool exhaustion)
- Modify generated files (`generated-types.ts`, `generated-schema.graphql`)
- Use npm commands (YARN ONLY)

## Documentation Best Practices

### Markdown File Links

**CRITICAL for GitHub compatibility**: When creating links in markdown documentation files:

**✅ CORRECT - Use absolute paths from repository root:**

```markdown
[kill-stats-realtime.ts](/backend/src/services/kill-stats-realtime.ts)
[worker-redisq-stream.ts](/backend/src/workers/worker-redisq-stream.ts)
```

**❌ WRONG - Relative paths don't work reliably on GitHub:**

```markdown
[kill-stats-realtime.ts](../../src/services/kill-stats-realtime.ts)
[worker-redisq-stream.ts](../workers/worker-redisq-stream.ts)
```

**Why**:

- Absolute paths starting with `/` resolve from repository root on GitHub
- Relative paths (`../../`) often break when viewing on GitHub web interface
- Absolute paths work both locally and on GitHub consistently

**Pattern**: `/backend/src/{folder}/{file}.ts` for backend files

## Documentation References

- **EVE SSO**: `backend/EVE_SSO_README.md`
- **Enrichment**: `backend/ENRICHMENT_README.md`
- **Character Sync**: `backend/CHARACTER_KILLMAIL_WORKER.md`
- **Architecture**: `backend/MODULAR_ARCHITECTURE.md`
- **Leaderboard System**: `backend/docs/LEADERBOARD_QUERIES.MD`
- **Cache Optimization**: `backend/docs/CACHE_OPTIMIZATION_SUMMARY.MD`
- **Pool Connection Fix**: `backend/docs/POOL_CONNECTION_FIX.MD`
- **Capsule Value**: `backend/docs/CAPSULE_VALUE_CALCULATION.MD` - Fixed 10 ISK ship value
- **GraphQL Schema**: `backend/src/generated-schema.graphql` (auto-generated, don't edit)
