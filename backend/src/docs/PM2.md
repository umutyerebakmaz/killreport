# PM2 Process Management - KillReport

Bu dokümantasyon, KillReport projesinde PM2 ile yönetilen tüm servisleri, worker'ları ve zamanlanmış görevleri detaylı olarak açıklar.

## 📊 Genel Bakış

KillReport projesi **15 farklı PM2 process** kullanır:

- **2** Ana Servis (Backend + Frontend)
- **8** Sürekli Aktif Worker (7/24 çalışır)
- **5** Zamanlanmış Görev (Cron job)

---

## 🖥️ Ana Servisler (7/24 Aktif)

### 1. killreport-backend

```bash
pm2 start ecosystem.config.js --only killreport-backend
pm2 logs killreport-backend
pm2 restart killreport-backend
```

| Özellik                | Değer                                          |
| ---------------------- | ---------------------------------------------- |
| **Komut**              | `yarn start`                                   |
| **Port**               | 4000                                           |
| **Açıklama**           | GraphQL Yoga API server                        |
| **Memory Limit**       | 1 GB                                           |
| **Log**                | `/var/www/killreport/logs/backend-*.log`       |
| **Ortam Değişkenleri** | `NODE_ENV=production`, `USE_REDIS_PUBSUB=true` |

**Ne yapar:**

- GraphQL API endpoint'lerini sunar
- WebSocket subscriptions (real-time updates)
- Redis pub/sub ile worker'lardan event alır
- DataLoader ile N+1 problemini önler

---

### 2. killreport-frontend

```bash
pm2 start ecosystem.config.js --only killreport-frontend
pm2 logs killreport-frontend
pm2 restart killreport-frontend
```

| Özellik          | Değer                                     |
| ---------------- | ----------------------------------------- |
| **Komut**        | `yarn start`                              |
| **Port**         | 3000                                      |
| **Açıklama**     | Next.js 15 App Router frontend            |
| **Memory Limit** | 1 GB                                      |
| **Log**          | `/var/www/killreport/logs/frontend-*.log` |

**Ne yapar:**

- React tabanlı kullanıcı arayüzü
- Server-side rendering (SSR)
- Apollo Client ile GraphQL entegrasyonu
- EVE SSO authentication

---

## ⚙️ Sürekli Aktif Worker'lar (7/24 Çalışır)

Bu worker'lar RabbitMQ kuyruklarını sürekli dinler ve işlem yapar.

### 3. worker-redisq

```bash
pm2 start ecosystem.config.js --only worker-redisq
pm2 logs worker-redisq
```

| Özellik           | Değer                                          |
| ----------------- | ---------------------------------------------- |
| **Komut**         | `yarn worker:redisq`                           |
| **Açıklama**      | RedisQ stream - Real-time killmail ingestion   |
| **Memory Limit**  | 512 MB                                         |
| **Autorestart**   | ✅ Evet                                        |
| **Restart Delay** | 5 saniye                                       |
| **Log**           | `/var/www/killreport/logs/worker-redisq-*.log` |

**Ne yapar:**

- zKillboard RedisQ API'den canlı killmail akışını dinler
- Her yeni killmail'i database'e kaydeder
- Real-time enrichment için entity'leri kuyruğa ekler
- Redis pub/sub ile frontend'e bildirim gönderir

**Rate Limit:** 1 saniyede 1 request (zKillboard limiti)

---

### 4. worker-characters

```bash
pm2 start ecosystem.config.js --only worker-characters
pm2 logs worker-characters
```

| Özellik          | Değer                                              |
| ---------------- | -------------------------------------------------- |
| **Komut**        | `yarn worker:info:characters`                      |
| **Açıklama**     | Character bilgilerini ESI'dan çeker ve günceller   |
| **Kuyruk**       | `esi_character_info_queue`                         |
| **Concurrency**  | 10 (prefetch)                                      |
| **Memory Limit** | 512 MB                                             |
| **Log**          | `/var/www/killreport/logs/worker-characters-*.log` |

**Ne yapar:**

- Character ID'lerini kuyruktan alır
- ESI API'den character bilgilerini çeker
- Database'de UPSERT yapar (günceller veya ekler)
- Corporation_id, alliance_id gibi bilgileri günceller

**İşlenen Alanlar:** `name`, `corporation_id`, `alliance_id`, `birthday`, `security_status`, `title`

---

### 5. worker-corporations

