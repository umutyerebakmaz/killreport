# 💰 DigitalOcean Maliyet Karşılaştırması ve Ölçeklendirme Planı

## Senaryo Karşılaştırması

### Senaryo 1: Tek Droplet + Managed DB (Production Başlangıç)

**Toplam: $63/ay**

| Servis                | Spec                         | Maliyet    |
| --------------------- | ---------------------------- | ---------- |
| CPU-Optimized Droplet | 4 vCPU, 8 GB RAM             | $48/ay     |
| Managed PostgreSQL    | 1 vCPU, 1 GB RAM, 10 GB disk | $15/ay     |
| **Toplam**            |                              | **$63/ay** |

**Connection Pool:**

```bash
DB_URL="postgresql://user:pass@managed-host:25060/killreport?sslmode=require&connection_limit=2"
# 8 processes × 2 connections = 16 total
# Managed PostgreSQL limit = 25 connections ✅
```

**Kapasitesi:**

- 50,000 killmail/gün
- 100 concurrent user
- 10 worker process
- Database: 10 GB (yaklaşık 1M killmail)

**Artıları:**

- ✅ Düşük maliyet
- ✅ Kolay yönetim (tek sunucu)
- ✅ Managed DB otomatik backup
- ✅ SSL otomatik yenileme

**Eksileri:**

- ⚠️ Single point of failure
- ⚠️ Database scale limitli (önce upgrade gerekir)

---

### Senaryo 2: Ayrık Worker Droplet (Scale-Up Hazır)

**Toplam: $132/ay**

| Servis             | Spec                         | Maliyet     |
| ------------------ | ---------------------------- | ----------- |
| App Droplet        | 2 vCPU, 4 GB RAM             | $24/ay      |
| Worker Droplet     | 4 vCPU, 8 GB RAM             | $48/ay      |
| Managed PostgreSQL | 2 vCPU, 4 GB RAM, 25 GB disk | $60/ay      |
| **Toplam**         |                              | **$132/ay** |

**Connection Pool:**

```bash
# App Droplet (2 processes)
DB_URL="postgresql://user:pass@managed-host:25060/killreport?sslmode=require&connection_limit=5"

# Worker Droplet (6 workers)
DB_URL="postgresql://user:pass@managed-host:25060/killreport?sslmode=require&connection_limit=2"

# Total: (2×5) + (6×2) = 22 connections
# Professional PostgreSQL limit = 97 connections ✅
```

**Kapasitesi:**

- 200,000 killmail/gün
- 500 concurrent user
- 20 worker process
- Database: 25 GB (yaklaşık 2.5M killmail)

**Artıları:**

- ✅ Worker isolation (backend crash etmez)
- ✅ Independent scaling
- ✅ PostgreSQL standby node (HA)
- ✅ Connection pooling

**Eksileri:**

- ⚠️ Daha yüksek maliyet
- ⚠️ İki sunucu yönetimi

---

### Senaryo 3: Managed RabbitMQ (Enterprise-Only)

**Toplam: $186/ay**

| Servis             | Spec             | Maliyet     |
| ------------------ | ---------------- | ----------- |
| App Droplet        | 2 vCPU, 4 GB RAM | $24/ay      |
| Worker Droplet     | 4 vCPU, 8 GB RAM | $48/ay      |
| Managed PostgreSQL | 2 vCPU, 4 GB RAM | $60/ay      |
| Managed RabbitMQ   | 1 GB RAM         | $54/ay      |
| **Toplam**         |                  | **$186/ay** |

**Not:** RabbitMQ managed service sadece çok büyük scale'de mantıklı. Küçük-orta projeler için droplet içinde RabbitMQ yeterli (ücretsiz).

**Artıları:**

- ✅ Fully managed
- ✅ RabbitMQ HA + monitoring
- ✅ Zero maintenance

**Eksileri:**

- ❌ Gereksiz yüksek maliyet (RabbitMQ hafif)
- ❌ Sadece enterprise için

---

## Önerilen Strateji: Professional Start

### Başlangıç Yolu (İlk 12 Ay)

**Ay 1-6: Production Setup → $63/ay**

- Managed PostgreSQL (otomatik backup, HA)
- Professional setup from day one
- 99.99% uptime guarantee
- Toplam: $378

**Ay 7-12: Performance Optimization → $78/ay**

- Redis cache eklenir (50+ concurrent users için)
- GraphQL query optimization
- Improved response times
- Toplam: $468

**İlk 12 Ay Toplam: $846**

---

## Neden Bu Strateji?

1. **Professional From Day One**: Otomatik backup, HA, monitoring
2. **Zero Downtime Scaling**: PostgreSQL upgrade tek tıkla
3. **Production Ready**: 99.99% uptime SLA
4. **Easy Management**: Managed service, minimum DevOps
5. **Cost Predictable**: Fixed $63/ay, no surprise bills

**Ne zaman Senaryo 2'ye (Ayrık Worker) geç?**

- CPU kullanımı sürekli >80%
- RabbitMQ queue'lar backing up (>10k messages)
- Günlük 200k+ killmail processing

---

## Ölçeklendirme Yol Haritası

### Başlangıç: Production Setup (0-6 ay) → **$63/ay**

```
Kullanıcı sayısı: 0-500
Günlük killmail: 0-150k
Database: 0-25 GB

Yapı:
- 1x CPU-Optimized Droplet (4 vCPU, 8 GB) - $48/ay
- 1x PostgreSQL Managed Basic (1 GB) - $15/ay
```

