# Database Connection Pool Fix

## Problem

DigitalOcean Managed PostgreSQL has a **maximum of 22 concurrent connections** limit. When running multiple workers simultaneously, the application was exceeding this limit causing connection pool exhaustion errors.

### Previous Architecture

- Backend API Server: 5 connections (via `prisma.ts`)
- Each Worker: 5 connections (each importing `prisma.ts`)
- **Total**: 5 + (N workers × 5) = Could easily exceed 22 connections

## Solution

Created a separate Prisma client for workers with aggressive connection pooling settings.

### New Architecture

1. **Backend API (`prisma.ts`)**: 5 connections maximum
2. **Workers (`prisma-worker.ts`)**: 2 connections maximum per worker
3. **Total Capacity**: 5 (API) + 16 (8 workers × 2) = 21 connections (1 buffer)

### Files Changed

#### New File Created

- `backend/src/services/prisma-worker.ts` - Worker-specific Prisma client with conservative pool settings

#### Worker Files Updated (21 files)

All worker files in `backend/src/workers/*.ts` now import and use `prismaWorker` instead of `prisma`:

- `worker-info-characters.ts`
- `worker-info-corporations.ts`
- `worker-info-alliances.ts`
- `worker-info-types.ts`
- `worker-alliance-corporations.ts`
- `worker-zkillboard-sync.ts`
- `worker-esi-user-killmails.ts`
- `worker-esi-corporation-killmails.ts`
- `worker-killmails.ts`
- `worker-redisq-stream.ts`
- `worker-alliance-snapshots.ts`
- `worker-corporation-snapshots.ts`
- `worker-regions.ts`
- `worker-systems.ts`
- `worker-constellations.ts`
- `worker-races.ts`
- `worker-bloodlines.ts`
- `worker-info-categories.ts`
- `worker-info-item-groups.ts`
- `scan-killmail-entities.ts`
- `sync-character-killmails.ts`
- `update-alliance-counts.ts`
- `fetch-single-killmail.ts`

#### Queue Files Updated (6 files)

Queue scripts that read from database also updated:

- `queue-alliance-corporations.ts`
- `queue-zkillboard-sync.ts`
- `queue-missing-groups.ts`
- `queue-corporation-esi-killmails.ts`
- `queue-user-esi-killmails.ts`
- `queue-alliance-corporation-characters.ts`

### Pool Configuration Comparison

| Component  | File               | Max Connections | Min Connections | Idle Timeout | Connection Timeout | Use Case             |
| ---------- | ------------------ | --------------- | --------------- | ------------ | ------------------ | -------------------- |
| API Server | `prisma.ts`        | 5               | 1               | 30 seconds   | 10 seconds         | GraphQL API requests |
| Workers    | `prisma-worker.ts` | 2               | 0               | 10 seconds   | 10 seconds         | Background jobs      |

### Production Workload (Current)

Based on `ecosystem.config.js`:

- 1 Backend API Server: 5 connections
- 1 RedisQ Worker: 2 connections
- 1 Character Worker: 2 connections
- 1 Corporation Worker: 2 connections
- 1 Alliance Worker: 2 connections
- 1 Alliance-Corporation Worker: 2 connections
- 1 Type Worker: 2 connections
- 1 zKillboard Worker: 2 connections
- 1 User Killmail Worker: 2 connections

**Total Active:** 5 + (8 workers × 2) = 21 connections
**Available:** 22 connections (DigitalOcean limit)
**Buffer:** 1 connection remaining

### Worker Pool Settings

