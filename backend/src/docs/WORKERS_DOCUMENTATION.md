# Workers Documentation

## Overview

KillReport kullanır bir dağıtılmış worker sistemi RabbitMQ tabanlı. Her worker belirli bir görevi yerine getirir ve bağımsız process olarak çalışır. Bu sistem, ESI API rate limitlerini yönetmek ve büyük veri işlemlerini paralel olarak gerçekleştirmek için tasarlanmıştır.

## Worker Türleri

### 1. Queue Scripts (Kuyruklama Scriptleri)

İşlerin kuyruğa eklenmesinden sorumlu scriptler. Bir kez çalıştırılır ve işleri kuyruğa ekledikten sonra kapanır.

### 2. Worker Scripts (İşçi Scriptleri)

Kuyruktan gelen mesajları sürekli olarak dinleyen ve işleyen servisler. Arka planda sürekli çalışır.

---

## Queue Scripts

### `queue-alliances.ts`

**Amaç**: ESI'dan tüm alliance ID'lerini alıp `alliance_queue` kuyruğuna ekler.

**Kullanım**:

```bash
yarn queue:alliances
```

**İşleyiş**:

1. ESI'dan tüm alliance ID'lerini çeker (`/alliances/` endpoint)
2. Her alliance ID'sini `alliance_queue` kuyruğuna ekler
3. 100'lük batch'ler halinde işler

**Kuyruk**: `alliance_queue`

**Sonraki Adım**: `worker-alliances.ts` ile işlenir

---

### `queue-corporations.ts`

**Amaç**: ESI'dan tüm corporation ID'lerini alıp kuryğa ekler.

**Kullanım**:

```bash
yarn queue:corporations
```

**Not**: Detayları için worker dosyasına bakın.

---

### `queue-character-killmails.ts`

**Amaç**: Veritabanındaki kullanıcıların karakterlerini `killmail_sync_queue` kuyruğuna ekler.

**Kullanım**:

```bash
yarn queue:character
```

**İşleyiş**:

1. Veritabanından tüm kullanıcıları çeker
2. Her kullanıcı için karakter bilgilerini hazırlar
3. `killmail_sync_queue` kuyruğuna ekler

**Kuyruk**: `killmail_sync_queue`

**Sonraki Adım**: `worker-zkillboard-sync.ts` ile işlenir

---

### `queue-zkillboard-sync.ts`

**Amaç**: Belirli bir karakterin killmail'lerini senkronize etmek için kuyruğa iş ekler.

**Kullanım**:

```bash
yarn queue:zkillboard
```

**Kuyruk**: `killmail_sync_queue`

---

### `queue-alliance-corporations.ts` ⭐ YENİ

**Amaç**: Veritabanındaki tüm alliance'ların ID'lerini `alliance_corporation_queue` kuyruğuna ekler.

**Kullanım**:

```bash
yarn queue:alliance-corporations
```

**İşleyiş**:

1. Veritabanından tüm alliance ID'lerini çeker
2. Her alliance ID'sini `alliance_corporation_queue` kuyruğuna ekler

**Kuyruk**: `alliance_corporation_queue`

**Sonraki Adım**: `worker-alliance-corporations.ts` ile işlenir

---

### `scan-killmail-entities.ts`

**Amaç**: Killmail'lerdeki tüm entity'leri (character, corporation, alliance, type) tarar ve veritabanında eksik olanları ilgili kuyruklara ekler.

**Kullanım**:

```bash
yarn scan:entities
```

**İşleyiş**:

1. Veritabanındaki tüm killmail'leri tarar (100'lük batch'ler)
2. Her killmail'den character, corporation, alliance, type ID'lerini toplar
3. NPC'leri filtreler (character_id < 1M veya 3M-4M arası)
4. Veritabanında eksik olanları tespit eder
5. Her entity türü için ayrı kuyruğa ekler

**Kuyruklar**:

- `character_enrichment_queue`
- `corporation_enrichment_queue`
- `alliance_enrichment_queue`
- `type_enrichment_queue`

**Sonraki Adım**: İlgili enrichment worker'lar ile işlenir

