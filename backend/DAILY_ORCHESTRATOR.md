# Daily Orchestrator

Otomatik günlük workflow yöneticisi - EVE Online evrenindeki tüm alliance ve corporation verilerini günceller.

## 🎯 Özellikler

- ✅ **Tamamen Otomatik**: Her gün saat 02:00'de otomatik çalışır
- ✅ **Manuel Mod**: İstediğin zaman manuel çalıştırabilirsin
- ✅ **Queue Monitoring**: Her adımın tamamlanmasını bekler
- ✅ **Timeout Kontrolü**: Sonsuz döngüye girmez
- ✅ **Detaylı Loglama**: Her adım loglanır
- ✅ **Hata Toleransı**: Hata olursa ertesi gün yeniden dener

## 🚀 Kullanım

### Otomatik Mod (Production)

PM2 ile sürekli çalışır, her gün saat 02:00'de workflow'u başlatır:

```bash
# PM2 ile başlat
pm2 start ecosystem.config.js --only daily-orchestrator

# Logları izle
pm2 logs daily-orchestrator

# Durumu kontrol et
pm2 info daily-orchestrator
```

### Manuel Mod

İstediğin zaman hemen çalıştır:

```bash
# Development
cd backend
yarn worker:daily-orchestrator --manual

# Production
cd /var/www/killreport/backend
yarn worker:daily-orchestrator --manual
```

## 📊 Workflow Adımları

| Adım       | İşlem                          | Süre           | Açıklama                               |
| ---------- | ------------------------------ | -------------- | -------------------------------------- |
| 1          | `queue:alliances`              | ~5s            | 3,547 alliance ID'sini kuyruğa ekle    |
| 2          | `worker:info:alliances`        | ~20 dak        | Alliance detaylarını ESI'dan çek       |
| 3          | `queue:alliance-corporations`  | ~10s           | Corporation keşfi için kuyruğa ekle    |
| 4          | `worker:alliance-corporations` | ~15 dak        | Her alliance'ın corporation'larını bul |
| 5          | `worker:info:corporations`     | ~60 dak        | 17,769 corporation detayını çek        |
| 6          | `snapshot:alliances`           | ~2s            | Alliance snapshot kaydet               |
| 7          | `snapshot:corporations`        | ~3s            | Corporation snapshot kaydet            |
| **TOPLAM** |                                | **~95 dakika** |                                        |

## 📋 Gereksinimler

### Worker'lar Çalışmalı

Bu worker'ların PM2'de aktif olması gerekir:

```bash
pm2 list
# Şunlar çalışmalı:
# - worker-alliances (worker:info:alliances)
# - worker-alliance-corporations (worker:alliance-corporations)
# - worker-corporations (worker:info:corporations)
```

Eksikse ekle:

```bash
pm2 start ecosystem.config.js --only worker-alliances
pm2 start ecosystem.config.js --only worker-alliance-corporations
pm2 start ecosystem.config.js --only worker-corporations
pm2 save
```

### RabbitMQ Erişilebilir Olmalı

```bash
# RabbitMQ çalışıyor mu?
sudo systemctl status rabbitmq-server

# Queue'ları kontrol et
yarn rabbitmq:queue-count esi_alliance_info_queue
```

## 🔧 Konfigürasyon

### Zamanlama Değiştirme

