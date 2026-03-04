# KillReport Deployment Documentation

## 📚 Documentation Index

### 1. [Digital Ocean Setup Guide](DIGITALOCEAN_SETUP.MD) - **START HERE**

Complete step-by-step deployment guide:

- Production setup with Managed PostgreSQL ($63/month)
- Includes server setup, environment configuration, SSL, monitoring
- Automatic backups and high availability from day one

### 2. [Cost Comparison](COST_COMPARISON.MD)

Detailed cost analysis and scaling roadmap:

- 3 deployment scenarios compared
- Phase-by-phase scaling strategy (MVP → Growth → Scale-Up → Enterprise)
- Connection pool calculations for each scenario
- Break-even analysis and ROI projections

### 3. [Deployment Checklist](DEPLOYMENT_CHECKLIST.MD)

Production deployment checklist with verification steps:

- Pre-deployment requirements
- 7 deployment phases with time estimates
- Health check procedures
- Troubleshooting commands
- Maintenance schedule

### 4. [Nginx Configuration](nginx.conf)

Production-ready Nginx config with:

- Backend GraphQL API proxy
- Frontend Next.js SSR proxy
- WebSocket support for subscriptions
- SSL/HTTPS configuration (Let's Encrypt)
- Security headers and caching rules

---

## 🎯 Quick Start

### Production Setup

```bash
# Total Cost: $63/month
# Managed PostgreSQL (automatic backups, HA)
# Professional setup from day one
```

**Follow:** [DIGITALOCEAN_SETUP.MD](DIGITALOCEAN_SETUP.MD)

---

## 💰 Cost Summary

| Phase               | Duration    | Infrastructure          | Monthly Cost | Total    |
| ------------------- | ----------- | ----------------------- | ------------ | -------- |
| **Production**      | Months 1-6  | Managed PostgreSQL      | $63          | $378     |
| **+ Redis Cache**   | Months 7-12 | Performance Layer       | $78          | $468     |
| **+ Scale Workers** | When needed | Separate Worker Droplet | $132         | -        |
| **6 Month Total**   |             |                         |              | **$378** |
| **12 Month Total**  |             |                         |              | **$846** |

---

## 🔧 Technical Specifications

### Production Setup: Managed PostgreSQL ($63/month)

- Database: <3 GB

---

### Phase 2: Managed Database ($63/month)

**Droplet:** Same as Phase 1

**Managed PostgreSQL:**

- 1 GB RAM, 10 GB Storage
- 25 connection limit
- Automatic daily backups (7 days)
- High availability

**Connection Pool:**

```bash
DATABASE_URL="postgresql://user:pass@managed-host:25060/killreport?sslmode=require&connection_limit=2"
# 8 processes × 2 = 16 connections
# Managed limit = 25 ✅
```

**Capacity:**

- 100,000 killmails/day
- 200 concurrent users
- Database: 3-10 GB

---

## 🚀 Migration Triggers

### Phase 1 → Phase 2 (Add Managed PostgreSQL)

Migrate when **any** of these conditions are met:

- ✅ Database size exceeds 3 GB
- ✅ First paying subscriber acquired
- ✅ Daily killmail ingestion >10,000
- ✅ Need 99.99% uptime guarantee

**Migration Time:** ~1 hour
**Downtime:** ~5 minutes

### Phase 2 → Phase 3 (Add Performance Layer)

Add Redis cache when:

- ✅ 50+ concurrent users
- ✅ GraphQL query times >500ms
- ✅ Repeated queries causing database load

**Cost:** +$15/month (Redis Basic 1 GB)
**Downtime:** None (hot-add)

### Phase 3 → Scale-Up (Split Workers)

Separate worker droplet when:

- ✅ CPU usage sustained >80%
- ✅ RabbitMQ queues backing up (>10k messages)
- ✅ Processing >100k killmails/day

**Cost:** +$69/month (additional droplet + PostgreSQL upgrade)
**Downtime:** ~30 minutes

---

## 📊 Process Architecture

### PM2 Ecosystem (8 Processes)

```
1. backend          → GraphQL API (port 4000)
2. frontend         → Next.js SSR (port 3000)
3. worker-redisq    → Real-time zKillboard stream
4. worker-characters → Character info enrichment (prefetch: 5)
5. worker-corporations → Corp info enrichment (prefetch: 5)
6. worker-alliances → Alliance info enrichment (prefetch: 3)
7. worker-types     → Ship/module info (prefetch: 10)
8. worker-zkillboard → Character history sync (prefetch: 1)

Bulk workers (manual start):
9. worker-bulk-alliances
10. worker-bulk-corporations
```

### Connection Pool Distribution

**Phase 1 (Localhost):**

- Each process: 5 connections
- Total: 8 × 5 = 40
- PostgreSQL limit: 100 ✅

**Phase 2 (Managed):**

- Each process: 2 connections
- Total: 8 × 2 = 16
- Managed limit: 25 ✅

---

## 🔒 Security Checklist

- [ ] Firewall enabled (UFW): Only ports 22, 80, 443
- [ ] SSH key-only authentication (password auth disabled)
- [ ] PostgreSQL: Strong password (16+ chars)
- [ ] JWT secret: Random 32+ characters
- [ ] RabbitMQ: Guest user disabled
- [ ] Nginx: Security headers enabled
- [ ] SSL: Let's Encrypt auto-renewal configured
- [ ] Environment variables not in git
- [ ] Database trusted sources limited to droplet IP

---

## 📈 Performance Targets

### Phase 1 Goals (Months 1-3)

- [ ] 100+ registered users
- [ ] 10,000+ killmails in database
- [ ] <50ms average GraphQL query time
- [ ] 99% uptime
- [ ] Database <3 GB

### Phase 2 Goals (Months 4-6)

- [ ] First paying subscriber
- [ ] 500+ registered users
- [ ] 50,000+ killmails
- [ ] 99.9% uptime
- [ ] Database 3-10 GB

### Phase 3 Goals (Months 7-12)

- [ ] 25+ paying subscribers ($250/month revenue)
- [ ] 2,000+ registered users
- [ ] 200,000+ killmails
- [ ] 99.99% uptime
- [ ] Profitable (revenue > costs)

---

## 🛠️ Common Operations

### Update Application

```bash
cd /var/www/killreport
git pull origin main
yarn install
cd backend && yarn build
cd ../frontend && yarn build
cd ..
pm2 restart all
```

### Check Logs

```bash
pm2 logs backend --lines 100
pm2 logs worker-characters --lines 50
pm2 logs --err  # Only errors
```

### Monitor Resources

```bash
pm2 monit           # Real-time monitoring
df -h               # Disk usage
free -h             # Memory usage
htop                # CPU/RAM by process
```

### Database Operations

```bash
# Phase 1 (Localhost)
sudo -u postgres psql killreport

# Phase 2 (Managed)
psql "$DATABASE_URL"

# Check size
SELECT pg_size_pretty(pg_database_size('killreport'));

# Check connections
SELECT count(*) FROM pg_stat_activity;
```

### RabbitMQ Operations

```bash
sudo rabbitmqctl list_queues name messages consumers
sudo rabbitmqctl list_connections
sudo rabbitmqctl purge_queue esi_character_info_queue  # Clear queue
```

---

## 🚨 Emergency Procedures

### Database Connection Limit Reached

```bash
# Quick fix: Lower connection pool
# Edit backend/.env
DATABASE_URL="...?connection_limit=1"  # Reduce from 2 to 1

pm2 restart all
```

### Out of Disk Space

```bash
# Phase 1: Clean old backups
find /backup/postgres -name "*.sql.gz" -mtime +7 -delete

# Clean logs
pm2 flush
journalctl --vacuum-time=7d

# Clean old Docker images (if using)
docker system prune -a
```

### Worker Not Processing

```bash
# Check queue
sudo rabbitmqctl list_queues

# Restart specific worker
pm2 restart worker-characters

# Check logs
pm2 logs worker-characters --lines 100 --err
```

### SSL Certificate Renewal Failed

```bash
# Manual renewal
sudo certbot renew --force-renewal

# Check nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## 📞 Support Resources

- **DigitalOcean Docs:** https://docs.digitalocean.com
- **PostgreSQL 16 Docs:** https://www.postgresql.org/docs/16/
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/
- **Nginx Docs:** https://nginx.org/en/docs/
- **EVE ESI Docs:** https://docs.esi.evetech.net/
- **RabbitMQ Docs:** https://www.rabbitmq.com/documentation.html

---

## 📝 Changelog

### 2025-01-24

- Updated connection pool calculations for all phases
- Added Phase 1 (All-in-One) deployment option
- Corrected cost calculations across all scenarios
- Added migration triggers and procedures
- Updated nginx.conf with security headers
- Standardized domain placeholders to `yourdomain.com`

---

## ✅ Pre-Launch Checklist

- [ ] All documentation reviewed
- [ ] EVE Developer Application created
- [ ] Domain purchased and configured
- [ ] DigitalOcean account created
- [ ] SSH key generated and added
- [ ] Payment method verified
- [ ] Backup strategy tested
- [ ] Monitoring alerts configured
- [ ] Team has access to all credentials
- [ ] Rollback plan documented

**Estimated Total Setup Time:** 4-6 hours for Phase 1

---

**Last Updated:** December 24, 2025
**Version:** 2.0
**Maintained by:** KillReport Team
