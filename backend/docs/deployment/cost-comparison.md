# 💰 DigitalOcean Cost Comparison and Scaling Plan

## Scenario Comparison

### Scenario 1: Single Droplet + Managed DB (Production Start)

**Total: $63/month**

| Service               | Spec                         | Cost       |
| --------------------- | ---------------------------- | ---------- |
| CPU-Optimized Droplet | 4 vCPU, 8 GB RAM             | $48/month  |
| Managed PostgreSQL    | 1 vCPU, 1 GB RAM, 10 GB disk | $15/month  |
| **Total**             |                              | **$63/mo** |

**Connection Pool:**

```bash
DATABASE_URL="postgresql://user:pass@managed-host:25060/killreport?sslmode=require&connection_limit=2"
# 8 processes × 2 connections = 16 total
# Managed PostgreSQL limit = 25 connections ✅
```

**Capacity:**

- 50,000 killmails/day
- 100 concurrent users
- 10 worker processes
- Database: 10 GB (approximately 1M killmails)

**Pros:**

- ✅ Low cost
- ✅ Easy management (single server)
- ✅ Managed DB automatic backups
- ✅ SSL automatic renewal

**Cons:**

- ⚠️ Single point of failure
- ⚠️ Database scale limited (needs upgrade first)

---

### Scenario 2: Separate Worker Droplet (Scale-Up Ready)

**Total: $132/month**

| Service            | Spec                         | Cost        |
| ------------------ | ---------------------------- | ----------- |
| App Droplet        | 2 vCPU, 4 GB RAM             | $24/month   |
| Worker Droplet     | 4 vCPU, 8 GB RAM             | $48/month   |
| Managed PostgreSQL | 2 vCPU, 4 GB RAM, 25 GB disk | $60/month   |
| **Total**          |                              | **$132/mo** |

**Connection Pool:**

```bash
# App Droplet (2 processes)
DATABASE_URL="postgresql://user:pass@managed-host:25060/killreport?sslmode=require&connection_limit=5"

# Worker Droplet (6 workers)
DATABASE_URL="postgresql://user:pass@managed-host:25060/killreport?sslmode=require&connection_limit=2"

# Total: (2×5) + (6×2) = 22 connections
# Professional PostgreSQL limit = 97 connections ✅
```

**Capacity:**

- 200,000 killmails/day
- 500 concurrent users
- 20 worker processes
- Database: 25 GB (approximately 2.5M killmails)

**Pros:**

- ✅ Worker isolation (backend won't crash)
- ✅ Independent scaling
- ✅ PostgreSQL standby node (HA)
- ✅ Connection pooling

**Cons:**

- ⚠️ Higher cost
- ⚠️ Two server management

---

### Scenario 3: Managed RabbitMQ (Enterprise-Only)

**Total: $186/month**

| Service            | Spec             | Cost        |
| ------------------ | ---------------- | ----------- |
| App Droplet        | 2 vCPU, 4 GB RAM | $24/month   |
| Worker Droplet     | 4 vCPU, 8 GB RAM | $48/month   |
| Managed PostgreSQL | 2 vCPU, 4 GB RAM | $60/month   |
| Managed RabbitMQ   | 1 GB RAM         | $54/month   |
| **Total**          |                  | **$186/mo** |

**Note:** RabbitMQ managed service only makes sense at very large scale. For small-medium projects, RabbitMQ on droplet is sufficient (free).

**Pros:**

- ✅ Fully managed
- ✅ RabbitMQ HA + monitoring
- ✅ Zero maintenance

**Cons:**

- ❌ Unnecessarily high cost (RabbitMQ is lightweight)
- ❌ For enterprise only

---

## Recommended Strategy: Professional Start

### Starting Path (First 12 Months)

**Months 1-6: Production Setup → $63/month**

- Managed PostgreSQL (automatic backups, HA)
- Professional setup from day one
- 99.99% uptime guarantee
- Total: $378

**Months 7-12: Performance Optimization → $78/month**

- Redis cache added (for 50+ concurrent users)
- GraphQL query optimization
- Improved response times
- Total: $468

**First 12 Months Total: $846**

---

## Why This Strategy?

1. **Professional From Day One**: Automatic backups, HA, monitoring
2. **Zero Downtime Scaling**: PostgreSQL upgrade with one click
3. **Production Ready**: 99.99% uptime SLA
4. **Easy Management**: Managed service, minimum DevOps
5. **Cost Predictable**: Fixed $63/month, no surprise bills

**When to switch to Scenario 2 (Separate Worker)?**

- CPU usage consistently >80%
- RabbitMQ queues backing up (>10k messages)
- Daily 200k+ killmail processing

---

## Scaling Roadmap

### Start: Production Setup (0-6 months) → **$63/month**

```
User count: 0-500
Daily killmails: 0-150k
Database: 0-25 GB

Structure:
- 1x CPU-Optimized Droplet (4 vCPU, 8 GB) - $48/month
- 1x PostgreSQL Managed Basic (1 GB) - $15/month
```

**Trigger:** CPU usage consistently 80%+ → Scale-Up

---

### Scale-Up (6-12 months) → **$132/month**

```bash
User count: 500-2000
Daily killmails: 150k-300k
Database: 25-50 GB

Structure:
- 1x App Droplet (2 vCPU, 4 GB) - $24/month ← BACKEND + FRONTEND
- 1x Worker Droplet (4 vCPU, 8 GB) - $48/month ← ALL WORKERS
- 1x PostgreSQL Professional (2 vCPU, 4 GB) - $60/month ← UPGRADE
```

**Connection Pool:**

```bash
# App Droplet: Backend + Frontend = 2 processes × 5 = 10 connections
# Worker Droplet: 6 workers × 2 = 12 connections
# Total: 22 connections (Professional plan supports 97)
```

**Trigger:** Worker queues consistently backing up → Stage 4

---

### Enterprise (12+ months) → **$216/month**

```bash
User count: 2000+
Daily killmails: 300k+
Database: 50+ GB

Structure:
- 1x App Droplet (4 vCPU, 8 GB) - $48/month ← BACKEND + FRONTEND
- 2x Worker Droplet (4 vCPU, 8 GB each) - $96/month ← SCALE OUT
- 1x PostgreSQL Professional (4 vCPU, 8 GB) - $120/month ← UPGRADE
- Optional: Redis Cache (1 GB) - $15/month

Total: $216-231/month
```

**Note:** At this point, revenue should be $500+/month (50+ paying users)

---

## Cost Optimization Tips

### 1. PostgreSQL Disk Usage

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('killreport_production'));

