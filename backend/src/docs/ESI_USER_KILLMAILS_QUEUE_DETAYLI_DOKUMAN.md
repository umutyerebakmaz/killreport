# 📦 `esi_user_killmails_queue` - Detaylı Dokümantasyon

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [İş Akışı (Workflow)](#iş-akışı-workflow)
3. [Dosya Yapısı ve Görevleri](#dosya-yapısı-ve-görevleri)
4. [Queue Mesaj Formatı](#queue-mesaj-formatı)
5. [Çalışma Senaryoları](#çalışma-senaryoları)
6. [Performans ve Rate Limiting](#performans-ve-rate-limiting)
7. [Monitoring ve Kontrol](#monitoring-ve-kontrol)
8. [Troubleshooting](#troubleshooting)
9. [Komut Referansı](#komut-referansı)

---

## Genel Bakış

### Amaç

`esi_user_killmails_queue`, **SSO ile login olmuş kullanıcıların killmail'lerini otomatik olarak senkronize eden** bir RabbitMQ kuyruğudur.

### Temel Özellikler

- ✅ **ESI-only**: zKillboard'a bağımlılık YOK
- ✅ **Token-based**: Kullanıcının kendi access token'ı ile çalışır
- ✅ **Otomatik**: 10 dakikalık cron job ile arka planda çalışır
- ✅ **Incremental Sync**: Sadece yeni killmail'leri fetch eder (50x daha hızlı)
- ✅ **Öncelikli Mesajlar**: Login sonrası yüksek öncelik (8), arka plan düşük öncelik (3)
- ✅ **Auto Token Refresh**: Expired token'lar otomatik yenilenir
- ✅ **Real-time Events**: GraphQL subscription ile canlı bildirimler

### Veri Akışı

```
┌─────────────────┐
│  User Login     │
│  (SSO)          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐         ┌──────────────────┐
│  Auth Resolver  │────────>│  esi_user_       │
│  (High Priority)│         │  killmails_queue │
└─────────────────┘         └────────┬─────────┘
                                     │
┌─────────────────┐                  │
│  Cron Service   │                  │
│  (Every 10min)  │──────────────────┤
│  (Low Priority) │                  │
└─────────────────┘                  │
                                     │
┌─────────────────┐                  │
│  Manual Queue   │                  │
│  Script         │──────────────────┘
└─────────────────┘
                                     │
                                     ▼
                            ┌────────────────┐
                            │  Worker        │
                            │  (Consumer)    │
                            └────────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
            ┌───────────┐    ┌───────────┐   ┌──────────┐
            │  ESI API  │    │ Database  │   │ GraphQL  │
            │  (Fetch)  │    │  (Save)   │   │  Events  │
            └───────────┘    └───────────┘   └──────────┘
```

---

## İş Akışı (Workflow)

### 1️⃣ Mesaj Queue'ya Nasıl Eklenir?

#### A) **Login Sonrası (Otomatik - Yüksek Öncelik)**

**Dosya:** `backend/src/resolvers/auth.resolver.ts`

**Tetiklenme:** User SSO ile login olduğunda

**İşlem:**

```typescript
// Login mutation içinde
authenticateWithCode: async (_parent, { code, state }) => {
  // 1. Token al
  const tokenData = await exchangeCodeForToken(code);

  // 2. User'ı database'e kaydet/güncelle
  const user = await prisma.user.upsert({...});

  // 3. Queue'ya ekle (15 dakika içinde sync olmamışsa)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const shouldQueue = !user.last_killmail_sync_at ||
                      user.last_killmail_sync_at < fifteenMinutesAgo;

  if (shouldQueue) {
    channel.sendToQueue('esi_user_killmails_queue', message, {
      priority: 8, // 🔥 Yüksek öncelik
    });
  }
}
```

**Öncelik:** `8/10` (Yüksek - Login yapan user hemen sonuç görmeli)

**Kontrol:** Son 15 dakika içinde sync edildiyse skip

---

#### B) **Cron Job (Otomatik - Arka Plan - Düşük Öncelik)**

**Dosya:** `backend/src/services/user-killmail-cron.ts`

**Tetiklenme:**

- Server başladığında otomatik başlar
- Her **10 dakikada bir** çalışır
- `server.ts` içinde: `userKillmailCron.start()`

**İşlem:**

```typescript
class UserKillmailCron {
  async syncUsers() {
    // 1. Geçerli token'a sahip user'ları bul
    // 2. Son 15 dakika içinde sync edilmemiş olanları filtrele
    const users = await prisma.user.findMany({
      where: {
        expires_at: { gt: fiveMinutesFromNow },
        refresh_token: { not: null },
        OR: [
          { last_killmail_sync_at: null },
          { last_killmail_sync_at: { lt: fifteenMinutesAgo } },
        ],
      },
    });

    // 3. Her user için queue'ya ekle
    for (const user of users) {
      channel.sendToQueue("esi_user_killmails_queue", message, {
        priority: 3, // 🔵 Düşük öncelik (arka plan)
      });
    }
  }
}
```

**Öncelik:** `3/10` (Düşük - Arka plan sync'i)

**Kontrol:**

- Token geçerli olmalı (expires_at > now + 5 min)
- Refresh token olmalı (otomatik yenileme için)
- Son 15 dakika içinde sync edilmemeli

**Console Output:**

```
──────────────────────────────────────────────────────────────────────
🕐 [06.01.2026 14:30:00] Running background sync...
──────────────────────────────────────────────────────────────────────
   📊 Found 3 user(s) to sync
   ⏳ John Doe (last: 20m ago)
   ⏳ Jane Smith (never)
   ⏳ Bob Wilson (last: 45m ago)

   ✅ Queued 3 user(s) in 125ms
──────────────────────────────────────────────────────────────────────
```

---

#### C) **Manuel Script (İsteğe Bağlı)**

**Dosya:** `backend/src/queues/queue-user-esi-killmails.ts`

**Komut:**

```bash
cd backend

# Normal (son 15 dk sync edilmemiş user'lar)
yarn queue:user-killmails

# Hepsini zorla queue'ya ekle
yarn queue:user-killmails --force

# Full sync (incremental optimizasyon YOK)
yarn queue:user-killmails --full

# Her ikisi birden
yarn queue:user-killmails --force --full
```

**Parametreler:**

- `--force`: Son sync zamanını görmezden gel, herkesi queue'ya ekle
- `--full`: Incremental sync'i devre dışı bırak (tüm killmail'leri baştan fetch et)

**Console Output:**

```
📡 Queueing users for ESI killmail sync...

✓ Found 5 active user(s) with valid tokens
📤 Adding to queue: esi_user_killmails_queue

  ⏳ Queued: John Doe (ID: 95465499) [INCREMENTAL]
  ⏳ Queued: Jane Smith (ID: 12345678) [FIRST SYNC]
  ⏳ Queued: Bob Wilson (ID: 98765432) [FULL SYNC]

✅ Successfully queued 5 user(s)!

💡 Now run the worker to process them:
   yarn worker:user-killmails
```

---

### 2️⃣ Mesaj Nasıl İşlenir? (Worker)

**Dosya:** `backend/src/workers/worker-esi-user-killmails.ts`

**Başlatma:**

```bash
cd backend
yarn worker:user-killmails
```

**İşlem Adımları:**

```typescript
async function esiUserKillmailWorker() {
  // 1. RabbitMQ'ya bağlan
  const channel = await getRabbitMQChannel();

  // 2. Queue'yu assert et (yoksa oluştur)
  await channel.assertQueue("esi_user_killmails_queue", {
    durable: true,
    arguments: { "x-max-priority": 10 },
  });

  // 3. Prefetch ayarla (aynı anda kaç mesaj işlensin)
  channel.prefetch(1); // Bir user aynı anda

  // 4. Mesajları consume et
  channel.consume("esi_user_killmails_queue", async (msg) => {
    const message = JSON.parse(msg.content.toString());

    // 5. User'ın killmail'lerini fetch et
    await syncUserKillmailsFromESI(message);

    // 6. Mesajı ACK (onaylı)
    channel.ack(msg);
  });
}
```

**Worker Süreci:**

```
1. Message Received
   ↓
2. Token Check (expired mi?)
   ├─ Yes → Refresh token
   └─ No  → Continue
   ↓
3. Fetch Killmail List from ESI
   • Incremental sync varsa: stopAtKillmailId kullan
   • 50 sayfa max (2500 killmail)
   • ESI döner: [{killmail_id, killmail_hash}, ...]
   ↓
4. Process in Batches (3'er killmail)
   ├─ Batch 1: [km1, km2, km3]
   │   ├─ Fetch details from ESI
   │   ├─ Save to database (killmail, victim, attackers, items)
   │   ├─ Publish GraphQL event
   │   └─ 150ms delay (rate limit)
   ├─ 500ms delay between batches
   ├─ Batch 2: [km4, km5, km6]
   └─ ...
   ↓
5. Update User Metadata
   • last_killmail_sync_at = NOW
   • last_killmail_id = highest_killmail_id
   ↓
6. ACK Message (RabbitMQ'dan sil)
```

**Console Output:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Processing: John Doe (ID: 95465499)
🆔 User ID: 1
📅 Queued at: 2026-01-06T14:30:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📡 [John Doe] Fetching NEW killmails from ESI (incremental sync)...
     🔍 Will stop at killmail ID: 123456789
     📄 Max pages: 50 (will stop earlier if found)

     📄 Page 1: 50 killmails
     ✅ Incremental sync: Found last synced killmail (ID: 123456789)
     ⏭️  Stopping at page 1 - fetched 3 new killmails from this page
     📊 Total new killmails: 3

  ⏸️  Waiting 1000ms before processing killmails...

  💾 Processing killmails in batches of 3 (500ms delay)...

     📦 Batch 1/1: Processing 3 killmails...
        ✅ Saved: 125467890 (Rifter killed in Jita)
        ✅ Saved: 125467891 (Tristan destroyed)
        ✅ Saved: 125467892 (Atron lost)

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Saved: 3 new killmails
  ⏭️  Skipped: 0 (already in database)
  ❌ Errors: 0
  📊 Total processed: 3
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  💾 Updated last sync info (latest killmail ID: 125467892)

✅ Completed: John Doe
```

---

## Dosya Yapısı ve Görevleri

### 1️⃣ Queue Scripts (Mesaj Gönderme)

| Dosya                                | Görev               | Komut                       | Öncelik    |
| ------------------------------------ | ------------------- | --------------------------- | ---------- |
| `queues/queue-user-esi-killmails.ts` | Manuel queue script | `yarn queue:user-killmails` | 5 (Medium) |

**Sorumluluklar:**

- Database'den user'ları bul
- Token geçerliliğini kontrol et
- Queue mesajı oluştur
- RabbitMQ'ya gönder

---

### 2️⃣ Worker (Mesaj İşleme)

| Dosya                                  | Görev          | Komut                        |
| -------------------------------------- | -------------- | ---------------------------- |
| `workers/worker-esi-user-killmails.ts` | Queue consumer | `yarn worker:user-killmails` |

**Sorumluluklar:**

- Queue'dan mesaj al
- Token'ı kontrol et / yenile
- ESI'dan killmail'leri fetch et
- Database'e kaydet
- GraphQL event yayınla
- User metadata güncelle

**Rate Limiting:**

- `PREFETCH_COUNT: 1` (Bir user aynı anda)
- `BATCH_SIZE: 3` (3'er killmail işle)
- `BATCH_DELAY_MS: 500` (Batch'ler arası 500ms)
- `PAGE_FETCH_DELAY_MS: 1000` (Sayfa fetch sonrası 1s)
- `KILLMAIL_DETAIL_DELAY_MS: 150` (Her killmail detayı sonrası 150ms)

---

### 3️⃣ Cron Service (Otomatik Çalıştırma)

| Dosya                            | Görev          | Başlatma                      |
| -------------------------------- | -------------- | ----------------------------- |
| `services/user-killmail-cron.ts` | Arka plan sync | Server başlangıcında otomatik |

**Sorumluluklar:**

- Her 10 dakikada bir çalış
- Sync gereken user'ları bul
- Queue'ya düşük öncelikle ekle
- Concurrent run'ları engelle

**Entegrasyon:**

```typescript
// backend/src/server.ts
import { userKillmailCron } from "./services/user-killmail-cron";

server.listen(port, () => {
  // ...
  userKillmailCron.start(); // 🔥 Otomatik başlat
});
```

---

### 4️⃣ Auth Resolver (Login Sonrası Queue)

| Dosya                        | Görev               | Tetiklenme                |
| ---------------------------- | ------------------- | ------------------------- |
| `resolvers/auth.resolver.ts` | Login sonrası queue | User SSO login yaptığında |

**Sorumluluklar:**

- User login olduğunda
- Son 15 dk sync olmamışsa
- User'ı queue'ya ekle (yüksek öncelik)

**Kod:**

```typescript
// auth.resolver.ts - authenticateWithCode mutation
if (shouldQueueChar) {
  channel.sendToQueue("esi_user_killmails_queue", charMessage, {
    priority: 8, // 🔥 Yüksek öncelik
  });
}
```

---

### 5️⃣ Helper Services

| Dosya                                     | Görev                                      |
| ----------------------------------------- | ------------------------------------------ |
| `services/character/character.service.ts` | ESI API çağrıları                          |
| `services/rabbitmq.ts`                    | RabbitMQ bağlantı yönetimi                 |
| `services/prisma-worker.ts`               | Database connection pool (worker'lar için) |
| `services/eve-sso.ts`                     | Token yenileme (refresh)                   |
| `services/logger.ts`                      | Winston logger                             |

---

### 6️⃣ Monitoring Scripts

| Dosya                  | Görev                     | Komut                      |
| ---------------------- | ------------------------- | -------------------------- |
| `redis/check-queue.ts` | Queue durumunu kontrol et | `tsx redis/check-queue.ts` |

---

## Queue Mesaj Formatı

### TypeScript Interface

```typescript
interface UserKillmailMessage {
  userId: number; // Database user ID
  characterId: number; // EVE character ID
  characterName: string; // EVE character name
  accessToken: string; // ESI access token
  refreshToken: string; // ESI refresh token
  expiresAt: string; // Token expiry (ISO timestamp)
  queuedAt: string; // Queue edilme zamanı (ISO timestamp)
  lastKillmailId?: number; // Son sync'teki killmail ID (incremental için)
}
```

### Örnek Mesaj

```json
{
  "userId": 1,
  "characterId": 95465499,
  "characterName": "John Doe",
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "dGhpc19pc19hX3JlZnJl...",
  "expiresAt": "2026-01-06T15:30:00.000Z",
  "queuedAt": "2026-01-06T14:30:00.000Z",
  "lastKillmailId": 123456789
}
```

### lastKillmailId Kullanımı

**Olmadığında:**

- İlk sync
- Full sync (--full flag)
- 50 sayfa max fetch (2500 killmail)

**Olduğunda:**

- Incremental sync
- ESI'dan çekerken bu ID görülünce DUR
- Çok daha hızlı (genellikle 1 sayfa yeterli)

---

## Çalışma Senaryoları

### Senaryo 1: İlk Login (First Time User)

```
1. User SSO ile login yapar
   ↓
2. Auth resolver çalışır:
   • User database'e kaydedilir
   • last_killmail_sync_at: NULL
   • last_killmail_id: NULL
   ↓
3. Queue'ya eklenir (priority: 8)
   • lastKillmailId: undefined (full sync)
   ↓
4. Worker işler:
   • 50 sayfa max fetch (2500 killmail)
   • Hepsini database'e kaydet
   • last_killmail_sync_at: NOW
   • last_killmail_id: 125467892 (en yüksek)
```

---

### Senaryo 2: Arka Plan Sync (10 Dakika Sonra)

```
1. Cron job çalışır (10 dakika sonra)
   ↓
2. User bulunur:
   • last_killmail_sync_at: 10 dakika önce
   • last_killmail_id: 125467892
   ↓
3. Queue'ya eklenir (priority: 3)
   • lastKillmailId: 125467892 (incremental)
   ↓
4. Worker işler:
   • ESI'dan fetch eder
   • Page 1'de killmail_id 125467892'yi bulur
   • DUR! (sadece 2 yeni killmail varmış)
   • 50 sayfa yerine 1 sayfa = 50x daha hızlı!
```

---

### Senaryo 3: Tekrar Login (15 Dakika İçinde)

```
1. User tekrar login yapar
   ↓
2. Auth resolver kontrol eder:
   • last_killmail_sync_at: 8 dakika önce
   • 15 dakikadan az!
   ↓
3. Queue'ya EKLENMEz
   • Console: "Skipped character queue (synced 8 minutes ago)"
   ↓
4. Gereksiz API call'lardan kaçınılır
```

---

### Senaryo 4: Manuel Full Sync

```
1. Admin komutu çalıştırır:
   yarn queue:user-killmails --force --full
   ↓
2. Script çalışır:
   • Son sync zamanı görmezden gelir (--force)
   • lastKillmailId gönderilmez (--full)
   ↓
3. Worker işler:
   • İlk sync gibi davranır
   • 50 sayfa max fetch
   • Tüm killmail'leri tekrar kontrol eder
```

---

## Performans ve Rate Limiting

### ESI API Limitleri

**EVE ESI:**

- **150 requests/second** (burst)
- Worker: **50 requests/second** (güvenli mod)

### Worker Konfigürasyonu

```typescript
const PREFETCH_COUNT = 1; // Aynı anda 1 user
const BATCH_SIZE = 3; // 3'er killmail işle
const BATCH_DELAY_MS = 500; // Batch'ler arası 500ms
const PAGE_FETCH_DELAY_MS = 1000; // Sayfa fetch sonrası 1s
const KILLMAIL_DETAIL_DELAY_MS = 150; // Her killmail sonrası 150ms
```

### Rate Limiter Service

**Dosya:** `services/rate-limiter.ts`

```typescript
export const esiRateLimiter = {
  execute: async (fn) => {
    // 20ms minimum delay (50 req/sec)
    await delay(20);
    return fn();
  },
};
```

### Hesaplama

**Full Sync (2500 killmail):**

- 2500 killmail / 3 (batch) = 834 batch
- Her batch: 3 x 150ms = 450ms
- Batch arası: 500ms
- **Toplam:** ~13 dakika

**Incremental Sync (3 killmail):**

- 1 batch (3 killmail)
- 3 x 150ms = 450ms
- **Toplam:** ~1 saniye

**50x daha hızlı!** 🚀

---

## Monitoring ve Kontrol

### 1️⃣ Queue Durumu Kontrol

```bash
cd backend
tsx redis/check-queue.ts
```

**Output:**

```
🔍 Checking RabbitMQ queue status...

📦 Queue: esi_user_killmails_queue
📊 Messages in queue: 5
👥 Consumers: 1
```

---

### 2️⃣ GraphQL Query (Worker Status)

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

**Response:**

```json
{
  "data": {
    "workerStatus": [
      {
        "queueName": "esi_user_killmails_queue",
        "messageCount": 5,
        "consumerCount": 1
      }
    ]
  }
}
```

---

### 3️⃣ PM2 Monitoring (Production)

```bash
# Worker durumu
pm2 status

# Log'ları izle
pm2 logs worker-user-killmails

# Bellek kullanımı
pm2 monit

# Restart
pm2 restart worker-user-killmails
```

---

### 4️⃣ RabbitMQ Management UI

**URL:** `http://localhost:15672` (eğer management plugin aktifse)

**Queue Bilgileri:**

- Message count
- Consumer count
- Message rate
- Priority dağılımı

---

### 5️⃣ Database Check

```sql
-- Son sync zamanlarını kontrol et
SELECT
  character_name,
  last_killmail_sync_at,
  last_killmail_id,
  expires_at
FROM users
ORDER BY last_killmail_sync_at DESC NULLS LAST;

-- Bugün kaç killmail kaydedilmiş
SELECT COUNT(*)
FROM killmails
WHERE created_at > CURRENT_DATE;
```

---

## Troubleshooting

### Problem 1: Queue Boş Ama Worker Çalışmıyor

**Semptomlar:**

```
📊 Messages in queue: 0
👥 Consumers: 0
```

**Çözüm:**

```bash
# Worker'ı başlat
yarn worker:user-killmails

# Veya PM2 ile
pm2 start ecosystem.config.js --only worker-user-killmails
```

---

### Problem 2: Queue Dolmuş, İşlenmiyor

**Semptomlar:**

```
📊 Messages in queue: 100
👥 Consumers: 0
```

**Sebepler:**

- Worker crash olmuş
- Worker hiç başlatılmamış

**Çözüm:**

```bash
# Worker log'larını kontrol et
pm2 logs worker-user-killmails --lines 50

# Restart
pm2 restart worker-user-killmails

# Eğer error varsa düzelt ve tekrar başlat
```

---

### Problem 3: "No active users found"

**Semptomlar:**

```
⚠️  Queue is empty. No users queued for killmail sync.
```

**Sebep:** Database'de geçerli token'lı user yok

**Çözüm:**

1. Frontend'de SSO login yap
2. Token'ların expire olmadığından emin ol
3. Database'i kontrol et:
   ```sql
   SELECT character_name, expires_at
   FROM users
   WHERE expires_at > NOW();
   ```

---

### Problem 4: "Failed to fetch killmails: 403"

**Sebep:** Token expired veya scope yetersiz

**Otomatik Çözüm:**

- Worker otomatik olarak token'ı yeniler
- Refresh token kullanılır
- Database güncellenir

**Manuel Kontrol:**

```typescript
// Scope kontrolü (backend/.env)
EVE_CLIENT_SCOPES = "esi-killmails.read_killmails.v1 ...";
```

---

### Problem 5: Worker Çok Yavaş

**Semptomlar:** 100 killmail 30 dakika sürüyor

**Sebepler:**

- Rate limiting çok agresif
- Network latency

**Çözüm:**

```typescript
// worker-esi-user-killmails.ts
const BATCH_SIZE = 5; // 3'ten 5'e çıkar
const BATCH_DELAY_MS = 300; // 500'den 300'e düşür
const KILLMAIL_DETAIL_DELAY_MS = 100; // 150'den 100'e düşür
```

**DİKKAT:** ESI rate limit'i aşma!

---

### Problem 6: Duplicate Key Errors (P2002)

**Normal:** Worker otomatik handle ediyor

**Log:**

```
⏭️  Skipped: 125467890 (already in database)
```

**Sebep:** Aynı killmail birden fazla kaynaktan gelebilir

**Aksiyon Gerekli mi?** Hayır, sistem tasarım gereği.

---

## Komut Referansı

### Development

```bash
# Server başlat (cron otomatik)
cd backend
yarn dev

# Worker başlat
yarn worker:user-killmails

# Manuel queue
yarn queue:user-killmails

# Full sync zorla
yarn queue:user-killmails --force --full

# Queue durumu
tsx redis/check-queue.ts
```

---

### Production

```bash
# Server başlat
pm2 start ecosystem.config.js

# Sadece user killmail worker
pm2 start ecosystem.config.js --only worker-user-killmails

# Log'ları izle
pm2 logs worker-user-killmails

# Restart
pm2 restart worker-user-killmails

# Stop
pm2 stop worker-user-killmails
```

---

### Cron Job (Otomatik Queue)

**Manuel Cron Ayarı (İsteğe Bağlı):**

```bash
# Crontab düzenle
crontab -e

# Her 10 dakikada bir (eğer cron service çalışmıyorsa)
*/10 * * * * cd /path/to/killreport/backend && yarn queue:user-killmails

# Log'larla birlikte
*/10 * * * * cd /path/to/killreport/backend && yarn queue:user-killmails >> /var/log/queue-user-killmails.log 2>&1
```

**NOT:** Server içindeki cron service zaten çalışıyorsa buna gerek YOK!

---

## Özet: Tüm Süreç Bir Arada

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESI USER KILLMAILS QUEUE                     │
│                  (esi_user_killmails_queue)                     │
└─────────────────────────────────────────────────────────────────┘

📥 QUEUE'YA EKLEME (3 YÖNTEM):

1. Login (Otomatik)
   • auth.resolver.ts
   • Priority: 8
   • Kontrol: 15 dk içinde sync olmamışsa

2. Cron (Otomatik - Her 10 dk)
   • user-killmail-cron.ts
   • Priority: 3
   • Kontrol: 15 dk içinde sync olmamışsa

3. Manuel
   • queue-user-esi-killmails.ts
   • yarn queue:user-killmails [--force] [--full]
   • Priority: 5

────────────────────────────────────────────────────────────────────

📤 QUEUE'DAN İŞLEME:

Worker: worker-esi-user-killmails.ts
Komut: yarn worker:user-killmails

İşlem:
  1. Mesaj al
  2. Token kontrol/yenile
  3. ESI'dan killmail listesi çek (incremental)
  4. Batch'lerle detay fetch (3'er)
  5. Database'e kaydet
  6. GraphQL event yayınla
  7. User metadata güncelle
  8. ACK (mesajı sil)

────────────────────────────────────────────────────────────────────

⚙️ PERFORMANS:

• Incremental sync: 50x daha hızlı
• Rate limiting: 50 req/sec (güvenli)
• Batch processing: 3 killmail/batch
• Delay: 500ms between batches

────────────────────────────────────────────────────────────────────

🔍 MONİTORİNG:

• tsx redis/check-queue.ts
• GraphQL: workerStatus query
• PM2: pm2 logs worker-user-killmails
• Database: last_killmail_sync_at

────────────────────────────────────────────────────────────────────

📊 SONUÇ:

✅ Otomatik: Cron her 10 dakikada çalışır
✅ Hızlı: Incremental sync ile 50x performans
✅ Güvenli: Rate limiting + retry logic
✅ Kontrol: Multiple monitoring yöntemleri
```

---

## Son Notlar

### 🎯 Kontrolü Elde Tutmak İçin

1. **Log'ları Takip Et:** `pm2 logs worker-user-killmails`
2. **Queue'yu İzle:** `tsx redis/check-queue.ts` veya GraphQL
3. **Database'i Kontrol Et:** `last_killmail_sync_at` alanları
4. **Cron'u Durdur:** Server'da `userKillmailCron.stop()`
5. **Manuel Queue:** `yarn queue:user-killmails` ile kendin ekle

### 🚀 İş Akışını Anlamak

- **Cron service çalışıyor mu?** Console output'a bak (server başlarken)
- **Worker çalışıyor mu?** `pm2 status` ile kontrol et
- **Queue dolmuş mu?** RabbitMQ management UI'a bak
- **User'lar sync oluyor mu?** Database'de `last_killmail_sync_at`'e bak

### 📚 İlgili Dokümantasyon

- [esi-user-killmail-sync.md](./esi-user-killmail-sync.md) - Genel kullanım
- [BACKGROUND_SYNC_INCREMENTAL.md](./BACKGROUND_SYNC_INCREMENTAL.md) - Cron + Incremental detayları
- [IMPROVEMENTS.md](./IMPROVEMENTS.md) - Genel backend iyileştirmeleri

---

**Son Güncelleme:** 6 Ocak 2026
**Versiyon:** 1.0.0