[`daily-orchestrator.ts`](src/workers/daily-orchestrator.ts#L11) dosyasında:

```typescript
const SCHEDULE_HOUR = 2; // 02:00 UTC -> İstediğin saati yaz
```

### Timeout Süreleri

Her queue için farklı timeout:

```typescript
await waitForQueueEmpty("esi_alliance_info_queue", 30); // 30 dakika
await waitForQueueEmpty("esi_alliance_corporations_queue", 60); // 60 dakika
await waitForQueueEmpty("esi_corporation_info_queue", 90); // 90 dakika
```

### Kontrol Aralığı

Queue'lar kaç saniyede bir kontrol edilsin:

```typescript
const CHECK_INTERVAL = 30000; // 30 saniye (30000 ms)
```

## 📊 Monitoring

### Logları İzle

```bash
# Orchestrator logları
pm2 logs daily-orchestrator

# Tüm worker logları
pm2 logs | grep "worker-"

# Sadece hata logları
tail -f /var/www/killreport/logs/daily-orchestrator-error.log
```

### Manuel Queue Kontrolü

```bash
# Bir queue'nun durumunu kontrol et
yarn rabbitmq:queue-count esi_alliance_info_queue

# Tüm queue'ları listele
yarn rabbitmq:list-queues
```

## 🚨 Troubleshooting

### Orchestrator Başlamıyor

```bash
# PM2 loglarını kontrol et
pm2 logs daily-orchestrator --lines 50

# Manuel test et
yarn worker:daily-orchestrator --manual
```

### Worker'lar Queue'ları İşlemiyor

```bash
# Worker loglarını kontrol et
pm2 logs worker-alliances --lines 50
pm2 logs worker-corporations --lines 50

# Worker'ları restart et
pm2 restart worker-alliances
pm2 restart worker-corporations
```

### Timeout Hatası

Eğer queue 60 dakikada boşalamıyorsa:

1. **Worker çalışıyor mu?** → `pm2 list`
2. **ESI rate limit?** → Worker loglarına bak
3. **Database connection?** → Backend loglarına bak

```bash
# Worker'ı restart et
pm2 restart worker-alliances

# Veya manuel çalıştır
yarn worker:info:alliances
```

### Workflow Ortada Kesildi

Orchestrator hatadan sonra otomatik duracak. Ertesi gün yeniden deneyecek. Hemen çalıştırmak istersen:

```bash
yarn worker:daily-orchestrator --manual
```

## 🎯 Best Practices

### 1. İlk Kurulum Sonrası Test Et

```bash
# Manuel çalıştır ve logları izle
yarn worker:daily-orchestrator --manual
```

### 2. Log Rotation Ekle

Loglar büyüyebilir, rotation ekle:

```bash
# /etc/logrotate.d/killreport
/var/www/killreport/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### 3. Alert Sistemi

Workflow başarısız olursa bildirim al (örnek):

```typescript
// daily-orchestrator.ts'e ekle
import axios from "axios";

async function sendAlert(message: string) {
  await axios.post("YOUR_WEBHOOK_URL", {
    text: `🚨 Daily Orchestrator: ${message}`,
  });
}
```

## 📝 Development vs Production

### Development (Local)

```bash
# Backend'i çalıştır
yarn dev

# Farklı terminal'de orchestrator'u manuel çalıştır
yarn worker:daily-orchestrator --manual

# Veya sadece belli adımları test et
yarn queue:alliances
yarn rabbitmq:queue-count esi_alliance_info_queue
```

### Production

```bash
# PM2 ile otomatik çalışır
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Manuel çalıştırmak için
yarn worker:daily-orchestrator --manual
```

## 🔄 Enrichment ile İlişkisi

**Orchestrator ve Enrichment paralel çalışır, birbirini engellemez:**

| Sistem           | Tetikleyici         | Kapsam                          | Sıklık          |
| ---------------- | ------------------- | ------------------------------- | --------------- |
| **Enrichment**   | Yeni killmail geldi | Sadece killmail'deki entity'ler | 7/24 reaktif    |
| **Orchestrator** | Her gün 02:00       | TÜM alliance ve corporation     | Günlük proaktif |

Her iki sistem de aynı worker'ları kullanır ama farklı queue'lara job ekler. Upsert pattern sayesinde conflict olmaz.

## 📚 İlgili Dosyalar

- [`src/workers/daily-orchestrator.ts`](src/workers/daily-orchestrator.ts) - Ana orchestrator
- [`src/scripts/rabbitmq-queue-count.ts`](src/scripts/rabbitmq-queue-count.ts) - Queue monitoring helper
- [`ecosystem.config.js`](../../ecosystem.config.js) - PM2 konfigürasyonu
- [`package.json`](package.json) - Script tanımları

## ✅ Checklist

Deploy öncesi kontrol et:

- [ ] Worker'lar PM2'de aktif
- [ ] RabbitMQ çalışıyor
- [ ] Database erişilebilir
- [ ] Log klasörü mevcut (`/var/www/killreport/logs/`)
- [ ] Manuel test başarılı
- [ ] PM2 startup configurated
- [ ] PM2 save yapıldı
