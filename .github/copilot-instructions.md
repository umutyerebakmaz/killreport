# KillReport - AI Coding Agent Instructions

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

### Worker System

**Pattern**: Each queue has dedicated worker. Never mix concerns.

**Queue Names** (hardcoded in workers with source prefix):

**ESI Queues** (EVE ESI API):

- `esi_alliance_info_queue` → `worker:info:alliances` (3 concurrent)
- `esi_character_info_queue` → `worker:info:characters` (10 concurrent)
- `esi_corporation_info_queue` → `worker:info:corporations` (5 concurrent)
- `esi_type_info_queue` → `worker:info:types` (10 concurrent)
- `esi_all_alliances_queue` → `worker:alliances` (bulk sync, 1 concurrent)
- `esi_all_corporations_queue` → `worker:corporations` (bulk sync, 1 concurrent)
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

## Documentation References

- EVE SSO: `backend/EVE_SSO_README.md`
- Enrichment: `backend/ENRICHMENT_README.md`
- Character Sync: `backend/CHARACTER_KILLMAIL_WORKER.md`
- Architecture: `backend/MODULAR_ARCHITECTURE.md`
- GraphQL Schema: `backend/src/generated-schema.graphql` (auto-generated)
