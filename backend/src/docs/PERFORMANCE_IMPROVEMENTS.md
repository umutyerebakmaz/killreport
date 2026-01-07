# 🚀 Killmails Query Performans İyileştirmeleri

## 📊 Yapılan Değişiklikler

### 1. Backend Optimizasyonları

#### Cache TTL Artırıldı

- **Önce**: Tüm query'ler için 60 saniye (1 dakika)
- **Sonra**:
  - Killmails query'leri için **300 saniye (5 dakika)**
  - Diğer public query'ler için **120 saniye (2 dakika)**

**Neden?** Killmail verileri nadiren değişir. Yeni killmail eklense bile, eski killmail'lerin önemi azaldığından cache'in refresh olması problem değil.

#### Database Query Optimizasyonu

```typescript
// ❌ Önceki Hali: Include ile tüm ilişkiler eager load
include: {
  victim: true,
  attackers: true,
  items: true,
}

// ✅ Yeni Hali: Select ile sadece gerekli alanlar
select: {
  killmail_id: true,
  killmail_hash: true,
  // ... sadece gerekli alanlar
  victim: { select: { /* specific fields */ } },
  attackers: { select: { /* specific fields */ } },
}
```

**Fayda**:

- Daha az veri transfer edilir
- Memory kullanımı azalır
- İlişkisel veriler (character, corporation, alliance) DataLoader ile batch yüklenir

#### Limit Kontrolü

- **Maksimum 100 kayıt** per page (DoS koruması)
- Önceden limit kontrolü yoktu

### 2. DataLoader Kullanımı

Field resolver'lar zaten DataLoader kullanıyor:

```typescript
solarSystem: async (parent, _, context) => {
  return context.loaders.solarSystem.load(parent.solarSystemId);
}
```

**N+1 Problem Önlendi**:

- 25 killmail için 25 ayrı DB query yerine
- Tek batch query ile tüm ilgili veriler çekiliyor

## 📈 Beklenen Performans Kazançları

### Senaryo 1: Aynı Query Tekrar Çağrılırsa

- **Önceki**: Her seferinde DB query (200-500ms)
- **Şimdi**: Redis cache'den dönüş (5-20ms)
- **Kazanç**: ~10-100x daha hızlı

### Senaryo 2: Farklı Kullanıcılar Aynı Sayfayı Görüntülerse

- **Önceki**: Her kullanıcı için DB query
- **Şimdi**: Public cache paylaşımı
- **Kazanç**: Database yükü azaldı

### Senaryo 3: Complex Relations (25 killmail)

- **Önceki**: 25 killmail + her biri için ayrı character/corp/alliance queries = 100+ query
- **Şimdi**: 1 killmail query + 3-4 batch query (DataLoader) = ~5 query
- **Kazanç**: ~20x daha az DB query

## 🎯 Ek Öneriler

### Database Index'leri Kontrol Edin

Aşağıdaki index'lerin olduğundan emin olun:

```sql
-- Killmails filtreleme için
CREATE INDEX IF NOT EXISTS idx_killmails_time ON killmails(killmail_time DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_solar_system ON killmails(solar_system_id);

-- Victim search için
CREATE INDEX IF NOT EXISTS idx_victim_character ON victims(character_id);
CREATE INDEX IF NOT EXISTS idx_victim_corporation ON victims(corporation_id);
CREATE INDEX IF NOT EXISTS idx_victim_alliance ON victims(alliance_id);

-- Attacker search için
CREATE INDEX IF NOT EXISTS idx_attackers_character ON attackers(character_id);
CREATE INDEX IF NOT EXISTS idx_attackers_corporation ON attackers(corporation_id);
CREATE INDEX IF NOT EXISTS idx_attackers_killmail ON attackers(killmail_id);

-- SolarSystem relations
CREATE INDEX IF NOT EXISTS idx_solar_system_constellation ON solar_systems(constellation_id);
```

### Frontend Optimizasyonları

#### Apollo Client Cache Policy

```typescript
// frontend/src/lib/apolloClient.ts
const client = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          killmails: {
            keyArgs: ['filter'], // Filter değişince yeni cache
            merge(existing, incoming) {
              // Pagination için merge logic
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

Eğer 100+ killmail gösteriyorsanız:

```bash
cd frontend
yarn add react-window
```

### GraphQL Query Fragments Kullanın

Tekrarlanan field'ları fragment ile yönetin:

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

## 🧪 Test Etme

### 1. Redis Cache Kontrolü

```bash
# Redis'e bağlan
redis-cli

# Cache key'leri gör
KEYS *Killmails*

# Bir key'in TTL'ini kontrol et
TTL public:{hash}
```

### 2. GraphQL Performance Monitoring

```bash
cd backend
yarn add @graphql-yoga/plugin-response-time

# server.ts'e ekle:
import { useResponseTime } from '@graphql-yoga/plugin-response-time'
```

### 3. Database Query Monitoring

```typescript
// Prisma query logging
// backend/src/services/prisma.ts
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})
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
# Backend'de
yarn prisma:studio
# Settings > Connection info
```

## 🎨 Frontend Cache Stratejisi

Apollo Client zaten otomatik cache yapıyor, ama manuel kontrole ihtiyacınız varsa:

```typescript
// Refetch policy
const { data } = useKillmailsQuery({
  fetchPolicy: 'cache-first', // Önce cache'e bak
  nextFetchPolicy: 'cache-first', // Sonraki requestler için de
});
```

## ⚠️ Dikkat Edilmesi Gerekenler

1. **Cache Invalidation**: Yeni killmail eklendiğinde cache'i temizleyin

   ```typescript
   await redisCache.del('public:*Killmails*');
   ```

2. **Memory Limits**: Redis 256MB limit var (DigitalOcean), büyük query'leri dikkatli cache'leyin

3. **Rate Limiting**: ESI API rate limit'i (50 req/sec) hala geçerli, worker'lar için önemli

## 🔗 İlgili Dosyalar

- Backend Cache: `backend/src/server.ts`
- Resolver: `backend/src/resolvers/killmail.resolver.ts`
- DataLoaders: `backend/src/services/dataloaders.ts`
- Cache Strategy Doc: `backend/CACHE_STRATEGY.md`
