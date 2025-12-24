# ESI User Killmail Sync System

## Overview

Bu sistem, **SSO ile login olmuş kullanıcıların killmail'lerini ESI API'den direkt olarak çekerek** veritabanına kaydeder. **zKillboard'a bağımlılığı yoktur** - tamamen bağımsız çalışır.

## Nasıl Çalışır?

```
1. User SSO ile login olur → Token database'e kaydedilir
2. Queue Script çalışır → Active user'ları queue'ya ekler
3. Worker consume eder → Her user için ESI'dan killmail çeker
4. Database'e kaydeder → GraphQL subscription tetiklenir
```

## Özellikler

- ✅ **ESI-only**: zKillboard'a bağımlılık yok
- ✅ **Token-based**: Kullanıcının kendi access token'ı kullanılır
- ✅ **Auto-refresh**: Expired token'lar otomatik olarak yenilenir
- ✅ **Token validation**: Sadece geçerli token'a sahip kullanıcılar queue'ya eklenir
- ✅ **Pagination**: 50 sayfaya kadar (2,500 killmail max, 50 per page)
- ✅ **Automatic enrichment**: Character/corp/alliance/type bilgileri otomatik
- ✅ **Real-time updates**: GraphQL subscription events
- ✅ **Duplicate handling**: Zaten var olan killmail'leri atlar
- ✅ **Rate limit safe**: ESI limitlerini respekt eder

## Kurulum ve Kullanım

### Development Ortamı

#### 1. Kullanıcıları Queue'ya Ekle

```bash
cd backend
yarn queue:user-killmails
```

Bu komut:

- Database'de expire olmamış token'a sahip tüm user'ları bulur
- Her user için `esi_user_killmails_queue` kuyruğuna mesaj ekler
- Worker'ın işlemeye hazır duruma getirir

**Output:**

```
📡 Queueing users for ESI killmail sync...

✓ Found 3 active user(s) with valid tokens
📤 Adding to queue: esi_user_killmails_queue

  ⏳ Queued: John Doe (ID: 95465499)
  ⏳ Queued: Jane Smith (ID: 123456789)
  ⏳ Queued: Bob Wilson (ID: 987654321)

✅ Successfully queued 3 user(s)!

💡 Now run the worker to process them:
   yarn worker:user-killmails
```

#### 2. Worker'ı Başlat

**Yeni terminal açın:**

```bash
cd backend
yarn worker:user-killmails
```

Worker şunları yapar:

- Queue'dan mesajları consume eder
- Her user için ESI API'den killmail listesini çeker
- Her killmail için detayları alır
- Database'e kaydeder (killmail, victim, attackers, items)
- GraphQL subscription event tetikler

**Output:**

```
🔄 ESI User Killmail Worker Started
📦 Queue: esi_user_killmails_queue
⚡ Prefetch: 3 concurrent users
🌐 Data Source: ESI API (direct, no zKillboard)

✅ Connected to RabbitMQ
⏳ Waiting for user killmail jobs...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: John Doe (ID: 95465499)
🆔 User ID: 1
📅 Queued at: 2025-12-24T10:30:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📡 [John Doe] Fetching killmails from ESI...
     📄 Page 1: 50 killmails
     📄 Page 2: 50 killmails
     📄 Page 3: 12 killmails
     ✓ Last page (12 < 50)
     ✅ Total: 112 killmails from ESI
  📥 Total killmails found: 112
  💾 Processing killmails...

     📊 Progress: 50/112 (Saved: 45, Skipped: 5, Errors: 0)
     📊 Progress: 100/112 (Saved: 92, Skipped: 8, Errors: 0)

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Saved: 100 new killmails
  ⏭️  Skipped: 12 (already in database)
  ❌ Errors: 0
  📊 Total processed: 112
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Completed: John Doe
```

### Production Ortamı (PM2)

#### Worker'ı Başlat

```bash
# Sadece user-killmails worker'ını başlat
pm2 start ecosystem.config.js --only worker-user-killmails

# Log'ları izle
pm2 logs worker-user-killmails

# Durumu kontrol et
pm2 status
```

#### Otomatik Queue (Cron Job)

Her 5 dakikada bir kullanıcıları otomatik queue'ya eklemek için:

```bash
# Crontab'ı düzenle
crontab -e

# Şu satırı ekle (her 5 dakikada bir çalışır)
*/5 * * * * cd /path/to/killreport/backend && yarn queue:user-killmails >> /var/log/queue-user-killmails.log 2>&1
```

**Alternatif: Daha seyrek güncellemeler**

```bash
# Her 15 dakikada bir
*/15 * * * * cd /path/to/killreport/backend && yarn queue:user-killmails

# Her saat başı
0 * * * * cd /path/to/killreport/backend && yarn queue:user-killmails

# Her gün sabah 9'da
0 9 * * * cd /path/to/killreport/backend && yarn queue:user-killmails
```

## Teknik Detaylar

### Queue Mesaj Formatı

```typescript
interface UserKillmailMessage {
  userId: number; // Database user ID
  characterId: number; // EVE character ID
  characterName: string; // Character name (for logging)
  accessToken: string; // ESI access token
  queuedAt: string; // ISO timestamp
}
```

### ESI Endpoint'ler

Worker şu endpoint'leri kullanır:

1. **Character Killmails** (Authenticated):

   ```
   GET /characters/{character_id}/killmails/recent/?page={page}
   Headers: Authorization: Bearer {access_token}
   Returns: Array of {killmail_id, killmail_hash}
   Rate: 50 killmails per page, max 50 pages = 2,500 total
   ```

