# Redis PubSub Sorunu Çözümü

## Sorun
Yerel ortamda (localhost) çalışan Redis PubSub, production ortamında yeni killmail kaydedildiğinde killmails ekranında real-time görünmüyor.

## Kök Neden
`pubsub.ts` servisi Redis clientlarını oluştururken:
1. **Hata yöneticileri (error handlers) yoktu** - Bağlantı hataları sessiz kalıyordu
2. **Bağlantı doğrulaması yoktu** - Redis'in gerçekten bağlı olup olmadığını bilme yolu yoktu
3. **Retry mantığı yoktu** - Bağlantı hataları tekrar denenmiyordu
4. **Production'a özel yapılandırma yoktu** - Production Redis TLS/authentication gerektirebilir

## Yapılan Değişiklikler

### 1. `pubsub.ts` - Kapsamlı Hata Yönetimi
- ✅ Publish ve subscribe clientları için detaylı hata yöneticileri eklendi
- ✅ Bağlantı durumu logları (connect, ready, close, reconnecting)
- ✅ Başlangıçta otomatik health check (PING komutu)
- ✅ Loglarda şifre maskeleme (güvenlik)
- ✅ Redis başarısız olursa in-memory PubSub'a geçiş
- ✅ `isRedisConnected()` ve `getRedisStatus()` fonksiyonları

### 2. `/health/redis` Endpoint
Production'da Redis durumunu izlemek için:
```bash
curl http://localhost:4000/health/redis
```

Yanıt:
```json
{
  "enabled": true,
  "publishClient": "ready",
  "subscribeClient": "ready",
  "connected": true,
  "url": "redis://****@host:port"
}
```

### 3. Diagnostic Script
```bash
cd backend
yarn diagnose:redis
```

Bu script şunları test eder:
- Environment variable yapılandırması
- Redis bağlantısı (PING)
- PubSub publish/subscribe
- NEW_KILLMAIL kanalı

### 4. Kapsamlı Dokümantasyon
- **PRODUCTION_TROUBLESHOOTING.md** - Tam sorun giderme rehberi
- **QUICK_REFERENCE.md** - Hızlı referans
- **REDIS_SETUP.md** - Güncellenmiş setup rehberi

## Kullanım

### Production'da Sorun Tespiti

**1. Teşhis scriptini çalıştır:**
```bash
cd backend
yarn diagnose:redis
```

**2. Health endpoint'i kontrol et:**
```bash
curl https://domain.com/health/redis
```

**3. Server loglarını incele:**

✅ **Başarılı bağlantı:**
```
📡 PubSub: Initializing Redis (distributed mode)
✅ Redis Publish Client: Connected
✅ Redis Publish Client: Ready
✅ Redis Subscribe Client: Connected
✅ Redis Subscribe Client: Ready
✅ PubSub: Redis-based PubSub initialized successfully
✅ Redis Health Check: PING response: PONG
```

❌ **Başarısız bağlantı:**
```
❌ Redis Publish Client Error: connect ECONNREFUSED
❌ Redis Subscribe Client Error: getaddrinfo ENOTFOUND
❌ Redis Health Check Failed: Connection timeout
```

### Yaygın Production Sorunları

#### 1. TLS/SSL Gereksinimi
```bash
# ❌ Yanlış (TLS olmadan)
REDIS_URL=redis://my-redis.example.com:6379

# ✅ Doğru (TLS ile - 's' harfine dikkat)
REDIS_URL=rediss://my-redis.example.com:6379
```

#### 2. Authentication (Şifre)
```bash
# ❌ Yanlış (şifre eksik)
REDIS_URL=redis://my-redis.example.com:6379

# ✅ Doğru (şifre ile)
REDIS_URL=redis://:my-password@my-redis.example.com:6379
```

#### 3. Yanlış Port
```bash
# Her provider farklı port kullanabilir
# Azure Redis: 6380 (SSL)
# DigitalOcean: 25061
# AWS ElastiCache: 6379
```

#### 4. Environment Variable Ayarı
```bash
# ❌ Yanlış
USE_REDIS_PUBSUB=false

# ✅ Doğru
USE_REDIS_PUBSUB=true
```

### Provider-Specific Örnekler

**AWS ElastiCache:**
```bash
REDIS_URL=rediss://my-cluster.cache.amazonaws.com:6379
```

**Azure Cache for Redis:**
```bash
REDIS_URL=rediss://:access-key@name.redis.cache.windows.net:6380
```

**DigitalOcean Managed Redis:**
```bash
REDIS_URL=rediss://default:password@db-redis-nyc1-12345.db.ondigitalocean.com:25061
```

**Upstash Redis:**
```bash
REDIS_URL=rediss://:token@us1-central-12345.upstash.io:6379
```

## Sorun Giderme Adımları

1. **Environment variable'ları kontrol et:**
   ```bash
   echo $REDIS_URL
   echo $USE_REDIS_PUBSUB
   ```

2. **Redis bağlantısını test et:**
   ```bash
   redis-cli -u $REDIS_URL ping
   # Yanıt: PONG
   ```

3. **Diagnostic script'i çalıştır:**
   ```bash
   yarn diagnose:redis
   ```

4. **Health endpoint'i kontrol et:**
   ```bash
   curl https://domain.com/health/redis
   ```

5. **Server loglarını incele:**
   - Redis connection mesajlarını ara
   - Error mesajlarına dikkat et

## Test Etme

**GraphQL Playground'da subscription test:**

1. http://localhost:4000/graphql adresini aç
2. Şu subscription'ı çalıştır:
```graphql
subscription {
  newKillmail {
    id
    victim { character { name } }
  }
}
```

3. Başka bir terminalde worker'ı başlat:
```bash
yarn worker:redisq
```

4. Yeni killmail'lerin subscription'da göründüğünü gör

## Hızlı Kontrol Listesi

Production'da real-time güncellemeler çalışmıyorsa:

- [ ] `.env` dosyasında `USE_REDIS_PUBSUB=true` olduğunu doğrula
- [ ] `REDIS_URL` formatının doğru olduğunu kontrol et
- [ ] Redis bağlantısını test et: `redis-cli -u $REDIS_URL ping`
- [ ] Diagnostic çalıştır: `yarn diagnose:redis`
- [ ] `/health/redis` endpoint'ini kontrol et
- [ ] Server başlangıç loglarını Redis hataları için incele
- [ ] Worker'ların aynı `REDIS_URL`'i kullandığını doğrula
- [ ] Firewall/security group kurallarını kontrol et
- [ ] TLS/SSL ayarlarının provider gereksinimlerine uyduğunu doğrula
- [ ] `REDIS_URL` düzelttikten sonra server'ı restart et

## Destek

Sorunlar devam ederse:

1. `yarn diagnose:redis` çıktısını kaydet
2. `/health/redis` yanıtını kaydet
3. Server başlangıç loglarını topla
4. Redis provider'ını not et (AWS, Azure, etc.)
5. Log'lardan hata mesajlarını al

Bu bilgiler sorunu teşhis etmeye yardımcı olacaktır.

## Ek Kaynaklar

- [PRODUCTION_TROUBLESHOOTING.md](./PRODUCTION_TROUBLESHOOTING.md) - İngilizce detaylı rehber
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Hızlı referans kartı
- [REDIS_SETUP.md](./REDIS_SETUP.md) - Redis kurulum rehberi
