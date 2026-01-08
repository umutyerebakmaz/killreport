# 🚀 KillReport DigitalOcean Deployment Checklist

## Deployment Strategy

**Production Setup:** Droplet + Managed PostgreSQL - **$63/month**

- DigitalOcean Droplet (4 vCPU, 8 GB RAM) - $48/month
- Managed PostgreSQL (1 GB RAM, 10 GB storage, 25 connections) - $15/month

**Stack:**

- Backend: GraphQL Yoga API (Node.js + TypeScript)
- Frontend: Next.js 15 App Router
- Database: PostgreSQL with Prisma ORM
- Queue: RabbitMQ for worker distribution
- Workers: 8 workers for entity enrichment and data sync

Professional infrastructure with automatic backups and high availability.

---

## Pre-Deployment

- [ ] EVE Online Developer Application oluştur (<https://developers.eveonline.com>)

  - [ ] Callback URL: `https://api.your-domain.com/auth/callback`
  - [ ] Client ID ve Secret'i kaydet

- [ ] Domain satın al veya hazırla

  - [ ] `your-domain.com` (Frontend)
  - [ ] `api.your-domain.com` (Backend)

- [ ] DigitalOcean hesabı aç ve ödeme yöntemi ekle

---

## Phase 1: PostgreSQL Managed Database Setup (15 dakika)

- [ ] PostgreSQL Managed Database oluştur

  - [ ] Frankfurt/Amsterdam region seç
  - [ ] Basic plan (1 GB RAM, 10 GB storage, 25 connections)
  - [ ] Database name: `killreport_production`

- [ ] Database connection string'i kopyala
- [ ] Trusted Sources'a droplet IP'sini ekle (droplet oluşturduktan sonra)

**Not:** Database zaten hazır ve çalışır durumda. Migration'lar local'den veya CI/CD pipeline'dan çalıştırılabilir.

---

## Phase 2: Droplet Setup (30 dakika)

- [ ] CPU-Optimized Droplet oluştur (4 vCPU, 8 GB RAM)

  - [ ] Ubuntu 24.04 LTS
  - [ ] Frankfurt FRA1 region
  - [ ] SSH key ekle

- [ ] Droplet'e SSH ile bağlan:

  ```bash
  ssh root@YOUR_DROPLET_IP
  ```

- [ ] Node.js, Yarn, PM2 kurulumları:

  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  sudo npm install -g yarn pm2
  ```

- [ ] RabbitMQ kurulumu:

  ```bash
  sudo apt install -y rabbitmq-server
  sudo systemctl enable rabbitmq-server
  sudo systemctl start rabbitmq-server
  ```

- [ ] Nginx kurulumu:

  ```bash
  sudo apt install -y nginx certbot python3-certbot-nginx
  ```

---

## Phase 3: Application Deployment (45 dakika)

- [ ] Git repository clone:

  ```bash
  cd /var/www
  sudo git clone https://github.com/YOUR_USERNAME/killreport.git
  sudo chown -R $USER:$USER killreport
  cd killreport
  ```

- [ ] Environment variables oluştur:

  - [ ] `backend/.env` dosyası:

    ```bash
    # Managed PostgreSQL connection (use connection_limit=2 for workers)
    DATABASE_URL="postgresql://doadmin:password@managed-host:25060/killreport?sslmode=require&connection_limit=2"
    RABBITMQ_URL="amqp://localhost:5672"
    EVE_CLIENT_ID="your-client-id"
    EVE_CLIENT_SECRET="your-client-secret"
    EVE_CALLBACK_URL="https://yourdomain.com/auth/callback"
    FRONTEND_URL="https://yourdomain.com"
    JWT_SECRET="$(openssl rand -base64 32)"
    PORT=4000
    NODE_ENV=production
    LOG_LEVEL=info
    ```

  - [ ] `frontend/.env.local` dosyası:

    ```bash
    NEXT_PUBLIC_GRAPHQL_URL="https://api.yourdomain.com/graphql"
    NEXT_PUBLIC_WS_URL="wss://api.yourdomain.com/graphql"
    ```

- [ ] Dependencies kurulumu:

  ```bash
  yarn install
  cd backend && yarn install
  cd ../frontend && yarn install
  ```

- [ ] Backend build:

  ```bash
  cd backend
  yarn prisma:generate
  yarn tsc
  ```

- [ ] Frontend build:

  ```bash
  cd frontend
  yarn build
  ```

- [ ] PM2 ile başlat:

  ```bash
  cd /var/www/killreport
  pm2 start ecosystem.config.js --env production
  pm2 save
  pm2 startup
  ```

---

## Phase 4: Nginx & SSL Setup (20 dakika)

- [ ] Nginx config dosyasını kopyala:

  ```bash
  sudo cp deployment/nginx.conf /etc/nginx/sites-available/killreport
  sudo ln -s /etc/nginx/sites-available/killreport /etc/nginx/sites-enabled/
  ```

- [ ] Config'de domain adlarını değiştir:

  ```bash
  sudo nano /etc/nginx/sites-available/killreport
  # 'yourdomain.com' ve 'api.yourdomain.com' placeholder'larını
  # gerçek domain'inizle değiştirin (örn: killreport.com, api.killreport.com)
  ```

- [ ] Nginx test ve restart:

  ```bash
  sudo nginx -t
  sudo systemctl restart nginx
  ```

- [ ] DNS A Records ekle (Domain sağlayıcıdan):

  - `yourdomain.com` → `DROPLET_IP`
  - `api.yourdomain.com` → `DROPLET_IP`
  - `www.yourdomain.com` → `DROPLET_IP` (optional)

- [ ] DNS propagation bekle (5-30 dakika)

  - Test: `dig yourdomain.com +short` (should return droplet IP)

- [ ] SSL certificate al:

  ```bash
  sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com -d www.yourdomain.com
  # Replace 'yourdomain.com' with your actual domain
  ```

- [ ] Nginx config'de HTTPS kısımlarını aktifleştir (uncomment)

---

## Phase 5: Database Trusted Sources (5 dakika)

- [ ] DigitalOcean Console → Databases → killreport_production
- [ ] Settings → Trusted Sources
- [ ] Droplet IP adresini ekle
- [ ] Test et: Droplet'ten `psql $DATABASE_URL` ile bağlan

---

## Phase 6: Verification (15 dakika)

- [ ] Frontend erişilebilir mi? `https://yourdomain.com`
- [ ] Backend health check: `https://api.yourdomain.com/health`
- [ ] GraphQL Yoga Playground: `https://api.yourdomain.com/graphql`

- [ ] PM2 process'leri çalışıyor mu?

  ```bash
  pm2 list
  ```

- [ ] Worker loglarını kontrol et:

  ```bash
  pm2 logs worker-redisq
  pm2 logs worker-characters
  pm2 logs worker-corporations
  pm2 logs worker-alliances
  pm2 logs worker-types
  pm2 logs worker-zkillboard
  pm2 logs worker-user-killmails
  ```

- [ ] RabbitMQ çalışıyor mu?

  ```bash
  sudo systemctl status rabbitmq-server
  ```

- [ ] EVE SSO login test et:
  - Frontend'e git → Login butonuna tıkla
  - EVE SSO'ya yönlendir
  - Callback sonrası token alındı mı kontrol et

---

## Phase 7: Initial Data Seeding (Opsiyonel - 30 dakika)

**Worker Sistemi:**

- **worker-redisq**: zKillboard RedisQ real-time stream (otomatik başlar)
- **worker-characters**: Karakter bilgilerini ESI'dan çeker (10 concurrent)
- **worker-corporations**: Corporation bilgilerini çeker (5 concurrent)
- **worker-alliances**: Alliance bilgilerini çeker (3 concurrent)
- **worker-types**: Ship/item type bilgilerini çeker (10 concurrent)
- **worker-zkillboard**: zKillboard character killmail sync (1 concurrent)
- **worker-user-killmails**: ESI üzerinden kullanıcı killmail'lerini çeker
- **worker-bulk-alliances**: Tüm alliance listesini sync eder (manuel)
- **worker-bulk-corporations**: Tüm corporation listesini sync eder (manuel)

**PM2'de çalışan worker'lar:** ecosystem.config.js ile birlikte ilk 7 worker otomatik başlar. Bulk worker'lar manuel başlatılır.

- [ ] Alliance ve Corporation listelerini sync et (opsiyonel, ilk setup için):

  ```bash
  cd /var/www/killreport/backend
  yarn queue:alliances
  ```

- [ ] Worker'lar otomatik olarak çalışıyor, PM2 logs ile izle:

  ```bash
  pm2 logs worker-alliances
  pm2 logs worker-corporations
  ```

---

## Post-Deployment

- [ ] Monitoring setup:

  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 100M
  pm2 set pm2-logrotate:retain 7
  ```

- [ ] Firewall kuralları (UFW):

  ```bash
  sudo ufw allow 22/tcp   # SSH
  sudo ufw allow 80/tcp   # HTTP
  sudo ufw allow 443/tcp  # HTTPS
  sudo ufw enable
  ```

- [ ] Droplet snapshot al (ilk çalışan durumu kaydet)

- [ ] PostgreSQL backup test et:

  ```bash
  pg_dump "$DATABASE_URL" > test_backup.sql
  ```

---

## Maintenance Schedule

### Günlük

- [ ] `pm2 list` ile process health check
- [ ] `df -h` ile disk kullanımı kontrol

### Haftalık

- [ ] `pm2 logs --lines 100` ile error loglarını gözden geçir
- [ ] PostgreSQL backup kontrolü (DigitalOcean otomatik)

### Aylık

- [ ] `sudo apt update && sudo apt upgrade -y`
- [ ] Droplet snapshot al
- [ ] Database boyutu kontrol et → Gerekirse plan upgrade

---

## Troubleshooting Commands

```bash
# PM2 restart all
pm2 restart all

# Backend logs
pm2 logs backend --lines 200

# Worker logs
pm2 logs worker-characters --lines 100

# RabbitMQ status
sudo rabbitmqctl list_queues

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Database connection test
psql "$DATABASE_URL" -c "SELECT version();"

# Disk space
df -h

# Memory usage
free -h

# Network connections
ss -tulpn
```

---

## Scaling Triggers

Scale PostgreSQL to 4 GB when:

- [ ] Database size > 5 GB
- [ ] Connection pool constantly maxed out
- [ ] Query response times > 500ms consistently

Add Worker Droplet when:

- [ ] PM2 CPU usage > 80% sustained
- [ ] RabbitMQ queues backing up (> 10k messages)
- [ ] Processing > 100k killmails/day

---

## Emergency Rollback

```bash
# Stop all PM2 processes
pm2 stop all

# Checkout previous git commit
cd /var/www/killreport
git log --oneline -10
git checkout <previous_commit_hash>

# Rebuild
cd backend && yarn tsc
cd ../frontend && yarn build

# Restart (zero-downtime with cluster mode)
cd ..
pm2 reload all

# Or restart all (brief downtime)
pm2 restart all
```
