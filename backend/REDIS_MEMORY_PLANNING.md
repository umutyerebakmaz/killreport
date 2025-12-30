# Redis Memory Planning for KillReport

## 📊 Memory Usage Analysis

### Cache Data Size Estimates

#### Alliance List (Main Page)

- **Query**: `alliances(page: 1, limit: 25)` with metrics
- **Response Size**: ~150-200 KB per page
- **Total Pages**: 146 (3,639 alliances / 25)
- **If all pages cached**: 146 × 175 KB = **~25 MB**

#### Corporation List

- **Query**: `corporations(page: 1, limit: 25)` with details
- **Response Size**: ~100-150 KB per page
- **Total corporations**: ~15,000
- **Total pages**: 600
- **If 100 popular pages cached**: 100 × 125 KB = **~12 MB**

#### Character Queries

- **Single character with killmails**: ~50-100 KB
- **Popular characters cached**: 1,000 characters × 75 KB = **~75 MB**

#### Killmail Details

- **Single killmail**: ~20-30 KB
- **Recent killmails cached**: 5,000 × 25 KB = **~125 MB**

### Worst-Case Scenario (Peak Load)

| Item               | Count | Size Each | Total       |
| ------------------ | ----- | --------- | ----------- |
| Alliance pages     | 146   | 175 KB    | 25 MB       |
| Corporation pages  | 100   | 125 KB    | 12 MB       |
| Character profiles | 1,000 | 75 KB     | 75 MB       |
| Killmail details   | 5,000 | 25 KB     | 125 MB      |
| **TOTAL**          |       |           | **~237 MB** |

### With Overhead (Redis metadata, fragmentation)

**Actual Memory**: ~**300-400 MB** at peak

---

## 🎯 8GB Droplet Breakdown

### Original Plan (No Redis Cache Considered)

```
Total RAM: 8 GB
├── System (Ubuntu): ~500 MB
├── Node.js (Backend): ~300 MB
├── Node.js (Frontend): ~200 MB
├── PostgreSQL Client: ~100 MB
├── RabbitMQ: ~100 MB
├── Workers (4x): ~800 MB
└── Buffer: ~6 GB ✅
```

### Revised Plan (With Redis Cache)

```
Total RAM: 8 GB
├── System (Ubuntu): ~500 MB
├── Node.js (Backend): ~300 MB
├── Node.js (Frontend): ~200 MB
├── PostgreSQL Client: ~100 MB
├── RabbitMQ: ~200 MB
├── Redis Cache: ~400 MB (peak) 🆕
├── Workers (4x): ~800 MB
└── Buffer: ~4.5 GB ✅ (still safe)
```

---

## ⚙️ Redis Configuration

### Set Memory Limit

Create `/etc/redis/redis.conf` or append:

```conf
# Maximum memory Redis can use
maxmemory 512mb

# Eviction policy: remove least recently used keys when limit reached
maxmemory-policy allkeys-lru

# Save snapshots to disk (optional, for persistence)
save 900 1
save 300 10
save 60 10000
```

Apply config:

```bash
sudo systemctl restart redis-server
```

### Verify Configuration

```bash
redis-cli CONFIG GET maxmemory
redis-cli INFO memory
```

---

## 🔄 Cache Strategy

### TTL (Time To Live) Settings

| Query Type        | TTL       | Reason                            |
| ----------------- | --------- | --------------------------------- |
| Alliance list     | 60s       | Updates rarely, many users access |
| Corporation list  | 60s       | Same as alliances                 |
| Character profile | 60s       | Stats update frequently           |
| Killmail details  | 300s (5m) | Immutable once created            |
| Search results    | 30s       | Short-lived, user-specific        |

### Cache Warming Strategy

**DO NOT** pre-cache everything. Let cache build naturally:

1. First user hits `/alliances` → Cache miss → Store for 60s
2. Next 100 users hit `/alliances` → Cache hit → No DB query
3. After 60s expires → Next user refreshes cache
4. Repeat for other pages

**Result**: Only **actively used pages** consume memory.

---

## 📈 Monitoring Commands

### Check Current Usage

```bash
redis-cli INFO memory | grep used_memory_human
redis-cli INFO stats | grep keyspace_hits
redis-cli DBSIZE
```

### Check Hit/Miss Ratio

```bash
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"
```

Good ratio: **>80% hits** after cache warms up.

### Find Largest Keys

```bash
redis-cli --bigkeys
```

### Clear Cache (if needed)

```bash
redis-cli FLUSHALL
```

---

## 🚨 When to Scale

### Signs You Need Dedicated Redis

1. **Memory pressure**: Redis using >600 MB consistently
2. **Eviction rate**: Too many keys evicted (check `evicted_keys`)
3. **Cache hit rate**: Falls below 70%
4. **Concurrent users**: >50 active users

### Scaling Options

#### Option 1: Upgrade Droplet ($48 → $84/month)

- 8 vCPU, 16 GB RAM
- More headroom for cache
- Can run more workers

#### Option 2: Add Managed Redis ($15/month)

- Dedicated 256 MB Redis cluster
- Offloads cache from main droplet
- Professional monitoring

#### Option 3: Separate Worker Droplet ($69/month)

- Keep main droplet for API + Redis
- Worker droplet handles background jobs
- Better resource isolation

---

## ✅ Conclusion

### Current 8GB Plan: **STILL SAFE** ✅

- Redis cache adds **~400 MB** peak usage
- Still leaves **4.5 GB** buffer
- Comfortable for 20-30 concurrent users
- Room for growth

### Recommendations

1. **Implement Redis `maxmemory 512mb`** ✅
2. **Set eviction policy `allkeys-lru`** ✅
3. **Monitor with `redis-cli INFO memory`** ✅
4. **Set up alerts at 400 MB usage** 📊
5. **Plan to upgrade at 50+ concurrent users** 📈

### Was Redis Cache Considered in 8GB Plan?

**Honestly**: No, the initial 8GB calculation didn't explicitly account for Redis cache memory. However:

- ✅ The 6 GB buffer provides plenty of headroom
- ✅ 400 MB cache usage is manageable
- ✅ LRU eviction prevents memory issues
- ✅ No immediate need to change plan

**Risk Level**: **LOW** - We're still operating well within safe margins.