---

## Worker Scripts

### `worker-enrichment-alliances.ts`

**Amaç**: Alliance ID'lerini ESI'dan çekip veritabanına kaydeder.

**Kullanım**:

```bash
yarn worker:enrichment:alliances
```

**Kuyruk**: `alliance_enrichment_queue`

**Concurrency**: 3 (aynı anda 3 alliance işler)

**İşleyiş**:

1. Kuyruktan alliance ID alır
2. Veritabanında zaten varsa atlar
3. ESI'dan alliance bilgilerini çeker (`getAllianceInfo()`)
4. `upsert` ile veritabanına kaydeder (race condition önlemi)

**ESI Endpoint**: `/alliances/{alliance_id}/`

**Rate Limit**: `esiRateLimiter` ile 50 req/sec

---

### `worker-enrichment-corporations.ts`

**Amaç**: Corporation ID'lerini ESI'dan çekip veritabanına kaydeder.

**Kullanım**:

```bash
yarn worker:enrichment:corporations
```

**Kuyruk**: `corporation_enrichment_queue`

**Concurrency**: 5 (aynı anda 5 corporation işler)

**İşleyiş**:

1. Kuyruktan corporation ID alır
2. Veritabanında zaten varsa atlar
3. ESI'dan corporation bilgilerini çeker (`getCorporationInfo()`)
4. `upsert` ile veritabanına kaydeder

**ESI Endpoint**: `/corporations/{corporation_id}/`

**Rate Limit**: `esiRateLimiter` ile 50 req/sec

---

### `worker-enrichment-characters.ts`

**Amaç**: Character ID'lerini ESI'dan çekip veritabanına kaydeder.

**Kullanım**:

```bash
yarn worker:enrichment:characters
```

**Kuyruk**: `character_enrichment_queue`

**Concurrency**: 10 (aynı anda 10 character işler)

**İşleyiş**:

1. Kuyruktan character ID alır
2. NPC'leri filtreler (id < 1M veya 3M-4M arası)
3. Veritabanında zaten varsa atlar
4. ESI'dan character bilgilerini çeker (`getCharacterInfo()`)
5. `upsert` ile veritabanına kaydeder

**ESI Endpoint**: `/characters/{character_id}/`

**Rate Limit**: `esiRateLimiter` ile 50 req/sec

---

### `worker-enrichment-types.ts`

**Amaç**: Type/Item ID'lerini ESI'dan çekip veritabanına kaydeder.

**Kullanım**:

```bash
yarn worker:enrichment:types
```

**Kuyruk**: `type_enrichment_queue`

**Concurrency**: 10 (aynı anda 10 type işler)

**İşleyiş**:

1. Kuyruktan type ID alır
2. Veritabanında zaten varsa atlar
3. ESI'dan type bilgilerini çeker (`getTypeInfo()`)
4. `upsert` ile veritabanına kaydeder

**ESI Endpoint**: `/universe/types/{type_id}/`

**Rate Limit**: `esiRateLimiter` ile 50 req/sec

---

### `worker-zkillboard-sync.ts`

**Amaç**: Kullanıcıların/karakterlerin killmail'lerini zKillboard'dan alıp veritabanına kaydeder.

**Kullanım**:

```bash
yarn worker:zkillboard
```

**Kuyruk**: `killmail_sync_queue`

**Concurrency**: 2 (rate limit nedeniyle)

**İşleyiş**:

1. Kuyruktan kullanıcı/karakter bilgisi alır
2. zKillboard'dan killmail ID'lerini çeker (200/sayfa, max 100 sayfa)
3. Her killmail için ESI'dan detayları alır
4. Veritabanına kaydet (victim, attackers, items ile birlikte)
5. 10 saniye zKillboard delay, ESI için rate limiter kullanır

**ESI Endpoint**: `/killmails/{killmail_id}/{hash}/`

**zKillboard Endpoint**: `/api/kills/characterID/{character_id}/`

**Rate Limits**:

- zKillboard: 10 saniye aynı endpoint için
- ESI: `esiRateLimiter` ile 50 req/sec