```typescript
max: 2,                        // Maximum 2 connections per worker
min: 0,                        // No minimum - release all idle
idleTimeoutMillis: 10000,      // Close idle after 10 seconds
connectionTimeoutMillis: 10000, // Wait up to 10 seconds for connection
allowExitOnIdle: true          // Allow complete drain
5. **Optimal Performance**: API server has 5 connections for parallel GraphQL queries
6. **Worker Efficiency**: Each worker has 2 connections for better throughput

### DigitalOcean Connection Pool Configuration

**Connection Pools (on DigitalOcean side):**
- `dev` pool: 5 connections (sufficient for development/testing)
- `prod` pool: 17 connections (perfect for production workload)

**Why 17 for prod pool?**
- Total available: 22 connections
- Reserved for API: 5 connections
- Remaining for workers: 17 connections (but only 16 will be used)
- This leaves 1 connection as buffer for monitoring/system queries
```

### API Server Pool Settings

```typescript
max: 5,                        // Maximum 5 connections
min: 1,                        // Keep 1 connection alive
idleTimeoutMillis: 30000,      // Close idle after 30 seconds
connectionTimeoutMillis: 10000, // Wait up to 10 seconds for connection
allowExitOnIdle: false         // Keep pool alive for API server
```

### Benefits

1. **No More Connection Exhaustion**: Can run up to 8 workers simultaneously (2 connections × 8 = 16, + 5 API = 21)
2. **Better Resource Management**: Reasonable idle timeouts prevent connection churn
3. **No More Timeout Errors**: 10 second connection timeout prevents premature failures
4. **Isolation**: API server and workers use separate connection pools
5. **Monitoring**: Each pool logs connection events with `[Worker]` prefix

### Running Multiple Workers

You can now safely run multiple workers:

```bash
# Terminal 1: Backend API
cd backend && yarn dev

# Terminal 2: Character enrichment
yarn worker:info:characters

# Terminal 3: Corporation enrichment
yarn worker:info:corporations

# Terminal 4: Alliance enrichment
yarn worker:info:alliances

# Terminal 5: Type enrichment
yarn worker:info:types

# And so on... up to 8 workers safely
```

### Monitoring

Watch the logs for connection pool status:

```
✅ [Worker] PostgreSQL pool configured: max=2 connections, min=0, idleTimeout=3s, pid=12345
🔌 [Worker] Pool connection opened - Total: 1, Idle: 0, Waiting: 0
❌ [Worker] Pool connection closed - Total: 0, Idle: 0, Waiting: 0
```

### Important Notes

1. **API Server**: Always uses `prisma` from `services/prisma.ts`
2. **Workers**: Always use `prismaWorker` from `services/prisma-worker.ts`
3. **Queue Scripts**: Use `prismaWorker` since they run independently
4. **Resolvers**: Use `prisma` (they run in API context)

### If You Still Get Connection Issues

If you still encounter "too many clients" errors:

1. **Check running workers**: `ps aux | grep worker`
2. **Reduce worker concurrency**: Lower the `max` value in `prisma-worker.ts`
3. **Increase idle timeout**: If connections aren't releasing fast enough
4. **Check for connection leaks**: Ensure all queries are properly awaited

### Migration Guide

When creating new workers or queue scripts:

```typescript
// ✅ Correct - for workers
import prismaWorker from "../services/prisma-worker";
await prismaWorker.character.findMany();

// ❌ Wrong - for workers
import prisma from "../services/prisma";
await prisma.character.findMany();

// ✅ Correct - for resolvers (API context)
import prisma from "../services/prisma";
await prisma.character.findMany();
```

## Testing

After this fix, verify everything works:

```bash
# 1. Start backend
cd backend && yarn dev

# 2. Start a few workers in separate terminals
yarn worker:info:characters
yarn worker:info:corporations
yarn worker:info:types

# 3. Check logs for connection counts
# Each worker should show max 2 connections
# API should show max 5 connections
```

## References

- DigitalOcean PostgreSQL Connection Limits: <https://docs.digitalocean.com/products/databases/postgresql/>
- Node.js pg Pool Options: <https://node-postgres.com/apis/pool>
- Prisma Adapter: <https://www.prisma.io/docs/orm/overview/databases/postgresql>