```bash
pm2 start ecosystem.config.js --only worker-corporations
pm2 logs worker-corporations
```

| Özellik          | Değer                                                |
| ---------------- | ---------------------------------------------------- |
| **Komut**        | `yarn worker:info:corporations`                      |
| **Açıklama**     | Corporation bilgilerini ESI'dan çeker                |
| **Kuyruk**       | `esi_corporation_info_queue`                         |
| **Concurrency**  | 5 (prefetch)                                         |
| **Memory Limit** | 512 MB                                               |
| **Log**          | `/var/www/killreport/logs/worker-corporations-*.log` |

**Ne yapar:**

- Corporation ID'lerini kuyruktan alır
- ESI API'den corporation detaylarını çeker
- Database'de UPSERT yapar

**İşlenen Alanlar:** `name`, `ticker`, `member_count`, `ceo_id`, `alliance_id`, `tax_rate`

---

### 6. worker-alliances

```bash
pm2 start ecosystem.config.js --only worker-alliances
pm2 logs worker-alliances
```

| Özellik          | Değer                                             |
| ---------------- | ------------------------------------------------- |
| **Komut**        | `yarn worker:info:alliances`                      |
| **Açıklama**     | Alliance bilgilerini ESI'dan çeker                |
| **Kuyruk**       | `esi_alliance_info_queue`                         |
| **Concurrency**  | 3 (prefetch)                                      |
| **Memory Limit** | 512 MB                                            |
| **Log**          | `/var/www/killreport/logs/worker-alliances-*.log` |

**Ne yapar:**

- Alliance ID'lerini kuyruktan alır
- ESI API'den alliance detaylarını çeker
- Database'de UPSERT yapar

**İşlenen Alanlar:** `name`, `ticker`, `executor_corporation_id`, `faction_id`, `date_founded`

---

### 7. worker-alliance-corporations

```bash
pm2 start ecosystem.config.js --only worker-alliance-corporations
pm2 logs worker-alliance-corporations
```

| Özellik          | Değer                                                         |
| ---------------- | ------------------------------------------------------------- |
| **Komut**        | `yarn worker:alliance-corporations`                           |
| **Açıklama**     | Alliance'lara ait corporation'ları keşfeder                   |
| **Kuyruk**       | `esi_alliance_corporations_queue`                             |
| **Concurrency**  | 5 (prefetch)                                                  |
| **Memory Limit** | 512 MB                                                        |
| **Log**          | `/var/www/killreport/logs/worker-alliance-corporations-*.log` |

**Ne yapar:**

- Alliance ID'lerini kuyruktan alır
- ESI'dan o alliance'ın corporation listesini çeker
- Bulunan corporation ID'lerini `esi_corporation_info_queue`'ya ekler
- Corporation keşfi için kritik öneme sahip

**API Endpoint:** `GET /alliances/{alliance_id}/corporations/`

---

### 8. worker-types

```bash
pm2 start ecosystem.config.js --only worker-types
pm2 logs worker-types
```

| Özellik          | Değer                                         |
| ---------------- | --------------------------------------------- |
| **Komut**        | `yarn worker:info:types`                      |
| **Açıklama**     | Ship, module, item bilgilerini ESI'dan çeker  |
| **Kuyruk**       | `esi_type_info_queue`                         |
| **Concurrency**  | 10 (prefetch)                                 |
| **Memory Limit** | 512 MB                                        |
| **Log**          | `/var/www/killreport/logs/worker-types-*.log` |

**Ne yapar:**

- Type ID'lerini (ship, module, etc.) kuyruktan alır
- ESI API'den type detaylarını çeker
- Database'de UPSERT yapar

**İşlenen Alanlar:** `name`, `description`, `group_id`, `mass`, `volume`, `capacity`

---

### 9. worker-zkillboard

```bash
pm2 start ecosystem.config.js --only worker-zkillboard
pm2 logs worker-zkillboard
```

| Özellik          | Değer                                              |
| ---------------- | -------------------------------------------------- |
| **Komut**        | `yarn worker:zkillboard`                           |
| **Açıklama**     | zKillboard'dan character killmail sync             |
| **Kuyruk**       | `zkillboard_character_queue`                       |
| **Concurrency**  | 1 (prefetch)                                       |
| **Memory Limit** | 512 MB                                             |
| **Log**          | `/var/www/killreport/logs/worker-zkillboard-*.log` |