-- Largest tables
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

## Alternative Cloud Providers Comparison

### DigitalOcean (Current plan)

**Total: $63/month**

- ✅ Easy setup
- ✅ Managed DB included
- ✅ Datacenter close to Turkey (Frankfurt)
- ⚠️ Limited scaling options

### Hetzner (Cheaper)

**Total: ~€35/month (~$38)**

- ✅ Very cheap (4 vCPU, 8 GB = €10)
- ✅ NVMe SSD
- ❌ No managed PostgreSQL (setup yourself)
- ❌ Manual backups
- ⚠️ Higher latency to Turkey (Finland/Germany)

### AWS (Enterprise)

**Total: ~$180/month**

- ✅ Auto-scaling
- ✅ RDS PostgreSQL
- ✅ Load balancers
- ❌ Expensive
- ❌ Complex setup

### Vercel + DigitalOcean (Hybrid)

**Total: ~$83/month**

- Vercel: Frontend ($20/month Pro)
- DigitalOcean: Backend + Workers ($48/month)
- PostgreSQL Managed ($15/month)
- ✅ Frontend CDN + auto-scaling
- ✅ Backend manual scale
- ⚠️ Two platform management

---

## Recommended Strategy: Hybrid Start

### Starting Path (First 6 Months)

**Months 1-3: All-in-One Droplet → $48/month**

- PostgreSQL on droplet (localhost)
- Automatic backup scripts
- Perfect for MVP testing
- Total: $144

**Months 4-6: Add Managed PostgreSQL → $63/month**

- Migrate when database >3 GB
- When first paying user arrives
- For professional reliability
- Total: $189

**First 6 Months Total: $333**

---

## Why This Strategy?

1. **Minimum Risk**: First 3 months only $144 (droplet + backup storage)
2. **Easy Migration**: PostgreSQL migration only 1 hour downtime
3. **Flexible Scaling**: Quick upgrade when needed
4. **Cost-Effective**: Save $90 in first 6 months vs direct managed DB

**When to switch to Scenario 2 (Separate Worker)?**

- CPU usage consistently >80%
- RabbitMQ queues backing up (>10k messages)
- Daily 100k+ killmail processing

**First 12 months estimated cost (Recommended Hybrid Strategy):**

- First 3 months (All-in-One): $48/month × 3 = $144
- Next 9 months (Managed DB): $63/month × 9 = $567
- **Total: $711/year**

**Alternative (Start with Managed DB):**

- 12 months: $63/month × 12 = $756/year
