# Character Refresh - Maliyet ve Performans Analizi

## 📊 Maliyet Özeti

**TL;DR:** Character refresh tamamen **ÜCRETSİZ** ama **rate limit** yönetimi kritik!

## 💰 API Maliyetleri

### ESI API (EVE Online)

- **Ücret:** ÜCRETSİZ ✅
- **Rate Limit:** 150 isteksınır (yumuşak limit), 50 req/sec önerilir
- **Kısıtlama:** Global (tüm uygulama için), kullanıcı bazlı değil
- **Sonuç:** Maliyetsiz ama dikkatli kullanılmalı

### Database (PostgreSQL)

- **Ücret:** Sabit (DigitalOcean droplet)
- **İşlem:** Single row UPDATE (çok ucuz)
- **Etki:** Minimal

### RabbitMQ

- **Ücret:** Sabit (local/cloud instance)
- **İşlem:** Queue message
- **Etki:** Minimal

## 🚦 Rate Limiting Stratejisi

### Uygulama Seviyesi Rate Limit

```typescript
// Resolver'da implement edildi:
// 1. Character başına 5 dakika bekleme
await redis.setex(`refresh:character:${characterId}`, 300, "1");

// 2. Cache invalidation
await redis.del(`character:detail:${characterId}`);
```

**Koruma Mekanizmaları:**

1. **Character Başına:** 5 dakikada bir refresh
2. **Cache:** 30 dakika cache (gereksiz ESI çağrısını önler)
3. **Worker Concurrency:** 5 concurrent (global rate limit koruması)

### Örnek Senaryolar

#### ✅ Düşük Riskli Kullanım

```
100 kullanıcı/gün × 1 refresh/kullanıcı = 100 ESI call/gün
≈ 0.001 req/sec (ÇOOK DÜŞÜK)
```

#### ⚠️ Orta Riskli Kullanım

```
1000 kullanıcı/gün × 5 refresh/kullanıcı = 5000 ESI call/gün
≈ 0.06 req/sec (DÜŞÜK)
```

#### 🚨 Yüksek Riskli Kullanım

```
10000 aktif kullanıcı × 1 refresh/dakika = 10000 req/dakika
≈ 166 req/sec (ÇOOK YÜKSEK - ASO RATE LİMİT!)
```

## 🎯 Önerilen Kullanım Senaryoları

### 1. Login Sonrası Auto-Refresh ✅

```graphql
mutation {
  refreshCharacter(characterId: 379226154) {
    success
    message
    queued
  }
}
```

**Sıklık:** Kullanıcı login olduğunda (günde 1-3 kez)
**Risk:** ÇOK DÜŞÜK
**Maliyet:** $0

### 2. Manuel "Refresh" Butonu ✅

```tsx
const handleRefresh = async () => {
  const result = await refreshCharacter({
    variables: { characterId: user.characterId },
  });

  if (result.data.refreshCharacter.success) {
    // 5 dakika sonra tekrar enable et
    setTimeout(() => setCanRefresh(true), 300000);
  }
};
```

**Sıklık:** Kullanıcı isteğine bağlı (5 dk kısıtlamalı)
**Risk:** DÜŞÜK
**Maliyet:** $0

### 3. Otomatik Background Refresh ⚠️

```typescript
// YAPMAYIN! Rate limit tehlikesi
setInterval(() => {
  refreshCharacter({ characterId });
}, 60000); // Her dakika
```

**Sıklık:** Çok sık
**Risk:** YÜKSEK
**Önerilmez**

## 📈 Ölçeklendirme Stratejisi

### Küçük Ölçek (0-1000 kullanıcı)

- **Strateji:** Her login'de auto-refresh
- **Beklenen Load:** ~10-50 req/saat
- **Durum:** ✅ Sorunsuz

### Orta Ölçek (1000-10000 kullanıcı)

- **Strateji:** Login + manuel refresh (5 dk limit)
- **Beklenen Load:** ~100-500 req/saat
- **Durum:** ✅ Sorunsuz
- **Ek Önlem:** User başına günlük refresh limiti (10 refresh/gün)

### Büyük Ölçek (10000+ kullanıcı)

- **Strateji:** Aggressive caching + selective refresh
- **Beklenen Load:** 1000+ req/saat
- **Durum:** ⚠️ Dikkat gerekir
- **Önlemler:**

  ```typescript
  // 1. User başına günlük limit
  const dailyLimit = await redis.get(`daily:refresh:${userId}`);
  if (parseInt(dailyLimit || "0") >= 10) {
    return { success: false, message: "Daily limit reached" };
  }

  // 2. Global rate limit monitoring
  const globalRate = await redis.incr("global:refresh:count");
  await redis.expire("global:refresh:count", 60);
  if (globalRate > 50) {
    // 50/dakika
    return { success: false, message: "System busy, try again later" };
  }
  ```

## 🔒 Önerilen Güvenlik Önlemleri

### 1. Rate Limiting (Implement Edildi ✅)

```typescript
// Character başına: 5 dakika
await redis.setex(`refresh:character:${characterId}`, 300, "1");
```

### 2. User-Based Daily Limit (TODO)

```typescript
// User başına günlük 10 refresh
const dailyKey = `daily:refresh:${userId}:${today}`;
const count = await redis.incr(dailyKey);
await redis.expire(dailyKey, 86400);

if (count > 10) {
  return { success: false, message: "Daily limit (10) exceeded" };
}
```

### 3. Global Rate Monitoring (TODO)

```typescript
// Sistem geneli dakikalık izleme
const globalCount = await redis.incr("global:refresh:minute");
await redis.expire("global:refresh:minute", 60);

if (globalCount > 100) {
  // 100 refresh/dakika
  logger.warn("High refresh rate detected", { globalCount });
}
```

### 4. Auth Check (Önemli!)

```typescript
// Sadece login kullanıcılar refresh edebilsin
if (!context.user) {
  throw new Error("Authentication required");
}

// Sadece kendi character'ını refresh edebilsin
if (context.user.characterId !== characterId) {
  throw new Error("Unauthorized");
}
```

## 💡 Best Practices

### Frontend Tarafında

```tsx
function CharacterProfile({ characterId }) {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const canRefresh =
    !lastRefresh || Date.now() - lastRefresh.getTime() > 300000; // 5 dakika

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

### Backend Tarafında

```typescript
// Monitoring ekle
logger.info("Character refresh requested", {
  characterId,
  userId: context.user?.id,
  source: "graphql-mutation",
  timestamp: new Date().toISOString(),
});

// Metrics topla
await redis.hincrby("metrics:refresh", "total", 1);
await redis.hincrby("metrics:refresh", `user:${userId}`, 1);
```

## 📊 Monitoring ve Alerting

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

## 🎯 Sonuç

### Maliyet: $0 (ÜCRETSİZ) ✅

### Öneriler:

1. **Login'de auto-refresh:** ✅ Güvenli
2. **Manuel refresh butonu:** ✅ Güvenli (5 dk limit ile)
3. **Günlük kullanıcı limiti:** ✅ Önerilen (10 refresh/gün)
4. **Global monitoring:** ✅ Mutlaka implement et
5. **Auth check:** ✅ Güvenlik için zorunlu

### Ölçeklendirme:

- **0-1K users:** Hiç sorun yok
- **1K-10K users:** İlave limitler gerekebilir
- **10K+ users:** Aggressive caching + selective refresh

**Sonuç:** Kullanıcıların kendi bilgilerini güncellemeleri tamamen ücretsiz ve güvenli! Sadece rate limiting ve monitoring önemli.