**Ne yapar:**

- Character ID'lerini kuyruktan alır
- zKillboard API'den killmail history çeker (pagination)
- Her killmail için ESI'dan detaylı bilgi alır
- Database'e kaydeder

**Rate Limit:** 10 saniye delay (aynı endpoint için)

---

### 10. worker-user-killmails

```bash
pm2 start ecosystem.config.js --only worker-user-killmails
pm2 logs worker-user-killmails
```

| Özellik           | Değer                                                  |
| ----------------- | ------------------------------------------------------ |
| **Komut**         | `yarn worker:user-killmails`                           |
| **Açıklama**      | Login olan user'ların killmail'lerini ESI'dan çeker    |
| **Kuyruk**        | `user_killmail_queue`                                  |
| **Concurrency**   | 1 (prefetch)                                           |
| **Memory Limit**  | 512 MB                                                 |
| **Restart Delay** | 5 saniye                                               |
| **Log**           | `/var/www/killreport/logs/worker-user-killmails-*.log` |

**Ne yapar:**

- User token ile ESI authenticated endpoint'ini kullanır
- Son 50 killmail'i çeker (max allowed)
- Incremental sync (sadece yeni killmail'leri ekler)
- `last_killmail_sync_at` timestamp'i günceller

**ESI Endpoint:** `GET /characters/{character_id}/killmails/recent/`

---

## ⏰ Zamanlanmış Görevler (PM2 Cron Mode)

Bu işler belirli saatlerde otomatik çalışır ve tamamlandığında kapanır.

### 11. queue-characters

```bash
pm2 start ecosystem.config.js --only queue-characters
pm2 trigger queue-characters  # Manuel tetikleme
pm2 logs queue-characters
```

| Özellik            | Değer                                             |
| ------------------ | ------------------------------------------------- |
| **Komut**          | `yarn queue:characters`                           |
| **Çalışma Zamanı** | Her ayın 1'i 00:00 UTC                            |
| **Cron**           | `0 0 1 * *`                                       |
| **Açıklama**       | Tüm character'ları queue'ya ekler (aylık)         |
| **Autorestart**    | ❌ Hayır (tek sefer)                              |
| **Log**            | `/var/www/killreport/logs/queue-characters-*.log` |

**Ne yapar:**

- Database'deki tüm character ID'lerini tarar (~93k)
- `esi_character_info_queue`'ya ekler
- `worker-characters` bunları işler
- Character bilgilerini güncel tutar

**Çalışma Mantığı:**

- Her ayın 1'inde 00:00 UTC'de çalışır
- Ay başında tüm character'ları günceller
- 93k character queue'ya ekleme işlemi tek seferde yapılır

---

### 12. queue-alliances

```bash
pm2 start ecosystem.config.js --only queue-alliances
pm2 trigger queue-alliances
pm2 logs queue-alliances
```

| Özellik            | Değer                                            |
| ------------------ | ------------------------------------------------ |
| **Komut**          | `yarn queue:alliances`                           |
| **Çalışma Zamanı** | Her pazar 00:00 UTC (haftalık)                   |
| **Cron**           | `0 0 * * 0`                                      |
| **Açıklama**       | Tüm alliance'ları ESI'dan çekip queue'ya ekler   |
| **Autorestart**    | ❌ Hayır (tek sefer)                             |
| **Log**            | `/var/www/killreport/logs/queue-alliances-*.log` |

**Ne yapar:**

- ESI'dan tüm alliance ID'lerini alır (~3,500)
- `esi_alliance_info_queue`'ya ekler
- `worker-alliances` bunları işler
- Alliance bilgilerini güncel tutar

**Çalışma Mantığı:**

- Her pazar 00:00'da başlar
- Alliance listesi haftalık güncellenir
- Yeni kurulan alliance'ları keşfeder

---

### 13. queue-alliance-corporations

```bash
pm2 start ecosystem.config.js --only queue-alliance-corporations
pm2 trigger queue-alliance-corporations
pm2 logs queue-alliance-corporations
```

| Özellik            | Değer                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Komut**          | `yarn queue:alliance-corporations`                              |
| **Çalışma Zamanı** | Her pazar 00:10 UTC (haftalık)                                  |
| **Cron**           | `10 0 * * 0`                                                    |
| **Açıklama**       | Alliance'ların corporation'larını keşfetmek için queue'ya ekler |
| **Autorestart**    | ❌ Hayır (tek sefer)                                            |
| **Log**            | `/var/www/killreport/logs/queue-alliance-corporations-*.log`    |

**Ne yapar:**

- Database'deki tüm alliance ID'lerini alır
- `esi_alliance_corporations_queue`'ya ekler
- `worker-alliance-corporations` her alliance için corporation listesini çeker
- Bulunan corporation'ları `esi_corporation_info_queue`'ya ekler

**Çalışma Mantığı:**

- queue-alliances'tan 10 dakika sonra başlar
- Alliance'lara ait corporation'ları keşfeder
- Corporation discovery için kritik

---

### 14. queue-character-corporations

```bash
pm2 start ecosystem.config.js --only queue-character-corporations
pm2 trigger queue-character-corporations
pm2 logs queue-character-corporations
```

| Özellik            | Değer                                                         |
| ------------------ | ------------------------------------------------------------- |
| **Komut**          | `yarn queue:character-corporations`                           |
| **Çalışma Zamanı** | Her gün 04:00 UTC                                             |
| **Cron**           | `0 4 * * *`                                                   |
| **Açıklama**       | Eksik corporation'ları tespit edip queue'ya ekler             |
| **Autorestart**    | ❌ Hayır                                                      |
| **Log**            | `/var/www/killreport/logs/queue-character-corporations-*.log` |

**Ne yapar:**

- Character'lardaki corporation_id'leri toplar (~24k benzersiz)
- Database'de olmayanları bulur
- `esi_corporation_info_queue`'ya ekler
- `worker-corporations` bunları işler

**Kullanım Senaryosu:** Yeni killmail'lerden gelen corporation'ları eklemek

---

### 15. snapshot-alliances

```bash
pm2 start ecosystem.config.js --only snapshot-alliances
pm2 trigger snapshot-alliances
pm2 logs snapshot-alliances
```

| Özellik            | Değer                                               |
| ------------------ | --------------------------------------------------- |
| **Komut**          | `yarn snapshot:alliances`                           |
| **Çalışma Zamanı** | Her gün 01:00 UTC                                   |
| **Cron**           | `0 1 * * *`                                         |
| **Açıklama**       | Alliance bilgilerinin günlük snapshot'ını alır      |
| **Autorestart**    | ❌ Hayır                                            |
| **Log**            | `/var/www/killreport/logs/snapshot-alliances-*.log` |

**Ne yapar:**

- Tüm alliance'ların güncel durumunu snapshot tablosuna kaydeder
- Historical data için kullanılır
- Member count, ticker değişikliklerini takip eder

**Snapshot Tablosu:** `alliance_snapshots`

---

### 16. snapshot-corporations

```bash
pm2 start ecosystem.config.js --only snapshot-corporations
pm2 trigger snapshot-corporations
pm2 logs snapshot-corporations
```

| Özellik            | Değer                                                  |
| ------------------ | ------------------------------------------------------ |
| **Komut**          | `yarn snapshot:corporations`                           |
| **Çalışma Zamanı** | Her gün 01:00 UTC                                      |
| **Cron**           | `0 1 * * *`                                            |
| **Açıklama**       | Corporation bilgilerinin günlük snapshot'ını alır      |
| **Autorestart**    | ❌ Hayır                                               |
| **Log**            | `/var/www/killreport/logs/snapshot-corporations-*.log` |

**Ne yapar:**

- Tüm corporation'ların güncel durumunu snapshot tablosuna kaydeder
- Member count, CEO, alliance değişikliklerini takip eder

**Snapshot Tablosu:** `corporation_snapshots`

---

### 17. update-alliance-counts

```bash
pm2 start ecosystem.config.js --only update-alliance-counts
pm2 trigger update-alliance-counts
pm2 logs update-alliance-counts
```

| Özellik            | Değer                                                   |
| ------------------ | ------------------------------------------------------- |
| **Komut**          | `yarn update:alliance-counts`                           |
| **Çalışma Zamanı** | Her gün 01:00 UTC                                       |
| **Cron**           | `0 1 * * *`                                             |
| **Açıklama**       | Alliance istatistiklerini günceller                     |
| **Autorestart**    | ❌ Hayır                                                |
| **Log**            | `/var/www/killreport/logs/update-alliance-counts-*.log` |

**Ne yapar:**

- Her alliance için killmail sayılarını hesaplar
- Cached statistics'leri günceller
- API performansı için kritik

---

## 📋 PM2 Komutları

### Tüm Servisleri Yönetme

```bash
# Tüm servisleri başlat
pm2 start ecosystem.config.js

# Tüm servisleri yeniden başlat (downtime ile)
pm2 restart all

# Tüm servisleri reload et (downtime olmadan)
pm2 reload all

# Tüm servisleri durdur
pm2 stop all

# Tüm servisleri sil
pm2 delete all

# Durumu görüntüle
pm2 list

# Detaylı bilgi
pm2 show killreport-backend

# Konfigürasyonu kaydet (reboot sonrası kalıcı)
pm2 save

# Startup script oluştur (otomatik başlama)
pm2 startup
```

### Tek Servis Yönetme

```bash
# Belirli bir servisi başlat
pm2 start ecosystem.config.js --only worker-redisq

# Yeniden başlat
pm2 restart worker-redisq

# Durdur
pm2 stop worker-redisq

# Sil
pm2 delete worker-redisq

# Cron job'ı manuel tetikle
pm2 trigger queue-characters
```

### Log Yönetimi

```bash
# Tüm logları canlı izle
pm2 logs

# Belirli bir servisin loglarını izle
pm2 logs worker-redisq

# Son 100 satırı göster
pm2 logs worker-redisq --lines 100

# Sadece hataları göster
pm2 logs --err

# Logları temizle
pm2 flush
```

### Monitoring

```bash
# Resource kullanımını izle (CPU, Memory)
pm2 monit

# JSON formatında durum
pm2 jlist

# Basit tablo görünümü
pm2 list

# PM2 Plus (Web dashboard - opsiyonel)
pm2 plus
```

---

## 📊 Servis Kategorileri - Özet Tablo

### Ana Servisler (2)

| PM2 Name              | Komut        | Port | Memory | Açıklama    |
| --------------------- | ------------ | ---- | ------ | ----------- |
| `killreport-backend`  | `yarn start` | 4000 | 1GB    | GraphQL API |
| `killreport-frontend` | `yarn start` | 3000 | 1GB    | Next.js UI  |

### Sürekli Aktif Worker'lar (8)

| PM2 Name                       | Komut                               | Kuyruk                            | Concurrency | Açıklama                     |
| ------------------------------ | ----------------------------------- | --------------------------------- | ----------- | ---------------------------- |
| `worker-redisq`                | `yarn worker:redisq`                | RedisQ Stream                     | 1           | Real-time killmail ingestion |
| `worker-characters`            | `yarn worker:info:characters`       | `esi_character_info_queue`        | 10          | Character info sync          |
| `worker-corporations`          | `yarn worker:info:corporations`     | `esi_corporation_info_queue`      | 5           | Corporation info sync        |
| `worker-alliances`             | `yarn worker:info:alliances`        | `esi_alliance_info_queue`         | 3           | Alliance info sync           |
| `worker-alliance-corporations` | `yarn worker:alliance-corporations` | `esi_alliance_corporations_queue` | 5           | Corp discovery               |
| `worker-types`                 | `yarn worker:info:types`            | `esi_type_info_queue`             | 10          | Item/ship info               |
| `worker-zkillboard`            | `yarn worker:zkillboard`            | `zkillboard_character_queue`      | 1           | zKillboard sync              |
| `worker-user-killmails`        | `yarn worker:user-killmails`        | `user_killmail_queue`             | 1           | User ESI sync                |

### Zamanlanmış Görevler (5)

| PM2 Name                       | Komut                               | Çalışma Zamanı     | Açıklama                               |
| ------------------------------ | ----------------------------------- | ------------------ | -------------------------------------- |
| `queue-characters`             | `yarn queue:characters`             | Ayın 1'i 00:00 UTC | Character'ları queue'ya ekle (aylık)   |
| `queue-alliances`              | `yarn queue:alliances`              | Pazar 00:00 UTC    | Alliance'ları queue'ya ekle (haftalık) |
| `queue-alliance-corporations`  | `yarn queue:alliance-corporations`  | Pazar 00:10 UTC    | Alliance corp'ları keşfet (haftalık)   |
| `queue-character-corporations` | `yarn queue:character-corporations` | Her gün 04:00 UTC  | Eksik corp'ları queue'ya ekle          |
| `snapshot-alliances`           | `yarn snapshot:alliances`           | Her gün 01:00 UTC  | Alliance snapshot                      |
| `snapshot-corporations`        | `yarn snapshot:corporations`        | Her gün 01:00 UTC  | Corporation snapshot                   |
| `update-alliance-counts`       | `yarn update:alliance-counts`       | Her gün 01:00 UTC  | Alliance statistics                    |

---

## 🔄 Günlük/Haftalık İş Akışı

### Pazar Günü (Haftalık)

```
00:00 UTC ─────▶ queue-alliances çalışır
                  └─▶ ~3,500 alliance ESI'dan çekilir
                       └─▶ esi_alliance_info_queue'ya eklenir
                            └─▶ worker-alliances işler

00:10 UTC ─────▶ queue-alliance-corporations çalışır
                  └─▶ Alliance'ların corporation listesi çekilir
                       └─▶ esi_alliance_corporations_queue'ya eklenir
                            └─▶ worker-alliance-corporations işler
                                 └─▶ Corporation ID'ler esi_corporation_info_queue'ya eklenir
```

### Her Gün (01:00 UTC - Paralel Çalışır)

```
01:00 UTC ─────▶ 3 JOB PARALEL BAŞLAR:
                  ├─▶ snapshot-alliances
                  │    └─▶ Alliance durumu snapshot'lanır
                  │
                  ├─▶ snapshot-corporations
                  │    └─▶ Corporation durumu snapshot'lanır
                  │
                  └─▶ update-alliance-counts
                       └─▶ Alliance statistics güncellenir
```

### Her Gün (04:00 UTC)

```
04:00 UTC ─────▶ queue-character-corporations çalışır
                  └─▶ Character'lardan eksik corp'lar tespit edilir
                       └─▶ esi_corporation_info_queue'ya eklenir
                            └─▶ worker-corporations işler
```

### Ayın 1'i (Aylık)

```
00:00 UTC ─────▶ queue-characters çalışır (SADECE AYIN 1'İ)
                  └─▶ ~93k character database'den taranır
                       └─▶ esi_character_info_queue'ya eklenir
                            └─▶ worker-characters işler (~31 dakika)
```

### 7/24 Sürekli Çalışan Worker'lar

```
Sürekli ──────▶ worker-redisq (real-time killmail stream)
            └─▶ worker-characters (character info queue)
            └─▶ worker-corporations (corporation info queue)
            └─▶ worker-alliances (alliance info queue)
            └─▶ worker-alliance-corporations (corp discovery queue)
            └─▶ worker-types (item/ship info queue)
            └─▶ worker-zkillboard (zkillboard sync queue)
            └─▶ worker-user-killmails (user ESI sync queue)
```

---

## 📅 Zamanlanmış İşler - Haftalık Takvim

| Gün         | Saat (UTC) | Job                          | Açıklama                                         |
| ----------- | ---------- | ---------------------------- | ------------------------------------------------ |
| **Pazar**   | 00:00      | queue-alliances              | Tüm alliance'ları ESI'dan çekip queue'ya ekler   |
| **Pazar**   | 00:10      | queue-alliance-corporations  | Alliance corporation'larını keşfeder             |
| **Her gün** | 01:00      | snapshot-alliances           | Alliance snapshot alır (paralel)                 |
| **Her gün** | 01:00      | update-alliance-counts       | Alliance killmail sayılarını günceller (paralel) |
| **Her gün** | 01:00      | snapshot-corporations        | Corporation snapshot alır (paralel)              |
| **Her gün** | 04:00      | queue-character-corporations | Eksik corporation'ları tespit eder               |
| **Ayda 1**  | 00:00      | queue-characters (1. gün)    | Tüm character'ları queue'ya ekler                |

---

## 🔧 Tipik Kullanım Senaryoları

### Yeni Deployment (İlk Kurulum)

```bash
# 1. Tüm servisleri başlat
pm2 start ecosystem.config.js

# 2. Durum kontrol
pm2 status
pm2 logs

# 3. Otomatik başlatma için kaydet
pm2 save
pm2 startup
```

### Alliance & Corporation Güncelleme (Manuel)

```bash
# Pazar günü workflow (otomatik çalışır normalde)
pm2 trigger queue-alliances              # 00:00 UTC
pm2 trigger queue-alliance-corporations  # 00:10 UTC

# Günlük workflow (otomatik çalışır normalde)
pm2 trigger snapshot-alliances           # 01:00 UTC
pm2 trigger update-alliance-counts       # 01:00 UTC
pm2 trigger snapshot-corporations        # 01:00 UTC
pm2 trigger queue-character-corporations # 04:00 UTC

# Aylık workflow (ayın 1'i - otomatik)
pm2 trigger queue-characters             # 00:00 UTC
```

### İlk Kurulum

```bash
# 1. Sunucuya bağlan
ssh killreport@YOUR_SERVER -p 7777

# 2. Projeyi klonla (zaten varsa atla)
cd /var/www
git clone https://github.com/umutyerebakmaz/killreport.git
cd killreport

# 3. Dependencies yükle
yarn install
cd backend && yarn install
cd ../frontend && yarn install
cd ..

# 4. Environment değişkenlerini ayarla
cp backend/.env.example backend/.env
# .env dosyasını düzenle

# 5. Database migrations
cd backend
yarn prisma:migrate:deploy
yarn prisma:generate

# 6. Build
cd ../frontend
yarn build

# 7. PM2 başlat
cd ..
pm2 start ecosystem.config.js

# 8. PM2'yi kaydet
pm2 save

# 9. Otomatik başlama
pm2 startup
# Çıktıdaki komutu çalıştır (sudo ile)
```

### Güncelleme

```bash
# 1. Kod güncellemesi
cd /var/www/killreport
git pull

# 2. Dependencies güncelle (gerekirse)
yarn install

# 3. Database migrations (gerekirse)
cd backend
yarn prisma:migrate:deploy

# 4. Frontend build (değişiklik varsa)
cd ../frontend
yarn build

# 5. PM2 reload (downtime olmadan)
cd ..
pm2 reload ecosystem.config.js

# 6. Kaydet
pm2 save
```

### Health Check

```bash
# Tüm servislerin durumu
pm2 list

# Resource kullanımı
pm2 monit

# Logları kontrol et
pm2 logs --lines 50

# Belirli bir worker'ın durumu
pm2 show worker-redisq

# RabbitMQ kuyruk durumu
# GraphQL query ile:
# query { workerStatus { queueName messageCount consumerCount } }
```

---

## ⚠️ Troubleshooting

### Worker Çalışmıyor

```bash
# 1. Durumu kontrol et
pm2 list

# 2. Logları incele
pm2 logs worker-characters --lines 100

# 3. Yeniden başlat
pm2 restart worker-characters

# 4. RabbitMQ bağlantısını kontrol et
# .env dosyasında RABBITMQ_URL doğru mu?

# 5. Queue'da mesaj var mı?
# GraphQL: query { workerStatus }
```

### Memory Problemi

```bash
# Memory kullanımını göster
pm2 list

# Max memory artır (ecosystem.config.js'de)
max_memory_restart: '1G'

# Reload
pm2 reload ecosystem.config.js
```

### Cron Job Çalışmadı

```bash
# Cron job'ın durumu
pm2 list | grep queue

# Manuel tetikle
pm2 trigger queue-characters

# Logları kontrol et
pm2 logs queue-characters

# PM2 daemon çalışıyor mu?
pm2 ping
```

### Process Restart Loop

```bash
# Hata loglarını incele
pm2 logs worker-redisq --err --lines 100

# Problemi çöz (genellikle connection error)

# Process'i temizle ve yeniden başlat
pm2 delete worker-redisq
pm2 start ecosystem.config.js --only worker-redisq
```

---

## 📚 İlgili Dokümantasyon

- [Daily Workflows](./daily.md) - Günlük operasyonlar
- [Worker Documentation](./WORKERS_DOCUMENTATION.md) - Worker detayları
- [Enrichment System](./ENRICHMENT_README.md) - Entity enrichment
- [Production Deployment](./PRODUCTION_DEPLOYMENT.md) - Deployment guide
- [CRON Schedule](../../deployment/CRON_SCHEDULE.md) - Zamanlanmış görevler

---

## 🔗 Faydalı Linkler

- **RabbitMQ Management:** `http://localhost:15672`
- **Backend API:** `http://localhost:4000/graphql`
- **Frontend:** `http://localhost:3000`
- **PM2 Plus:** `https://app.pm2.io` (opsiyonel)

---

**Son Güncelleme:** 8 Ocak 2026
**PM2 Version:** 5.x
**Total Processes:** 17 (2 servis + 8 worker + 7 cron)
