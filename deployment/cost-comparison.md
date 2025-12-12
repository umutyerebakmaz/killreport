# 💰 DigitalOcean Maliyet Karşılaştırması ve Ölçeklendirme Planı

## Senaryo Karşılaştırması

### Senaryo 1: Tek Droplet + Managed DB (Önerilen Başlangıç)

**Toplam: $63/ay**

| Servis                | Spec                         | Maliyet    |
| --------------------- | ---------------------------- | ---------- |
| CPU-Optimized Droplet | 4 vCPU, 8 GB RAM             | $48/ay     |
| Managed PostgreSQL    | 1 vCPU, 1 GB RAM, 10 GB disk | $15/ay     |
| **Toplam**            |                              | **$63/ay** |

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

### Senaryo 2: Ayrık Worker Droplet

**Toplam: $96/ay**

| Servis             | Spec                         | Maliyet     |
| ------------------ | ---------------------------- | ----------- |
| App Droplet        | 2 vCPU, 4 GB RAM             | $24/ay      |
| Worker Droplet     | 4 vCPU, 8 GB RAM             | $48/ay      |
| Managed PostgreSQL | 2 vCPU, 4 GB RAM, 25 GB disk | $60/ay      |
| **Toplam**         |                              | **$132/ay** |

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

### Senaryo 3: Managed RabbitMQ (Lüks)

**Toplam: $186/ay**

| Servis             | Spec             | Maliyet     |
| ------------------ | ---------------- | ----------- |
| App Droplet        | 2 vCPU, 4 GB RAM | $24/ay      |
| Worker Droplet     | 4 vCPU, 8 GB RAM | $48/ay      |
| Managed PostgreSQL | 2 vCPU, 4 GB RAM | $60/ay      |
| Managed RabbitMQ   | 1 GB RAM         | $54/ay      |
| **Toplam**         |                  | **$186/ay** |

**Artıları:**

- ✅ Fully managed
- ✅ RabbitMQ HA + monitoring
- ✅ Zero maintenance

**Eksileri:**

- ❌ Gereksiz yüksek maliyet (RabbitMQ hafif)
- ❌ Sadece enterprise için

---

## Alternatif: Hybrid Yaklaşım (Maliyet/Performans Dengesi)

**Toplam: $78/ay**

| Servis                | Spec                    | Maliyet    |
| --------------------- | ----------------------- | ---------- |
| CPU-Optimized Droplet | 4 vCPU, 8 GB RAM        | $48/ay     |
| Managed PostgreSQL    | 2 vCPU, 2 GB RAM, 15 GB | $30/ay     |
| **Toplam**            |                         | **$78/ay** |

**Not:** PostgreSQL'i bir adım upgrade ederek database connection pooling ve daha iyi performance alırsınız.

---

## Ölçeklendirme Yol Haritası

### Aşama 1: MVP (0-3 ay) → **$63/ay**

```
Kullanıcı sayısı: < 100
Günlük killmail: < 50k
Database: < 10 GB

Yapı:
- 1x CPU-Optimized Droplet (4 vCPU, 8 GB)
- 1x PostgreSQL Basic (1 vCPU, 1 GB)
```

**Trigger:** Database 8 GB'ı geçerse → Aşama 2

---

### Aşama 2: Growth (3-6 ay) → **$78/ay**

```
Kullanıcı sayısı: 100-500
Günlük killmail: 50k-150k
Database: 10-25 GB

Yapı:
- 1x CPU-Optimized Droplet (4 vCPU, 8 GB)
- 1x PostgreSQL Professional (2 vCPU, 2 GB) ← UPGRADE
```

**Trigger:** CPU kullanımı sürekli %80+ → Aşama 3

---

### Aşama 3: Scale-Up (6-12 ay) → **$132/ay**

```
Kullanıcı sayısı: 500-2000
Günlük killmail: 150k-300k
Database: 25-50 GB

Yapı:
- 1x App Droplet (2 vCPU, 4 GB) ← BACKEND + FRONTEND
- 1x Worker Droplet (4 vCPU, 8 GB) ← TÜM WORKERS
- 1x PostgreSQL Professional (2 vCPU, 4 GB) ← UPGRADE
```

**Trigger:** Worker queue'lar sürekli backing up → Aşama 4

---

### Aşama 4: Enterprise (12+ ay) → **$252/ay**

```
Kullanıcı sayısı: 2000+
Günlük killmail: 300k+
Database: 50+ GB

Yapı:
- 1x App Droplet (4 vCPU, 8 GB) ← LOAD BALANCER HAZIR
- 2x Worker Droplet (4 vCPU, 8 GB each) ← SCALE OUT
- 1x PostgreSQL Professional (4 vCPU, 8 GB) ← UPGRADE
```

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

## Önerilen Başlangıç Planı: Senaryo 1

**Neden?**

1. **Maliyet-etkin**: İlk 6 ay için yeterli
2. **Yönetilebilir**: Tek sunucu, PM2 ile kolay monitoring
3. **Esnek**: Gerektiğinde PostgreSQL'i upgrade etmek kolay
4. **Production-ready**: SSL, backups, monitoring dahil

**Ne zaman upgrade?**

- Database 8 GB'ı geçerse → PostgreSQL plan upgrade
- CPU %80+ sustain → Worker droplet ayır
- Frontend traffic artışı → Vercel'e taşı

**İlk 12 ay tahmini maliyet:**

- İlk 6 ay: $63/ay × 6 = $378
- Sonraki 6 ay: $78/ay × 6 = $468 (DB upgrade)
- **Toplam: ~$850/yıl**
