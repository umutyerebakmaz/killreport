# 🚀 Killmails Query Performance Improvements

## 📊 Changes Made

### 1. Backend Optimizations

#### Cache TTL Increased

- **Before**: 60 seconds (1 minute) for all queries
- **After**:
  - **300 seconds (5 minutes)** for Killmails queries
  - **120 seconds (2 minutes)** for other public queries

**Why?** Killmail data rarely changes. Even if new killmails are added, older killmails become less important, so cache refresh isn't a problem.

#### Database Query Optimization

```typescript
// ❌ Previous: Eager load all relations with include
include: {
  victim: true,
  attackers: true,
  items: true,
}

// ✅ New: Only necessary fields with select
select: {
  killmail_id: true,
  killmail_hash: true,
  // ... only necessary fields
  victim: { select: { /* specific fields */ } },
  attackers: { select: { /* specific fields */ } },
}
```

**Benefit**:

- Less data transfer
- Reduced memory usage
- Relational data (character, corporation, alliance) batch loaded with DataLoader

#### Limit Control

- **Maximum 100 records** per page (DoS protection)
- Previously no limit control

### 2. DataLoader Usage

Field resolvers already use DataLoader:

```typescript
solarSystem: async (parent, _, context) => {
  return context.loaders.solarSystem.load(parent.solarSystemId);
};
```

**N+1 Problem Prevented**:

- Instead of 25 separate DB queries for 25 killmails
- All related data fetched with single batch query

## 📈 Expected Performance Gains

### Scenario 1: Same Query Called Repeatedly

- **Before**: DB query every time (200-500ms)
- **Now**: Redis cache response (5-20ms)
- **Gain**: ~10-100x faster

### Scenario 2: Different Users View Same Page

- **Before**: DB query for each user
- **Now**: Public cache sharing
- **Gain**: Reduced database load

### Scenario 3: Complex Relations (25 killmails)

- **Before**: 25 killmails + separate character/corp/alliance queries each = 100+ queries
- **Now**: 1 killmail query + 3-4 batch queries (DataLoader) = ~5 queries
- **Gain**: ~20x fewer DB queries

## 🎯 Additional Recommendations

### Check Database Indexes

Ensure these indexes exist:

```sql
-- Killmails filtering
CREATE INDEX IF NOT EXISTS idx_killmails_time ON killmails(killmail_time DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_solar_system ON killmails(solar_system_id);

-- Victim search
CREATE INDEX IF NOT EXISTS idx_victim_character ON victims(character_id);
CREATE INDEX IF NOT EXISTS idx_victim_corporation ON victims(corporation_id);
CREATE INDEX IF NOT EXISTS idx_victim_alliance ON victims(alliance_id);

-- Attacker search
CREATE INDEX IF NOT EXISTS idx_attackers_character ON attackers(character_id);
CREATE INDEX IF NOT EXISTS idx_attackers_corporation ON attackers(corporation_id);
CREATE INDEX IF NOT EXISTS idx_attackers_killmail ON attackers(killmail_id);

-- SolarSystem relations
CREATE INDEX IF NOT EXISTS idx_solar_system_constellation ON solar_systems(constellation_id);
```

### Frontend Optimizations

#### Apollo Client Cache Policy

```typescript
// frontend/src/lib/apolloClient.ts
const client = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          killmails: {
            keyArgs: ["filter"], // New cache when filter changes
            merge(existing, incoming) {
              // Merge logic for pagination
              return incoming;
            },
          },
        },
      },
    },
  }),
});
```

#### Virtualization (React-Window)

If displaying 100+ killmails:

```bash
cd frontend
yarn add react-window
```

### Use GraphQL Query Fragments

Manage repeated fields with fragments:

```graphql
fragment KillmailFields on Killmail {
  id
  killmailId
  killmailTime
  solarSystemId
}

query Killmails($filter: KillmailFilter) {
  killmails(filter: $filter) {
    edges {
      node {
        ...KillmailFields
        victim { ... }
      }
    }
  }
}
```

## 🧪 Testing

### 1. Redis Cache Check

```bash
# Connect to Redis
redis-cli

# See cache keys
KEYS *Killmails*

# Check TTL of a key
TTL public:{hash}
```

### 2. GraphQL Performance Monitoring

```bash
cd backend
yarn add @graphql-yoga/plugin-response-time

# Add to server.ts:
import { useResponseTime } from '@graphql-yoga/plugin-response-time'
```

### 3. Database Query Monitoring

```typescript
// Prisma query logging
// backend/src/services/prisma.ts
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});
```

## 📊 Monitoring

### GraphQL Response Time

Chrome DevTools Network tab:

- First load: ~200-500ms (cache miss)
- Subsequent loads: ~10-30ms (cache hit)

### Redis Memory Usage

```bash
redis-cli INFO memory | grep used_memory_human
```

### Database Connection Pool

```bash
# In backend
yarn prisma:studio
# Settings > Connection info
```

## 🎨 Frontend Cache Strategy

Apollo Client already does automatic caching, but for manual control:

```typescript
// Refetch policy
const { data } = useKillmailsQuery({
  fetchPolicy: "cache-first", // Check cache first
  nextFetchPolicy: "cache-first", // For subsequent requests too
});
```

## ⚠️ Important Considerations

1. **Cache Invalidation**: Clear cache when new killmail is added

   ```typescript
   await redisCache.del("public:*Killmails*");
   ```

2. **Memory Limits**: Redis has 256MB limit (DigitalOcean), cache large queries carefully

3. **Rate Limiting**: ESI API rate limit (50 req/sec) still applies, important for workers

## 🔗 Related Files

- Backend Cache: `backend/src/server.ts`
- Resolver: `backend/src/resolvers/killmail.resolver.ts`
- DataLoaders: `backend/src/services/dataloaders.ts`
- Cache Strategy Doc: `backend/CACHE_STRATEGY.md`
