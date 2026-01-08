# Cache Performance Optimization Guide

## Overview

KillReport uses a multi-layer caching strategy to optimize GraphQL query performance:

1. **Redis Entity Cache**: Individual entity caching at resolver level
2. **GraphQL Response Cache**: Full query response caching via `@envelop/response-cache`
3. **DataLoader**: Per-request batching and deduplication

## Cache Layers

### 1. Entity-Level Cache (Redis)

Direct caching of individual entities in resolver functions:

```typescript
// Example from killmail.resolver.ts
const cacheKey = `killmail:detail:${id}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... fetch from database ...

await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

**Cached Entities:**

- ✅ Killmail details (1 hour TTL)
- ✅ Character details (30 min TTL)
- ✅ Corporation details (30 min TTL)
- ✅ Alliance details (30 min TTL)
- ✅ Type/Ship details (24 hour TTL)
- ✅ Category details (24 hour TTL)
- ✅ ItemGroup details (24 hour TTL)

**Cache Key Pattern:**

```text
entity_type:detail:id
```

Examples:

- `killmail:detail:123456`
- `character:detail:95465499`
- `corporation:detail:98388312`

### 2. GraphQL Response Cache

Full query response caching configured in `server.ts`:

```typescript
useResponseCache({
  session: (request) => {
    // Public queries: same cache for all users
    // User queries: per-user cache
  },
  ttl: (context) => {
    // Dynamic TTL based on operation name
  },
  cache: {
    // Redis storage backend
  },
});
```

**Public Queries (Cached for All Users):**

- List queries: `Alliances`, `Corporations`, `Characters`, `Killmails`
- Detail queries: `Alliance`, `Corporation`, `Character`, `Killmail`, `Type`
- Static data: `Categories`, `ItemGroups`, `Regions`, `Systems`

**Cache TTL by Query Type:**

| Query Type                     | TTL    | Reason                          |
| ------------------------------ | ------ | ------------------------------- |
| Killmail detail                | 1 hour | Never changes                   |
| Type/Category/ItemGroup        | 1 hour | Rarely changes                  |
| Character/Corp/Alliance detail | 30 min | Updates occasionally            |
| Killmails list                 | 5 min  | New killmails arrive frequently |
| Other public queries           | 2 min  | General safety                  |

### 3. DataLoader (In-Memory)

Per-request batching and deduplication in `services/dataloaders.ts`:

```typescript
export const createDataLoaders = () => ({
  characterLoader: new DataLoader(batchCharacters),
  corporationLoader: new DataLoader(batchCorporations),
  allianceLoader: new DataLoader(batchAlliances),
  // ...
});
```

**Benefits:**

- Prevents N+1 queries within a single request
- Batches multiple IDs into single database query
- Deduplicates requests for same entity

## Cache Management

### GraphQL Queries

Get cache statistics:

```graphql
query {
  cacheStats {
    totalKeys
    killmailDetailKeys
    characterDetailKeys
    corporationDetailKeys
    allianceDetailKeys
    responseCacheKeys
    memoryUsage
    isHealthy
  }
}
```

### Cache Invalidation Mutations

Clear specific entity caches:

```graphql
mutation {
  clearKillmailCache(killmailId: 123456) {
    success
    message
  }

  clearCharacterCache(characterId: 95465499) {
    success
    message
  }

  clearCorporationCache(corporationId: 98388312) {
    success
    message
  }

  clearAllianceCache(allianceId: 99003214) {
    success
    message
  }

  # After bulk killmail sync
  clearAllKillmailCaches {
    success
    message
  }
}
```

### Cache Manager Utility

Programmatic cache management in code:

```typescript
import CacheManager from "../utils/cache-manager";

// Clear specific entity
await CacheManager.clearKillmail(123456);
await CacheManager.clearCharacter(95465499);

// Clear by pattern
await CacheManager.clearPattern("killmail:detail:*");

// Get statistics
const stats = await CacheManager.getStats();

// Health check
const isHealthy = await CacheManager.healthCheck();

// Memory usage
const memory = await CacheManager.getMemoryUsage();
```

