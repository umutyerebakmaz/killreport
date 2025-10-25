# ESI Worker Sistemi

Bu sistem, EVE Online ESI API'sinden alliance, corporation, character ve diğer verileri çekmek için geliştirilmiş scalable bir worker sistemidir.

## 🏗️ Mimari

### Bileşenler

1. **ESI Rate Limiter** (`services/esi-rate-limiter.ts`)

   - ESI API rate limitlerini yönetir
   - Error limit (420 hatası) takibi
   - Otomatik retry mekanizması
   - Queue sistemi ile istekleri sıralar

2. **ESI Service** (`services/esi.ts`)

   - ESI API ile iletişim katmanı
   - Alliance, Corporation, Character ve Killmail verileri
   - Rate limiter ile entegre

3. **RabbitMQ Service** (`services/rabbitmq-enhanced.ts`)

   - Çoklu queue yönetimi
   - Alliance, Corporation, Character ve Killmail queue'ları
   - Batch publishing desteği
   - Queue monitoring

4. **Universal Worker** (`workers/universal-worker.ts`)

   - Tüm entity tiplerini işleyebilen worker
   - Environment variable ile yapılandırılabilir
   - Graceful shutdown desteği

5. **Orchestrator** (`orchestrator.ts`)
   - Senkronizasyon işlemlerini yönetir
   - Toplu veri çekme (bulk sync)
   - Queue durumu izleme

## 📊 Database Schema

```prisma
model Alliance {
  id, name, ticker, date_founded, creator_corporation_id,
  creator_id, executor_corporation_id, faction_id
}

model Corporation {
  id, name, ticker, member_count, ceo_id, alliance_id, ...
}

model Character {
  id, name, corporation_id, alliance_id, birthday, ...
}

model Killmail {
  id, killmail_time, solar_system_id, victim info, ...
}

model Attacker {
  killmail_id, character_id, damage_done, final_blow, ...
}

model SyncJob {
  entity_type, entity_id, status, retry_count, error
}
```

## 🚀 Kullanım

### 1. Database Kurulumu

```bash
cd backend
npm run prisma:migrate
npm run prisma:generate
```

### 2. Environment Variables

```bash
# .env.example'dan kopyalayın ve düzenleyin
cp .env.example .env

# Kendi database bilgilerinizle güncelleyin
nano .env
```

`.env` içeriği:

```env
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/killreport"
RABBITMQ_URL="amqp://localhost"
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=killreport
```

### 3. Worker'ları Başlatma

**Tüm worker'ları çalıştır:**

```bash
npm run worker:all
```

**Sadece Alliance worker:**

```bash
npm run worker:alliance
```

**Sadece Corporation worker:**

```bash
npm run worker:corporation
```

**Sadece Character worker:**

```bash
npm run worker:character
```

**Birden fazla terminal açarak paralel çalıştırabilirsiniz:**

```bash
# Terminal 1
npm run worker:alliance

# Terminal 2
npm run worker:alliance

# Terminal 3
npm run worker:corporation
```

### 4. Orchestrator ile Veri Çekme

**Tüm alliance'ları senkronize et:**

```bash
npm run orchestrator sync-alliances
```

**Corporation'ları senkronize et:**

```bash
npm run orchestrator sync-corporations
```

**Character'ları senkronize et:**

```bash
npm run orchestrator sync-characters
```

**Her şeyi senkronize et:**

```bash
npm run orchestrator sync-all
```

**Queue durumunu kontrol et:**

```bash
npm run orchestrator status
```

**Tek bir entity ekle:**

```bash
npm run orchestrator queue alliance 1234567890
npm run orchestrator queue corporation 98765432
npm run orchestrator queue character 12345678
```

**Tüm queue'ları temizle:**

```bash
npm run orchestrator purge
```

## 🔄 İş Akışı

### Alliance Sync Örneği

1. **Orchestrator ile queue'ya ekle:**

```bash
npm run orchestrator sync-alliances
```

