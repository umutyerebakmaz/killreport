# Daily Workflows (Backend)

## 📋 Simple Daily Sequence

```bash
# 1. Update Alliance & Corporation Data
+yarn queue:alliances              # Queue all alliance IDs from ESI -
yarn worker:info:alliances        # Fetch and UPDATE alliance details - 3547

+yarn queue:alliance-corporations  # Queue alliances (for corporation discovery) - 3547
yarn worker:alliance-corporations # Fetch corporation IDs from ESI for each alliance and queue them - 17,769
yarn worker:info:corporations     # Fetch and UPDATE corporation details from ESI

# 2. Take Snapshots
yarn snapshot:alliances
yarn snapshot:corporations
```

## 📖 What Each Command Does

**`yarn queue:alliances`**

- Fetches ALL alliance IDs from ESI
- Adds them to the `esi_alliance_info_queue`

**`yarn worker:info:alliances`**

- Processes alliance IDs from the queue
- Fetches details from ESI for each alliance
- Performs **UPSERT** in database (updates existing, inserts new)
- Updated fields: name, ticker, executor_corporation_id, faction_id

**`yarn queue:alliance-corporations`**

- Fetches ALL alliances from database
- Queues each alliance ID to `esi_alliance_corporations_queue`

**`yarn worker:alliance-corporations`**

- Processes alliance IDs from the queue
- Fetches corporation IDs from ESI for each alliance (`GET /alliances/{id}/corporations/`)
- Queues corporation IDs to `esi_corporation_info_queue`
- **IMPORTANT:** Without this step, corporations cannot be discovered!

**`yarn worker:info:corporations`**

- Processes corporation IDs from the queue
- Fetches details from ESI for each corporation
- Performs **UPSERT** in database (updates existing, inserts new)
- Updated fields: name, ticker, member_count, ceo_id, alliance_id, tax_rate

**`yarn snapshot:alliances`**

- Takes a snapshot of all alliances

**`yarn snapshot:corporations`**

- Takes a snapshot of all corporations

---

## 📅 Character & Corporation Management (5 Ocak 2026)

### Character Bilgilerini Güncelleme

DB'deki **tüm character'ların** bilgilerini ESI'dan güncellemek için:

```bash
# 1. Tüm character ID'lerini queue'ya ekle
yarn queue:characters

# 2. Worker'ı başlat (5 concurrent)
yarn worker:info:characters
```

**Ne yapar:**

- Database'deki ~93k character ID'sini tarar
- Tümünü `esi_character_info_queue`'ya ekler
- Worker ESI'dan güncel bilgileri çeker ve database'i günceller

**Ne zaman kullanılır:**

- Haftalık/aylık karakter bilgisi güncellemeleri için
- Tüm karakterlerin güncel olduğundan emin olmak için
- Alliance/Corporation değişikliklerini yakalamak için

---

### Eksik Corporation'ları Tespit ve Güncelleme

Character'lardaki eksik corporation'ları tespit edip ESI'dan bilgilerini çeker:

```bash
# 1. Character'ları tara ve eksik corporation'ları queue'ya ekle
yarn queue:character-corporations

# 2. Worker'ı başlat (5 concurrent)
yarn worker:info:corporations
```

**Ne yapar:**

- Database'deki tüm character'ların `corporation_id`'lerini toplar (~24k benzersiz)
- Bunlardan database'de olmayanları tespit eder
- Eksik corporation'ları `esi_corporation_info_queue`'ya ekler
- Worker ESI'dan corporation bilgilerini çeker ve database'e ekler

**Ne zaman kullanılır:**

- Character sync'ten sonra eksik corporation'ları tamamlamak için
- Yeni killmail'lerden sonra eksik corporation'ları doldurmak için
- Database tutarlılığını sağlamak için

---

### Belirli Character'ları Güncelleme

Login olan kullanıcıların veya özel durumlar için belirli character'ları güncelle:

```bash
# Tek character
yarn queue:characters 379226154

# Birden fazla character
yarn queue:characters 379226154 95465499 123456

# Worker'ı başlat
yarn worker:info:characters
```

**Ne yapar:**

- Belirtilen character ID'lerini doğrudan `esi_character_info_queue`'ya ekler
- Worker ESI'dan güncel bilgileri çeker ve database'i günceller

**Ne zaman kullanılır:**

- Login olan kullanıcının bilgilerini güncellemek için
- Manuel olarak belirli bir character'ı güncellemek için
- Test ve debug amaçlı

---

## 🔄 Önerilen Workflow Senaryoları

### Senaryo 1: Haftalık Tam Güncelleme

```bash
# 1. Alliance & Corporation güncellemeleri
yarn queue:alliances
yarn worker:info:alliances

yarn queue:alliance-corporations
yarn worker:alliance-corporations
yarn worker:info:corporations

# 2. Character güncellemeleri
yarn queue:characters
yarn worker:info:characters

# 3. Eksik corporation'ları tamamla
yarn queue:character-corporations
yarn worker:info:corporations

# 4. Snapshot'ları al
yarn snapshot:alliances
yarn snapshot:corporations
```

### Senaryo 2: Sadece Eksik Entity'leri Tamamla

```bash
# Killmail'lerden eksik tüm entity'leri tara ve tamamla
yarn scan:entities

# Spesifik olarak character corporation'larını kontrol et
yarn queue:character-corporations
yarn worker:info:corporations
```

---

## 📊 Worker Performans Tablosu

| Worker                         | Queue Name                        | Concurrency | Rate Limit | Kullanım                          |
| ------------------------------ | --------------------------------- | ----------- | ---------- | --------------------------------- |
| `worker:info:alliances`        | `esi_alliance_info_queue`         | 3           | 50 req/sec | Alliance bilgilerini günceller    |
| `worker:info:corporations`     | `esi_corporation_info_queue`      | 5           | 50 req/sec | Corporation bilgilerini günceller |
| `worker:info:characters`       | `esi_character_info_queue`        | 5           | 50 req/sec | Character bilgilerini günceller   |
| `worker:info:types`            | `esi_type_info_queue`             | 10          | 50 req/sec | Ship/item bilgilerini günceller   |
| `worker:alliance-corporations` | `esi_alliance_corporations_queue` | 5           | 50 req/sec | Alliance corp'ları keşfeder       |

**Önemli:** Tüm ESI worker'ları aynı rate limit'i paylaşır (50 req/sec). Birden fazla worker çalıştırırken dikkatli olun.

---

## 🔍 İzleme ve Debug

### Queue Durumunu Kontrol

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

### RabbitMQ Management

- URL: `http://localhost:15672`
- User/Pass: `.env` dosyasında tanımlı

### Worker Logları

- `info`: Genel ilerleme
- `debug`: Batch detayları
- `error`: Hatalar

---

## ⚠️ Önemli Notlar

1. **Rate Limiting:** ESI API 50 req/sec limit. Worker concurrency'sini buna göre ayarla.
2. **Database Connections:** Worker'lar `prisma-worker.ts` kullanır (2 connection max).
3. **Memory:** 93k character sync'i ~2GB RAM kullanabilir.
4. **Süre:** 93k character ~31 dakika (5 concurrent, 50 req/sec).
5. **Killmail sync'ten sonra mutlaka `scan:entities` çalıştırın**
6. Production'da worker'ları PM2 ile sürekli çalışır durumda tutun

---

## 🔗 İlgili Dokümantasyon

- [Enrichment System](./ENRICHMENT_README.md)
- [Workers Documentation](./WORKERS_DOCUMENTATION.md)
- [Character Killmail Worker](./CHARACTER_KILLMAIL_WORKER.md)