## Performance Impact

### Before Optimization

- Killmails query: ~2-5 seconds (cold)
- Detail pages: ~500ms-1s (with N+1 queries)
- Repeated queries: No caching benefit

### After Optimization

- Killmails query: ~100-300ms (first hit), <50ms (cached)
- Detail pages: ~50-100ms (first hit), <10ms (cached)
- Repeated queries: Instant responses from cache
- Reduced database load: 80-90% reduction

## Cache Invalidation Strategy

### Automatic Invalidation

Currently, cache entries expire based on TTL. Future improvements could include:

- Invalidate on mutation (e.g., when updating character/corp data)
- Webhook-based invalidation from ESI updates
- Selective invalidation based on data relationships

### Manual Invalidation

Use GraphQL mutations or CacheManager utility when:

- Bulk data sync completes
- Manual data corrections are made
- Testing requires fresh data
- Cache corruption is suspected

## Redis Configuration

### Connection Pool

- API Server: 5 connections (via `services/redis.ts`)
- Workers: 2 connections per worker (via `services/redis-worker.ts`)

### Memory Management

Monitor memory usage:

```bash
redis-cli INFO memory
```

Configure max memory in Redis:

```conf
maxmemory 512mb
maxmemory-policy allkeys-lru
```

### Recommended Settings

```conf
# Persistence (optional for cache)
save ""
appendonly no

# Memory optimization
maxmemory 512mb
maxmemory-policy allkeys-lru

# Connection limits
maxclients 100
timeout 300
```

## Monitoring

### Check Cache Hit Rate

In GraphQL Yoga logs, response cache plugin reports hits/misses:

```
✅ Response cache HIT for Killmail:123456
❌ Response cache MISS for Character:95465499
```

### Redis Memory Usage

```bash
# Connect to Redis
redis-cli

# Check memory
INFO memory

# Check key count
DBSIZE

# Sample random keys
RANDOMKEY

# Get keys by pattern
KEYS killmail:detail:*
```

### Application Metrics

Monitor in your APM tool:

- Cache hit rate
- Average response time
- Database query count
- Redis connection pool usage

## Best Practices

1. **Always use DataLoaders in field resolvers** - Prevents N+1 queries
2. **Cache immutable data longer** - Killmails never change, cache for hours
3. **Cache mutable data shorter** - Characters/corps update, cache for minutes
4. **Monitor memory usage** - Set appropriate Redis maxmemory
5. **Invalidate on mutations** - Clear cache when data changes
6. **Use appropriate TTLs** - Balance freshness vs performance
7. **Profile regularly** - Measure actual performance gains

## Troubleshooting

### Cache Not Working

1. Check Redis connection: `await CacheManager.healthCheck()`
2. Verify operationName in request matches cached queries
3. Check TTL isn't too short
4. Look for cache errors in logs

### Stale Data

1. Reduce TTL for affected query type
2. Implement mutation-based invalidation
3. Use `clearAllKillmailCaches` after large data updates or maintenance

### High Memory Usage

1. Check key count: `redis-cli DBSIZE`
2. Reduce TTL values
3. Implement LRU eviction policy
4. Increase Redis memory limit

### Performance Not Improved

1. Verify cache is actually hitting (check logs)
2. Ensure DataLoaders are being used
3. Check for N+1 queries in database logs
4. Profile database query performance

## Future Improvements

- [ ] Implement mutation-based cache invalidation
- [ ] Add cache warming on server startup
- [ ] Implement Redis Cluster for horizontal scaling
- [ ] Add GraphQL query complexity analysis
- [ ] Implement rate limiting per user
- [ ] Add APM integration (New Relic, Datadog)
- [ ] Implement cache versioning for schema changes
- [ ] Add cache hit rate metrics endpoint
