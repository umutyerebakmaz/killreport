# PM2 Process Management - KillReport

Bu doküman, KillReport projesinin PM2 ile yönetimi hakkında bilgiler içerir.

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Process Listesi](#process-listesi)
- [PM2 Komutları](#pm2-komutları)
- [Monitöring](#monitöring)
- [Log Yönetimi](#log-yönetimi)
- [Cron Jobs](#cron-jobs)

## Genel Bakış

KillReport, PM2 kullanarak 17 farklı process yönetir:

- **2 Uygulama**: Backend API ve Frontend
- **8 Worker**: Real-time ve queue tabanlı data işleme
- **7 Cron Job**: Scheduled maintenance ve data sync işlemleri

Tüm process'ler `ecosystem.config.js` dosyasında tanımlanmıştır.

## Process Listesi

### Web Uygulamaları

#### 1. killreport-backend

- **Açıklama**: GraphQL API sunucusu
- **Port**: 4000
- **Komut**: `yarn start`
- **Memory Limit**: 1GB
- **Logs**: `/var/www/killreport/logs/backend-*.log`

#### 2. killreport-frontend

- **Açıklama**: Next.js frontend uygulaması
- **Port**: 3000
- **Komut**: `yarn start`
- **Memory Limit**: 1GB
- **Logs**: `/var/www/killreport/logs/frontend-*.log`

### Workers (Sürekli Çalışan)

#### 3. worker-redisq

- **Açıklama**: Real-time killmail ingestion (zKillboard RedisQ)
- **Komut**: `yarn worker:redisq`
- **Memory Limit**: 512MB
- **Restart**: Auto restart enabled, 5 second delay
- **Logs**: `/var/www/killreport/logs/worker-redisq-*.log`

#### 4. worker-alliances

- **Açıklama**: Alliance bilgilerini ESI'dan çeker (prefetch: 3)
- **Komut**: `yarn worker:info:alliances`
- **Queue**: `esi_alliance_info_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-alliances-*.log`

#### 5. worker-corporations

- **Açıklama**: Corporation bilgilerini ESI'dan çeker (prefetch: 5)
- **Komut**: `yarn worker:info:corporations`
- **Queue**: `esi_corporation_info_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-corporations-*.log`

#### 6. worker-alliance-corporations

- **Açıklama**: Alliance içindeki corporation'ları keşfeder (prefetch: 5)
- **Komut**: `yarn worker:alliance-corporations`
- **Queue**: `esi_alliance_corporations_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-alliance-corporations-*.log`

#### 7. worker-types

- **Açıklama**: Ship ve module bilgilerini çeker (prefetch: 10)
- **Komut**: `yarn worker:info:types`
- **Queue**: `esi_type_info_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-types-*.log`

#### 8. worker-zkillboard

- **Açıklama**: zKillboard'dan character killmail sync (prefetch: 1)
- **Komut**: `yarn worker:zkillboard`
- **Queue**: `zkillboard_character_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-zkillboard-*.log`

#### 9. worker-user-killmails

- **Açıklama**: Kullanıcı killmail'lerini ESI'dan çeker (prefetch: 1)
- **Komut**: `yarn worker:user-killmails`
- **Memory Limit**: 512MB
- **Restart**: Auto restart enabled, 5 second delay
- **Logs**: `/var/www/killreport/logs/worker-user-killmails-*.log`

#### 10. worker-characters

- **Açıklama**: Character bilgilerini yüksek concurrency ile çeker (prefetch: 10)
- **Komut**: `yarn worker:info:characters`
- **Queue**: `esi_character_info_queue`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-characters-*.log`

#### 11. worker-prices

- **Açıklama**: Item fiyatlarını çeker (prefetch: 10)
- **Komut**: `yarn worker:prices`
- **Memory Limit**: 512MB
- **Logs**: `/var/www/killreport/logs/worker-prices-*.log`

### Cron Jobs (Scheduled)

#### 12. queue-characters

- **Açıklama**: Character'ları queue'ya ekler
- **Schedule**: Her ayın 1'i, 00:00 UTC (`0 0 1 * *`)
- **Komut**: `yarn queue:characters`
- **Logs**: `/var/www/killreport/logs/queue-characters-*.log`

#### 13. queue-alliances

- **Açıklama**: Alliance'ları queue'ya ekler
- **Schedule**: Her gün 22:00 UTC / 01:00 Turkey Time (`0 22 * * *`)
- **Komut**: `yarn queue:alliances`
- **Logs**: `/var/www/killreport/logs/queue-alliances-*.log`

#### 14. queue-alliance-corporations

- **Açıklama**: Alliance corporation'larını queue'ya ekler
- **Schedule**: Her gün 22:05 UTC / 01:05 Turkey Time (`5 22 * * *`)
- **Komut**: `yarn queue:alliance-corporations`
- **Logs**: `/var/www/killreport/logs/queue-alliance-corporations-*.log`

#### 15. queue-character-corporations

- **Açıklama**: Character corporation'larını queue'ya ekler
- **Schedule**: Her gün 04:00 UTC (`0 4 * * *`)
- **Komut**: `yarn queue:character-corporations`
- **Logs**: `/var/www/killreport/logs/queue-character-corporations-*.log`

#### 16. snapshot-alliances

- **Açıklama**: Alliance snapshot'larını alır
- **Schedule**: Her gün 01:00 UTC (`0 1 * * *`)
- **Komut**: `yarn snapshot:alliances`
- **Logs**: `/var/www/killreport/logs/snapshot-alliances-*.log`

#### 17. update-alliance-counts

- **Açıklama**: Alliance sayılarını günceller
- **Schedule**: Her gün 01:00 UTC (`0 1 * * *`)
- **Komut**: `yarn update:alliance-counts`
- **Logs**: `/var/www/killreport/logs/update-alliance-counts-*.log`

#### 18. snapshot-corporations

- **Açıklama**: Corporation snapshot'larını alır
- **Schedule**: Her gün 01:00 UTC (`0 1 * * *`)
- **Komut**: `yarn snapshot:corporations`
- **Logs**: `/var/www/killreport/logs/snapshot-corporations-*.log`

#### 19. queue-prices

- **Açıklama**: Fiyatları queue'ya ekler
- **Schedule**: Her gün 06:00 UTC / 09:00 Turkey Time (`0 6 * * *`)
- **Komut**: `yarn queue:prices`
- **Logs**: `/var/www/killreport/logs/queue-prices-*.log`

## PM2 Komutları

### Kurulum ve Başlatma

```bash
# PM2'yi global yükle
npm install -g pm2

# Tüm process'leri başlat
pm2 start ecosystem.config.js

# PM2'yi sistem başlangıcında otomatik başlat
pm2 startup
pm2 save
```

### Process Yönetimi

```bash
# Tüm process'leri göster
pm2 list
pm2 status

# Belirli bir process'i yönet
pm2 restart killreport-backend
pm2 stop worker-redisq
pm2 delete worker-alliances

# Tüm process'leri yönet
pm2 restart all
pm2 stop all
pm2 delete all

# Belirli bir process'i baştan başlat (configuration'ı yeniden yükle)
pm2 reload killreport-backend

# Process'leri memory limit'e göre yeniden başlat
pm2 reload all --max-memory-restart 500M
```

### Cron Job Yönetimi

```bash
# Cron job'ları hemen çalıştır (test için)
pm2 trigger queue-alliances

# Belirli bir cron job'ı tekrar schedule et
pm2 restart queue-alliances
```

## Monitöring

### Real-time Monitoring

```bash
# Real-time dashboard
pm2 monit

# Process listesi ve resource kullanımı
pm2 list

# Detaylı process bilgisi
pm2 describe killreport-backend

# Real-time CPU ve memory kullanımı
pm2 monit
```

### Memory ve CPU İzleme

```bash
# Memory kullanımını göster
pm2 list | grep -E 'name|memory'

# CPU kullanımını göster
pm2 list | grep -E 'name|cpu'

# Belirli bir process'in detaylı bilgisi
pm2 describe worker-redisq
```

## Log Yönetimi

### Log Görüntüleme

```bash
# Tüm log'ları izle
pm2 logs

# Belirli bir process'in log'larını izle
pm2 logs killreport-backend

# Sadece error log'larını göster
pm2 logs --err

# Son 100 satırı göster
pm2 logs --lines 100

# Log'ları temizle
pm2 flush
```

### Log Rotation (Önerilen)

```bash
# PM2 log rotation modülünü yükle
pm2 install pm2-logrotate

# Log rotation ayarları
pm2 set pm2-logrotate:max_size 100M      # Max 100MB per log
pm2 set pm2-logrotate:retain 7           # Keep 7 days
pm2 set pm2-logrotate:compress true      # Gzip old logs
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Rotate daily
```

### Manuel Log Temizleme

```bash
# Tüm log'ları sil
pm2 flush

# Belirli bir process'in log'larını sil
pm2 flush killreport-backend

# Eski log dosyalarını manuel sil
rm -rf /var/www/killreport/logs/*.log
```

## Cron Jobs

### Cron Schedule Formatı

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Gün (0-6, Pazar = 0)
│ │ │ └───── Ay (1-12)
│ │ └─────── Ayın Günü (1-31)
│ └───────── Saat (0-23)
└─────────── Dakika (0-59)
```

### Mevcut Cron Schedule'lar

| Process                      | Schedule     | UTC                 | Turkey Time         | Açıklama                   |
| ---------------------------- | ------------ | ------------------- | ------------------- | -------------------------- |
| queue-characters             | `0 0 1 * *`  | Her ayın 1'i, 00:00 | Her ayın 1'i, 03:00 | Aylık character sync       |
| queue-alliances              | `0 22 * * *` | Her gün 22:00       | Her gün 01:00       | Günlük alliance sync       |
| queue-alliance-corporations  | `5 22 * * *` | Her gün 22:05       | Her gün 01:05       | Günlük alliance corp sync  |
| queue-character-corporations | `0 4 * * *`  | Her gün 04:00       | Her gün 07:00       | Günlük character corp sync |
| snapshot-alliances           | `0 1 * * *`  | Her gün 01:00       | Her gün 04:00       | Günlük alliance snapshot   |
| update-alliance-counts       | `0 1 * * *`  | Her gün 01:00       | Her gün 04:00       | Günlük alliance counts     |
| snapshot-corporations        | `0 1 * * *`  | Her gün 01:00       | Her gün 04:00       | Günlük corp snapshot       |
| queue-prices                 | `0 6 * * *`  | Her gün 06:00       | Her gün 09:00       | Günlük price sync          |

### Cron Job'ları Test Etme

```bash
# Cron job'u manuel çalıştır (schedule'ı beklemeden)
cd /var/www/killreport/backend
yarn queue:alliances

# PM2 ile cron job'u trigger et
pm2 trigger queue-alliances

# Cron job log'larını izle
pm2 logs queue-alliances --lines 50
```

## Troubleshooting

### Process Restart Sorunları

```bash
# Process'in durumunu kontrol et
pm2 describe killreport-backend

# Process'i tamamen kaldır ve yeniden başlat
pm2 delete killreport-backend
pm2 start ecosystem.config.js --only killreport-backend

# Tüm process'leri yeniden başlat
pm2 delete all
pm2 start ecosystem.config.js
```

### Memory Sorunları

```bash
# Memory kullanımını kontrol et
pm2 list

# Memory limit'i aşan process'leri restart et
pm2 reload all --max-memory-restart 500M

# Belirli bir process için memory limit ayarla
pm2 restart worker-redisq --max-memory-restart 512M
```

### Log Sorunları

```bash
# Log dosyalarının boyutunu kontrol et
ls -lh /var/www/killreport/logs/

# Eski log'ları temizle
pm2 flush

# Log rotation'ın çalıştığını kontrol et
pm2 conf pm2-logrotate
```

## Best Practices

1. **Log Rotation**: PM2 log rotation modülünü mutlaka yükleyin
2. **Memory Limits**: Her process için uygun memory limit ayarlayın
3. **Monitoring**: PM2 Plus veya Keymetrics ile monitoring kurun
4. **Auto Restart**: Production'da auto restart her zaman aktif olmalı
5. **Cron Jobs**: Cron job'ların çakışmamasına dikkat edin (5 dakika ara bırakın)
6. **Backup**: `pm2 save` komutu ile configuration'ı düzenli kaydedin
7. **Updates**: Process'leri güncellerken `pm2 reload` kullanın (zero-downtime)

## Environment Variables

Tüm process'ler `NODE_ENV=production` ile çalışır. Ek environment variable'lar:

- `PORT`: Backend (4000), Frontend (3000)
- `LOG_LEVEL`: `debug` (workers), `info` (cron jobs)
- `USE_REDIS_PUBSUB`: `true` (backend için Redis pub/sub)
- `REDIS_URL`: `redis://localhost:6379`

## Güvenlik

- Log dosyaları `/var/www/killreport/logs/` altında saklanır
- Log rotation ile disk dolmasını önleyin
- Sensitive data içeren log'ları maskeleyin
- PM2'nin kendisini `pm2 startup` ile sistem başlangıcında başlatın

## İlgili Dosyalar

- [`ecosystem.config.js`](ecosystem.config.js): PM2 configuration
- [`backend/package.json`](backend/package.json): Backend script tanımları
- [`frontend/package.json`](frontend/package.json): Frontend script tanımları
- [`deployment/`](deployment/): Deployment dokümantasyonu