---

### `worker-alliances.ts`

**Amaç**: Alliance sync işlemlerini gerçekleştirir.

**Kullanım**:

```bash
yarn worker:alliances
```

**Kuyruk**: `alliance_queue`

**Not**: Detayları için worker dosyasına bakın.

---

### `worker-corporations.ts`

**Amaç**: Corporation sync işlemlerini gerçekleştirir.

**Kullanım**:

```bash
yarn worker:corporations
```

**Not**: Detayları için worker dosyasına bakın.

---

### `worker-alliance-snapshots.ts`

**Amaç**: Alliance snapshot'larını oluşturur ve kaydeder.

**Kullanım**:

```bash
yarn snapshot:alliances
```

**Not**: Detayları için worker dosyasına bakın.

---

### `worker-alliance-corporations.ts` ⭐ YENİ

**Amaç**: Alliance'lara ait corporation ID'lerini ESI'dan alıp `corporation_enrichment_queue` kuyruğuna ekler.

**Kullanım**:

```bash
yarn worker:alliance-corporations
```

**Kuyruk**: `alliance_corporation_queue`

**Concurrency**: 5 (aynı anda 5 alliance işler)

**İşleyiş**:

1. Kuyruktan alliance ID alır
2. ESI'dan alliance'ın corporation ID'lerini çeker (`/alliances/{alliance_id}/corporations/`)
3. Her corporation ID'sini `corporation_enrichment_queue` kuyruğuna ekler
4. Böylece `worker-enrichment-corporations.ts` bu ID'leri işler

**ESI Endpoint**: `/alliances/{alliance_id}/corporations/`

**Rate Limit**: `esiRateLimiter` ile 50 req/sec

**Sonraki Adım**: `worker-enrichment-corporations.ts` ile işlenir

---

## Diğer Scriptler

### `sync-character-killmails.ts`

**Amaç**: Belirli bir karakter için killmail'leri doğrudan senkronize eder (kuyruk kullanmadan).

**Kullanım**:

```bash
yarn sync:character <characterId> [maxPages]
```

**Örnek**:

```bash
yarn sync:character 95465499 50     # 50 sayfa (10,000 killmail)
yarn sync:character 95465499 999    # TÜM geçmiş
```

**İşleyiş**:

1. zKillboard'dan killmail ID'lerini çeker
2. Her killmail için ESI'dan detayları alır
3. Doğrudan veritabanına kaydeder
4. Progress gösterir

**Not**: Küçük işler için kullanışlı. Büyük işler için worker sistemi tercih edilmeli.

---

## Workflow'lar

### 1. Killmail Enrichment Workflow

**Amaç**: Killmail'lerdeki eksik entity bilgilerini tamamlamak

```
┌─────────────────────┐
│ yarn scan:entities  │ - Killmail'leri tarar
└──────────┬──────────┘
           │
           ├──────────────────────────────────┐
           │                                  │
           ▼                                  ▼
┌──────────────────────┐          ┌────────────────────────┐
│ character_enrichment │          │ corporation_enrichment │
│       _queue         │          │        _queue          │
└──────────┬───────────┘          └───────────┬────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────┐          ┌────────────────────────┐
│ worker:enrichment:   │          │ worker:enrichment:     │
│    characters        │          │    corporations        │
└──────────────────────┘          └────────────────────────┘
           │                                  │
           ├──────────────────────────────────┤
           ▼                                  ▼
┌──────────────────────────────────────────────┐
│         PostgreSQL Database                  │
│  (characters, corporations, alliances, types)│
└──────────────────────────────────────────────┘
```

**Adımlar**:

1. `yarn scan:entities` - Killmail'lerdeki eksik entity'leri tespit et
2. `yarn worker:enrichment:characters` - Character bilgilerini çek
3. `yarn worker:enrichment:corporations` - Corporation bilgilerini çek
4. `yarn worker:enrichment:alliances` - Alliance bilgilerini çek
5. `yarn worker:enrichment:types` - Type bilgilerini çek

---

### 2. User Killmail Sync Workflow

**Amaç**: Kullanıcıların killmail'lerini senkronize etmek