2. **Killmail Details** (Public):
   ```
   GET /killmails/{killmail_id}/{killmail_hash}/
   No authentication needed
   Returns: Full killmail details (victim, attackers, items)
   ```

### Rate Limiting

- **ESI Limit**: 150 requests/second
- **Worker Delay**: 50ms between killmail fetches
- **Concurrent Users**: 3 (PREFETCH_COUNT)
- **Safe**: ~20 requests/second per worker instance

### Database Schema

Worker şu tabloları günceller:

```sql
killmail (killmail_id, killmail_hash, killmail_time, solar_system_id)
victim (killmail_id, character_id, corporation_id, alliance_id, ship_type_id, damage_taken)
attacker (killmail_id, character_id, damage_done, final_blow, ...)
killmail_item (killmail_id, item_type_id, quantity_dropped, quantity_destroyed)
```

## Karşılaştırma: ESI-only vs zKillboard

| Özellik                    | ESI User Killmails (Bu Sistem)    | zKillboard Worker        |
| -------------------------- | --------------------------------- | ------------------------ |
| **Veri Kaynağı**           | ESI API (direkt)                  | zKillboard → ESI         |
| **Authentication**         | ✅ SSO Token gerekli              | ❌ Public API            |
| **Killmail Limiti**        | 2,500 (50 page × 50)              | Unlimited (full history) |
| **Scope Gereksinimi**      | `esi-killmails.read_killmails.v1` | Yok                      |
| **Rate Limit**             | ESI: 150 req/sec                  | zKillboard: 10s delay    |
| **Hedef Kitle**            | Kendi user'larımız                | Herhangi bir character   |
| **Real-time**              | ❌ (polling gerekli)              | ✅ (RedisQ stream)       |
| **zKillboard Bağımlılığı** | ❌ Yok                            | ✅ Var                   |

## Troubleshooting

### Problem: "No active users found"

**Sebep**: Database'de geçerli token'a sahip user yok.

**Çözüm**: User'ların SSO ile login olması gerekiyor. Frontend'de login flow'u kontrol edin.

### Problem: "Failed to fetch killmails: 403"

**Sebep**: Token expired veya scope yetersiz.

**Çözüm (Otomatik)**:

- ✅ Worker otomatik olarak token'ı yeniler (refresh token kullanarak)
- ✅ Database'deki token otomatik güncellenir
- ⚠️ Eğer refresh token de geçersizse, user'ın tekrar login olması gerekir

**Manuel Kontrol**:

- SSO scope'unda `esi-killmails.read_killmails.v1` olduğundan emin olun
- Refresh token database'de kayıtlı olmalı

### Problem: Worker çok yavaş işliyor

**Sebep**: Rate limiting veya network latency.

**Çözüm**:

- `PREFETCH_COUNT` değerini artırın (dikkatli, ESI rate limit'e takılmayın)
- Delay'i azaltın (50ms → 25ms) ama ESI limit'i aşmayın

### Problem: Duplicate key errors (P2002)

**Normal**: Worker otomatik olarak handle ediyor. Zaten var olan killmail'leri skip ediyor.

## Monitoring

### Worker Status (GraphQL)

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

### PM2 Monitoring

```bash
# Genel durum
pm2 status

# Bellek kullanımı
pm2 monit

# Log'lar
pm2 logs worker-user-killmails --lines 100

# Restart
pm2 restart worker-user-killmails
```

### Database Queries

```sql
-- Son eklenen killmail'ler
SELECT k.killmail_id, k.killmail_time, c.name as victim_name
FROM killmail k
JOIN victim v ON k.killmail_id = v.killmail_id
JOIN character c ON v.character_id = c.character_id
ORDER BY k.killmail_time DESC
LIMIT 10;

-- User başına killmail sayısı
SELECT u.character_name, COUNT(DISTINCT k.killmail_id) as killmail_count
FROM "user" u
LEFT JOIN victim v ON u.character_id = v.character_id
LEFT JOIN killmail k ON v.killmail_id = k.killmail_id
GROUP BY u.character_name
ORDER BY killmail_count DESC;
```

## Gelecek İyileştirmeler

- [ ] **Incremental sync**: Sadece yeni killmail'leri çek (son sync timestamp'ten sonra)
- [ ] **Priority queue**: VIP user'ları önce işle
- [ ] **Webhook notifications**: Killmail kaydedildiğinde Discord/Slack bildirimi
- [ ] **Metrics dashboard**: Queue size, processing speed, error rate
- [ ] **Auto-retry**: Failed killmail'leri otomatik tekrar dene
- [ ] **Batch processing**: Birden fazla killmail'i tek transaction'da kaydet

## İlgili Dosyalar

- Queue Script: [`backend/src/queues/queue-user-esi-killmails.ts`](../src/queues/queue-user-esi-killmails.ts)
- Worker: [`backend/src/workers/worker-esi-user-killmails.ts`](../src/workers/worker-esi-user-killmails.ts)
- Character Service: [`backend/src/services/character/character.service.ts`](../src/services/character/character.service.ts)
- Killmail Service: [`backend/src/services/killmail/killmail.service.ts`](../src/services/killmail/killmail.service.ts)
- PM2 Config: [`ecosystem.config.js`](../../ecosystem.config.js)

## Lisans

Bu proje MIT lisansı altındadır.
