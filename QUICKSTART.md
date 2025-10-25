# ESI Worker Sistemi - Hızlı Başlangıç

## 🎯 Özet

ESI API'den Alliance, Corporation ve Character verilerini ESI rate limitine takılmadan çekmek için geliştirilmiş worker sistemi.

## ⚡ Hızlı Kurulum

### 1. Gereksinimler

Sistemde kurulu olması gerekenler:

- PostgreSQL (çalışıyor olmalı)
- RabbitMQ (çalışıyor olmalı)
- Node.js 18+

### 2. Database'i Hazırla

```bash
cd backend

# .env dosyasını oluştur (kendi bilgilerinizle güncelleyin)
cp .env.example .env

# .env içeriğini düzenleyin:
# DATABASE_URL="postgresql://your_user:your_password@localhost:5432/killreport"
# RABBITMQ_URL="amqp://localhost"
# DB_USER=your_user
# DB_PASSWORD=your_password
# DB_NAME=killreport

# Database oluştur (eğer yoksa)
psql -U postgres -c "CREATE DATABASE killreport;"

# Prisma migration çalıştır
npm run prisma:migrate

# Prisma client oluştur
npm run prisma:generate
```

### 3. Alliance Verilerini Çek

**Terminal 1 - Worker'ı Başlat:**

```bash
cd backend
npm run worker:alliance
```

**Terminal 2 - Orchestrator ile Veri Çekmeye Başla:**

```bash
cd backend

# Tüm alliance'ları queue'ya ekle
npm run orchestrator sync-alliances

# Durumu kontrol et
npm run orchestrator status
```

### 4. Corporation ve Character Verilerini Çek

**Alliance'lar bittikten sonra:**

```bash
# Corporation'ları çek (alliance'lardan gelen ID'ler)
npm run orchestrator sync-corporations

# Character'ları çek (creator ve CEO ID'leri)
npm run orchestrator sync-characters
```

## 🚀 Production Kullanım

### Paralel Worker'lar ile Hızlı İşleme

**5 Alliance Worker + 3 Corporation Worker + 2 Character Worker:**

```bash
# Terminal 1-5: Alliance workers
npm run worker:alliance

# Terminal 6-8: Corporation workers
npm run worker:corporation

# Terminal 9-10: Character workers
npm run worker:character
```

**veya Tek Komutla (tüm worker'lar bir process'te):**

```bash
npm run worker:all
```

### Veri Akışı

1. **Alliance Sync** → Tüm alliance'ları çeker
2. **Corporation Sync** → Alliance'lardaki corporation ID'lerini çeker
3. **Character Sync** → CEO ve creator character'ları çeker

## 📊 Monitoring

```bash
# Queue durumunu göster
npm run orchestrator status

# Çıktı:
# alliance_sync_queue: 1234 messages pending
# Error Limit Remaining: 95/100
```

## 🔧 Komutlar

```bash
# Orchestrator komutları
npm run orchestrator sync-alliances      # Tüm alliance'ları queue'ya ekle
npm run orchestrator sync-corporations   # Corporation'ları queue'ya ekle
npm run orchestrator sync-characters     # Character'ları queue'ya ekle
npm run orchestrator sync-all           # Her şeyi sırayla queue'ya ekle
npm run orchestrator status             # Queue durumunu göster
npm run orchestrator purge              # Tüm queue'ları temizle

# Tek entity ekle
npm run orchestrator queue alliance 1234567890
npm run orchestrator queue corporation 98765432

# Worker komutları
npm run worker:alliance     # Sadece alliance worker
npm run worker:corporation  # Sadece corporation worker
npm run worker:character    # Sadece character worker
npm run worker:all         # Tüm worker'lar
```

## 🎓 Nasıl Çalışır?

1. **Rate Limiter**: ESI'nin error limit (100/dakika) kuralına uyar
2. **RabbitMQ Queue**: Mesajları sıralar ve worker'lara dağıtır
3. **Worker**: Queue'dan mesaj alır, ESI'den veri çeker, database'e kaydeder
4. **Orchestrator**: Toplu işlemler için veri queue'ya ekler

### Rate Limit Yönetimi

- Error limit 10'un altına düşerse otomatik bekler
- 420 hatası alırsa header'daki süre kadar bekler
- Tüm worker'lar aynı rate limiter'ı kullanır

## 📝 Örnek Senaryo

**10,000 Alliance Çekmek:**

```bash
# 1. Worker'ları başlat (5 paralel)
npm run worker:alliance &
npm run worker:alliance &
npm run worker:alliance &
npm run worker:alliance &
npm run worker:alliance &

# 2. Alliance'ları queue'ya ekle
npm run orchestrator sync-alliances

# 3. İzle
watch -n 5 "npm run orchestrator status"
```

**Beklenen süre:** ~10-15 dakika (rate limit'e bağlı)

## 🐛 Sorun Giderme

**Worker çalışmıyor:**

```bash
docker ps  # PostgreSQL ve RabbitMQ çalışıyor mu?
```

**Rate limit hatası:**

```bash
npm run orchestrator status  # Error limit durumunu kontrol et
```

**Queue boş ama veri yok:**

```bash
docker logs killreport-rabbitmq  # RabbitMQ loglarına bak
```

## 📚 Detaylı Dokümantasyon

Detaylı bilgi için: `backend/WORKER_SYSTEM.md`