```
┌──────────────────┐
│ yarn queue:      │ - Kullanıcıları kuyruğa ekle
│   character      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ killmail_sync_   │
│     queue        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ worker:zkillboard│ - zKillboard'dan çek
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ PostgreSQL       │
│  (killmails)     │
└──────────────────┘
```

**Adımlar**:

1. `yarn queue:character` - Kullanıcıları kuyruğa ekle
2. `yarn worker:zkillboard` - Killmail'leri çek ve kaydet

---

### 3. Alliance Corporation Enrichment Workflow ⭐ YENİ

**Amaç**: Alliance'lara ait tüm corporation'ları veritabanına eklemek

```
┌─────────────────────────┐
│ yarn queue:alliance-    │ - DB'deki alliance'ları kuyruğa ekle
│    corporations         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ alliance_corporation_   │
│        queue            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ worker:alliance-        │ - Alliance corp ID'lerini ESI'dan çek
│    corporations         │ - corporation_enrichment_queue'ya ekle
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ corporation_enrichment_ │
│        queue            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ worker:enrichment:      │ - Corporation bilgilerini ESI'dan çek
│    corporations         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│    PostgreSQL Database  │
│     (corporations)      │
└─────────────────────────┘
```

**Adımlar**:

1. `yarn queue:alliance-corporations` - Alliance ID'lerini kuyruğa ekle
2. `yarn worker:alliance-corporations` - Her alliance için corp ID'lerini al ve kuyruğa ekle
3. `yarn worker:enrichment:corporations` - Corporation bilgilerini çek ve kaydet

---

## Rate Limiting

### ESI Rate Limiter

**Dosya**: `src/services/rate-limiter.ts`

**Ayarlar**:

- Max: 50 req/sec (ESI limiti 150 ama güvenli oyun için 50)
- Min delay: 20ms

**Kullanım**: Tüm ESI fonksiyonları otomatik olarak rate limiter kullanır

```typescript
return esiRateLimiter.execute(async () => {
  // ESI API call
});
```

### zKillboard Rate Limiting

**Kural**: Aynı endpoint için 10 saniye bekleme

**Uygulama**: `zkillboard.ts` servisinde manuel delay

---

## RabbitMQ Kuyruk Sistemi

### Kuyruk Özellikleri

- **Durable**: true (RabbitMQ restart sonrası mesajlar kaybolmaz)
- **Priority**: 0-10 arası öncelik sistemi
- **Prefetch**: Her worker için farklı (concurrency kontrolü)

### Mesaj Formatı

```typescript
interface EntityQueueMessage {
  entityId: number; // İşlenecek entity ID
  queuedAt: string; // Kuyruğa eklenme zamanı (ISO string)
  source: string; // Mesajın kaynağı (örn: "killmail_scan")
}
```

### Kuyruk İsimleri

| Kuyruk Adı                     | Amacı                          |
| ------------------------------ | ------------------------------ |
| `alliance_enrichment_queue`    | Alliance bilgilerini çekmek    |
| `corporation_enrichment_queue` | Corporation bilgilerini çekmek |
| `character_enrichment_queue`   | Character bilgilerini çekmek   |
| `type_enrichment_queue`        | Type bilgilerini çekmek        |
| `killmail_sync_queue`          | Killmail senkronizasyonu       |
| `alliance_queue`               | Alliance senkronizasyonu       |
| `alliance_corporation_queue`   | Alliance corp ID'lerini çekmek |

---

## Concurrency Ayarları

| Worker                  | Prefetch | Açıklama                        |
| ----------------------- | -------- | ------------------------------- |
| enrichment-alliances    | 3        | ESI rate limit için güvenli     |
| enrichment-corporations | 5        | Orta seviye concurrency         |
| enrichment-characters   | 10       | Yüksek concurrency              |
| enrichment-types        | 10       | Yüksek concurrency              |
| zkillboard-sync         | 2        | zKillboard rate limit nedeniyle |
| alliance-corporations   | 5        | ESI rate limit için güvenli     |

---

## Monitoring

### Worker Status