**Trigger:** CPU kullanımı sürekli %80+ → Scale-Up

---

### Scale-Up (6-12 ay) → **$132/ay**

```bash
Kullanıcı sayısı: 500-2000
Günlük killmail: 150k-300k
Database: 25-50 GB

Yapı:
- 1x App Droplet (2 vCPU, 4 GB) - $24/ay ← BACKEND + FRONTEND
- 1x Worker Droplet (4 vCPU, 8 GB) - $48/ay ← TÜM WORKERS
- 1x PostgreSQL Professional (2 vCPU, 4 GB) - $60/ay ← UPGRADE
```

**Connection Pool:**

```bash
# App Droplet: Backend + Frontend = 2 processes × 5 = 10 connections
# Worker Droplet: 6 workers × 2 = 12 connections
# Total: 22 connections (Professional plan supports 97)
```

**Trigger:** Worker queue'lar sürekli backing up → Aşama 4

---

### Enterprise (12+ ay) → **$216/ay**

```bash
Kullanıcı sayısı: 2000+
Günlük killmail: 300k+
Database: 50+ GB

Yapı:
- 1x App Droplet (4 vCPU, 8 GB) - $48/ay ← BACKEND + FRONTEND
- 2x Worker Droplet (4 vCPU, 8 GB each) - $96/ay ← SCALE OUT
- 1x PostgreSQL Professional (4 vCPU, 8 GB) - $120/ay ← UPGRADE
- Optional: Redis Cache (1 GB) - $15/ay

Total: $216-231/ay
```

**Not:** Bu noktada revenue $500+/ay olmalı (50+ paying users)

---

## Maliyet Optimizasyon İpuçları

### 1. PostgreSQL Disk Kullanımı

```sql
-- Database boyutunu kontrol et
SELECT pg_size_pretty(pg_database_size('killreport_production'));

-- En büyük tablolar
SELECT
  schemaname || '.' || tablename AS table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### 2. RabbitMQ Memory Optimization

```bash
# RabbitMQ config: /etc/rabbitmq/rabbitmq.conf
vm_memory_high_watermark.relative = 0.6  # Use max 60% RAM
disk_free_limit.absolute = 2GB
```

### 3. PM2 Memory Limits

```javascript
// ecosystem.config.js
max_memory_restart: '1G',  // Restart if > 1GB
```

### 4. Log Rotation

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M   # Max 100MB per log
pm2 set pm2-logrotate:retain 7        # Keep 7 days
pm2 set pm2-logrotate:compress true   # Gzip old logs
```

### 5. Nginx Caching

```nginx
# Static asset caching
location /_next/static {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Alternatif Cloud Providers Karşılaştırması

### DigitalOcean (Şu anki plan)

**Toplam: $63/ay**

- ✅ Kolay setup
- ✅ Managed DB dahil
- ✅ Türkiye'ye yakın datacenter (Frankfurt)
- ⚠️ Limited scaling options

### Hetzner (Daha ucuz)

**Toplam: ~€35/ay (~$38)**

- ✅ Çok ucuz (4 vCPU, 8 GB = €10)
- ✅ NVMe SSD
- ❌ PostgreSQL managed yok (kendin kur)
- ❌ Backup manual
- ⚠️ Türkiye'ye gecikmeli (Finland/Germany)

### AWS (Enterprise)

**Toplam: ~$180/ay**

- ✅ Auto-scaling
- ✅ RDS PostgreSQL
- ✅ Load balancers
- ❌ Pahalı
- ❌ Complex setup

### Vercel + DigitalOcean (Hybrid)

**Toplam: ~$83/ay**

- Vercel: Frontend ($20/ay Pro)
- DigitalOcean: Backend + Workers ($48/ay)
- PostgreSQL Managed ($15/ay)
- ✅ Frontend CDN + auto-scaling
- ✅ Backend manual scale
- ⚠️ İki platform yönetimi

---

## Önerilen Strateji: Hybrid Başlangıç

### Başlangıç Yolu (İlk 6 Ay)

**Ay 1-3: All-in-One Droplet → $48/ay**

- PostgreSQL droplet içinde (localhost)
- Otomatik backup scriptleri
- Perfect MVP testi için
- Toplam: $144

**Ay 4-6: Managed PostgreSQL Ekle → $63/ay**

- Database >3 GB olduğunda migrate et
- İlk ödeme yapan kullanıcı geldiğinde
- Professional reliability için
- Toplam: $189

**İlk 6 Ay Toplam: $333**

---

## Neden Bu Strateji?

1. **Minimum Risk**: İlk 3 ay sadece $144 (droplet + backup storage)
2. **Kolay Geçiş**: PostgreSQL migration sadece 1 saat downtime
3. **Esnek Scaling**: Gerektiğinde hızlıca upgrade
4. **Maliyet-Etkin**: İlk 6 ay $90 tasarruf vs direkt managed DB

**Ne zaman Senaryo 2'ye (Ayrık Worker) geç?**

- CPU kullanımı sürekli >80%
- RabbitMQ queue'lar backing up (>10k messages)
- Günlük 100k+ killmail processing

**İlk 12 ay tahmini maliyet (Önerilen Hybrid Strateji):**

- İlk 3 ay (All-in-One): $48/ay × 3 = $144
- Sonraki 9 ay (Managed DB): $63/ay × 9 = $567
- **Toplam: $711/yıl**

**Alternatif (Managed DB'den Başla):**

- 12 ay: $63/ay × 12 = $756/yıl
