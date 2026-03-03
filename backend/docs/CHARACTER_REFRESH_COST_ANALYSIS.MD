# Character Refresh - Cost and Performance Analysis

## 📊 Cost Summary

**TL;DR:** Character refresh is completely **FREE** but **rate limit** management is critical!

## 💰 API Costs

### ESI API (EVE Online)

- **Cost:** FREE ✅
- **Rate Limit:** 150 requests per second (soft limit), 50 req/sec recommended
- **Restriction:** Global (for entire application), not user-based
- **Result:** No cost but must be used carefully

### Database (PostgreSQL)

- **Cost:** Fixed (DigitalOcean droplet)
- **Operation:** Single row UPDATE (very cheap)
- **Impact:** Minimal

### RabbitMQ

- **Cost:** Fixed (local/cloud instance)
- **Operation:** Queue message
- **Impact:** Minimal

## 🚦 Rate Limiting Strategy

### Application-Level Rate Limit

```typescript
// Implemented in resolver:
// 1. 5-minute wait per character
await redis.setex(`refresh:character:${characterId}`, 300, "1");

// 2. Cache invalidation
await redis.del(`character:detail:${characterId}`);
```

**Protection Mechanisms:**

1. **Per Character:** One refresh every 5 minutes
2. **Cache:** 30-minute cache (prevents unnecessary ESI calls)
3. **Worker Concurrency:** 5 concurrent (global rate limit protection)

### Example Scenarios

#### ✅ Low Risk Usage

```
100 users/day × 1 refresh/user = 100 ESI calls/day
≈ 0.001 req/sec (VERY LOW)
```

#### ⚠️ Medium Risk Usage

```
1000 users/day × 5 refresh/user = 5000 ESI calls/day
≈ 0.06 req/sec (LOW)
```

#### 🚨 High Risk Usage

```
10000 active users × 1 refresh/minute = 10000 req/minute
≈ 166 req/sec (VERY HIGH - EXCEEDS RATE LIMIT!)
```

## 🎯 Recommended Usage Scenarios

### 1. Auto-Refresh After Login ✅

```graphql
mutation {
  refreshCharacter(characterId: 379226154) {
    success
    message
    queued
  }
}
```

**Frequency:** When user logs in (1-3 times per day)
**Risk:** VERY LOW
**Cost:** $0

### 2. Manual "Refresh" Button ✅

```tsx
const handleRefresh = async () => {
  const result = await refreshCharacter({
    variables: { characterId: user.characterId },
  });

  if (result.data.refreshCharacter.success) {
    // Re-enable after 5 minutes
    setTimeout(() => setCanRefresh(true), 300000);
  }
};
```

**Frequency:** User-initiated (5-minute limited)
**Risk:** LOW
**Cost:** $0

### 3. Automatic Background Refresh ⚠️

```typescript
// DON'T DO THIS! Rate limit danger
setInterval(() => {
  refreshCharacter({ characterId });
}, 60000); // Every minute
```

**Frequency:** Very frequent
**Risk:** HIGH
**Not Recommended**

## 📈 Scaling Strategy

### Small Scale (0-1000 users)

- **Strategy:** Auto-refresh on every login
- **Expected Load:** ~10-50 req/hour
- **Status:** ✅ No issues

### Medium Scale (1000-10000 users)

- **Strategy:** Login + manual refresh (5-minute limit)
- **Expected Load:** ~100-500 req/hour
- **Status:** ✅ No issues
- **Additional Measure:** Daily refresh limit per user (10 refreshes/day)

### Large Scale (10000+ users)

- **Strategy:** Aggressive caching + selective refresh
- **Expected Load:** 1000+ req/hour
- **Status:** ⚠️ Attention required
- **Measures:**

  ```typescript
  // 1. Daily limit per user
  const dailyLimit = await redis.get(`daily:refresh:${userId}`);
  if (parseInt(dailyLimit || "0") >= 10) {
    return { success: false, message: "Daily limit reached" };
  }

  // 2. Global rate limit monitoring
  const globalRate = await redis.incr("global:refresh:count");
  await redis.expire("global:refresh:count", 60);
  if (globalRate > 50) {
    // 50/minute
    return { success: false, message: "System busy, try again later" };
  }
  ```

## 🔒 Recommended Security Measures

### 1. Rate Limiting (Implemented ✅)

```typescript
// Per character: 5 minutes
await redis.setex(`refresh:character:${characterId}`, 300, "1");
```

### 2. User-Based Daily Limit (TODO)

```typescript
// 10 refreshes per user per day
const dailyKey = `daily:refresh:${userId}:${today}`;
const count = await redis.incr(dailyKey);
await redis.expire(dailyKey, 86400);

if (count > 10) {
  return { success: false, message: "Daily limit (10) exceeded" };
}
```

### 3. Global Rate Monitoring (TODO)

```typescript
// System-wide per-minute monitoring
const globalCount = await redis.incr("global:refresh:minute");
await redis.expire("global:refresh:minute", 60);

if (globalCount > 100) {
  // 100 refresh/minute
  logger.warn("High refresh rate detected", { globalCount });
}
```

### 4. Auth Check (Important!)

```typescript
// Only logged-in users can refresh
if (!context.user) {
  throw new Error("Authentication required");
}

// Users can only refresh their own character
if (context.user.characterId !== characterId) {
  throw new Error("Unauthorized");
}
```

## 💡 Best Practices

### Frontend Side

```tsx
function CharacterProfile({ characterId }) {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const canRefresh =
    !lastRefresh || Date.now() - lastRefresh.getTime() > 300000; // 5 minutes

  const handleRefresh = async () => {
    if (!canRefresh) {
      toast.error("Please wait 5 minutes between refreshes");
      return;
    }

    const result = await refreshCharacter({
      variables: { characterId },
    });

    if (result.data.refreshCharacter.success) {
      setLastRefresh(new Date());
      toast.success("Character refresh queued!");
    }
  };

  return (
    <button onClick={handleRefresh} disabled={!canRefresh}>
      {canRefresh ? "Refresh" : `Wait ${getRemainingTime()}...`}
    </button>
  );
}
```

### Backend Side

```typescript
// Add monitoring
logger.info("Character refresh requested", {
  characterId,
  userId: context.user?.id,
  source: "graphql-mutation",
  timestamp: new Date().toISOString(),
});

// Collect metrics
await redis.hincrby("metrics:refresh", "total", 1);
await redis.hincrby("metrics:refresh", `user:${userId}`, 1);
```

## 📊 Monitoring and Alerting

### Metrics to Track

1. **Total refreshes/hour**
2. **Unique users refreshing/hour**
3. **Failed refreshes (rate limited)**
4. **ESI API response times**
5. **Queue depth**

### Alarm Thresholds

- **WARNING:** > 1000 refreshes/hour
- **CRITICAL:** > 5000 refreshes/hour
- **ESI Rate Limit Approached:** > 40 req/sec sustained

## 🎯 Conclusion

### Cost: $0 (FREE) ✅

### Recommendations:

1. **Auto-refresh on login:** ✅ Safe
2. **Manual refresh button:** ✅ Safe (with 5-minute limit)
3. **Daily user limit:** ✅ Recommended (10 refreshes/day)
4. **Global monitoring:** ✅ Must implement
5. **Auth check:** ✅ Required for security

### Scaling:

- **0-1K users:** No issues at all
- **1K-10K users:** Additional limits may be needed
- **10K+ users:** Aggressive caching + selective refresh

**Conclusion:** Users refreshing their own information is completely free and safe! Only rate limiting and monitoring are important.