GraphQL üzerinden worker durumu sorgulanabilir:

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

### Logs

Her worker detaylı log çıktısı verir:

- Başlangıç bilgileri (kuyruk adı, prefetch)
- İşlem progress'i (processed/added/skipped/errors)
- Completion özeti
- Hata detayları

---

## Best Practices

### 1. Worker'ları Sırayla Başlatma

Enrichment işlemleri için:

```bash
# 1. Entity'leri tara ve kuyruğa ekle
yarn scan:entities

# 2. Worker'ları başlat (ayrı terminaller)
yarn worker:enrichment:alliances
yarn worker:enrichment:corporations
yarn worker:enrichment:characters
yarn worker:enrichment:types
```

### 2. Alliance Corporation Enrichment

```bash
# 1. Alliance'ları kuyruğa ekle
yarn queue:alliance-corporations

# 2. Worker'ları başlat (ayrı terminaller)
yarn worker:alliance-corporations
yarn worker:enrichment:corporations
```

### 3. Hata Durumunda

- Worker hata alırsa mesajı nack eder ve requeue yapar
- RabbitMQ mesajları durable olduğu için kaybolmaz
- Worker'ı yeniden başlatarak devam edebilirsin

### 4. Performance Monitoring

- Concurrency değerlerini ihtiyaca göre ayarla
- ESI rate limit hatası alırsan prefetch değerini düşür
- Database connection pool boyutunu worker sayısına göre ayarla

---

## Yeni Worker Ekleme Şablonu

```typescript
/**
 * [Worker Adı] Worker
 * [Açıklama]
 */

import "../config";
import prisma from "../services/prisma";
import { getRabbitMQChannel } from "../services/rabbitmq";

const QUEUE_NAME = "your_queue_name";
const PREFETCH_COUNT = 5; // Concurrency

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function yourWorker() {
  console.log("🚀 Your Worker Started");
  console.log(`📦 Queue: ${QUEUE_NAME}`);
  console.log(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { "x-max-priority": 10 },
    });

    channel.prefetch(PREFETCH_COUNT);

    console.log("✅ Connected to RabbitMQ");
    console.log("⏳ Waiting for messages...\n");

    let totalProcessed = 0;
    let totalErrors = 0;

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;

        const message: EntityQueueMessage = JSON.parse(msg.content.toString());
        const entityId = message.entityId;

        try {
          // İşleme mantığı buraya

          channel.ack(msg);
          totalProcessed++;
          console.log(`  ✅ [${totalProcessed}] Processed ${entityId}`);
        } catch (error) {
          totalErrors++;
          console.error(`  ❌ [${totalProcessed}] Error:`, error);
          channel.nack(msg, false, true); // Requeue
        }
      },
      { noAck: false }
    );
  } catch (error) {
    console.error("💥 Worker failed to start:", error);
    process.exit(1);
  }
}

yourWorker();
```

---

## Troubleshooting

### Worker Başlamıyor

- RabbitMQ çalışıyor mu kontrol et: `docker ps`
- .env dosyasında RABBITMQ_URL doğru mu?
- Port 5672 açık mı?

### ESI Rate Limit Hatası

- Prefetch değerini düşür
- Birden fazla worker instance'ı çalıştırma
- `esiRateLimiter` ayarlarını kontrol et

### Database Connection Hatası

- PostgreSQL çalışıyor mu?
- DATABASE_URL doğru mu?
- Connection pool boyutu yeterli mi?

### Mesajlar İşlenmiyor

- Worker çalışıyor mu kontrol et
- Kuyrukta mesaj var mı: GraphQL `workerStatus` query
- Consumer count > 0 mı?

---

## Gelecek İyileştirmeler

1. **Dead Letter Queue**: Başarısız mesajlar için ayrı kuyruk
2. **Retry Strategy**: Exponential backoff ile otomatik retry
3. **Worker Health Checks**: Prometheus metrics
4. **Dynamic Scaling**: Kuyruk uzunluğuna göre otomatik worker ölçekleme
5. **Dashboard**: RabbitMQ Management UI entegrasyonu