2. **Worker'lar otomatik işler:**

   - ESI'den alliance bilgilerini çeker
   - Rate limit kurallarına uyar
   - Database'e kaydeder
   - Mesajı acknowledge eder

3. **Hata durumunda:**
   - 420 (Error Limited) → Otomatik bekle ve tekrar dene
   - 404 (Not Found) → Log ve devam et
   - Diğer hatalar → Mesajı dead letter queue'ya at

### Scalability

**Birden fazla worker çalıştırarak işlemi hızlandırabilirsiniz:**

```bash
# Terminal 1-5: Alliance workers
npm run worker:alliance

# Terminal 6-8: Corporation workers
npm run worker:corporation

# Terminal 9-10: Character workers
npm run worker:character
```

RabbitMQ otomatik olarak mesajları worker'lar arasında dağıtır (round-robin).

## 📈 Rate Limit Yönetimi

ESI API limitleri:

- **Error Limit:** 100 hata / dakika
- **Burst Limit:** Endpoint'e göre değişir

Rate limiter:

- Error limit 10'un altına düştüğünde otomatik bekler
- 420 hatası aldığında `x-esi-error-limit-reset` header'ına göre bekler
- Tüm worker'lar aynı rate limiter instance'ını kullanır

## 🔍 Monitoring

**Queue durumunu kontrol et:**

```bash
npm run orchestrator status
```

Çıktı:

```
📊 Queue Status:
================================
alliance_sync_queue: 1234 messages pending
corporation_sync_queue: 567 messages pending
character_sync_queue: 89 messages pending

🚦 Rate Limit Status:
================================
Error Limit Remaining: 95/100
Requests in Queue: 3
================================
```

## 🛠️ Production Deployment

### Systemd Service Örneği

Worker'ları systemd service olarak çalıştırabilirsiniz:

```bash
# /etc/systemd/system/killreport-worker-alliance.service
[Unit]
Description=Killreport Alliance Worker
After=network.target postgresql.service rabbitmq-server.service

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/killreport/backend
Environment="WORKER_TYPES=ALLIANCE"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run worker:alliance
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable ve start
sudo systemctl enable killreport-worker-alliance
sudo systemctl start killreport-worker-alliance

# Logları izle
sudo journalctl -u killreport-worker-alliance -f
```

### PM2 ile Yönetim

```bash
# PM2 kur
npm install -g pm2

# Worker'ları başlat
pm2 start npm --name "worker-alliance-1" -- run worker:alliance
pm2 start npm --name "worker-alliance-2" -- run worker:alliance
pm2 start npm --name "worker-corporation" -- run worker:corporation

# Durumu kontrol et
pm2 list
pm2 logs

# Otomatik başlat
pm2 startup
pm2 save
```

### Kubernetes ile Scale

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alliance-worker
spec:
  replicas: 5
  selector:
    matchLabels:
      app: alliance-worker
  template:
    metadata:
      labels:
        app: alliance-worker
    spec:
      containers:
        - name: worker
          image: killreport-backend:latest
          command: ["npm", "run", "worker:alliance"]
          env:
            - name: WORKER_TYPES
              value: "ALLIANCE"
```

## 📝 Notlar

- Worker'lar prefetch=1 ile çalışır (aynı anda 1 mesaj işler)
- Her worker graceful shutdown destekler (SIGINT/SIGTERM)
- Database bağlantıları pool kullanır
- RabbitMQ bağlantıları persistent'tır
- Tüm mesajlar durable queue'larda saklanır

## 🐛 Troubleshooting

**Worker mesaj almıyor:**

```bash
# RabbitMQ bağlantısını kontrol et
docker ps | grep rabbitmq

# Queue'da mesaj var mı?
npm run orchestrator status
```

**Rate limit hatası:**

```bash
# Rate limit durumunu kontrol et
npm run orchestrator status

# Worker loglarına bak
# "ESI error limit reached" mesajını ara
```

**Database bağlantı hatası:**

```bash
# PostgreSQL çalışıyor mu?
docker ps | grep postgres

# .env doğru mu?
cat backend/.env
```
