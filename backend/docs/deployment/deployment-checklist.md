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

- [ ] Create EVE Online Developer Application (<https://developers.eveonline.com>)
  - [ ] Callback URL: `https://api.your-domain.com/auth/callback`
  - [ ] Save Client ID and Secret

- [ ] Purchase or prepare domain
  - [ ] `your-domain.com` (Frontend)
  - [ ] `api.your-domain.com` (Backend)

- [ ] Open DigitalOcean account and add payment method

---

## Phase 1: PostgreSQL Managed Database Setup (15 minutes)

- [ ] Create PostgreSQL Managed Database
  - [ ] Select Frankfurt/Amsterdam region
  - [ ] Basic plan (1 GB RAM, 10 GB storage, 25 connections)
  - [ ] Database name: `killreport_production`

- [ ] Copy database connection string
- [ ] Add droplet IP to Trusted Sources (after creating droplet)

**Note:** Database is ready and running. Migrations can be run from local or CI/CD pipeline.

---

## Phase 2: Droplet Setup (30 minutes)

- [ ] Create CPU-Optimized Droplet (4 vCPU, 8 GB RAM)
  - [ ] Ubuntu 24.04 LTS
  - [ ] Frankfurt FRA1 region
  - [ ] Add SSH key

- [ ] SSH to droplet:

  ```bash
  ssh root@YOUR_DROPLET_IP
  ```

- [ ] Install Node.js and Yarn:

  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  sudo corepack enable
  ```

- [ ] Install RabbitMQ:

  ```bash
  sudo apt install -y rabbitmq-server
  sudo systemctl enable rabbitmq-server
  sudo systemctl start rabbitmq-server
  ```

- [ ] Install Nginx:

  ```bash
  sudo apt install -y nginx certbot python3-certbot-nginx
  ```

---

## Phase 3: Application Deployment (45 minutes)

- [ ] Clone Git repository:

  ```bash
  cd /var/www
  sudo useradd --system --create-home --shell /usr/sbin/nologin killreport
  sudo git clone https://github.com/YOUR_USERNAME/killreport.git
  # The service user owns the checkout; run git and yarn in it with sudo -u killreport
  sudo chown -R killreport: killreport
  cd killreport
  ```

- [ ] Create environment variables:
  - [ ] `backend/.env` file:

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

  - [ ] `frontend/.env.local` file:

    ```bash
    NEXT_PUBLIC_GRAPHQL_URL="https://api.yourdomain.com/graphql"
    NEXT_PUBLIC_WS_URL="wss://api.yourdomain.com/graphql"
    ```

- [ ] Install dependencies:

  ```bash
  sudo -u killreport yarn install
  cd backend && sudo -u killreport yarn install
  cd ../frontend && sudo -u killreport yarn install
  ```

- [ ] Backend build:

  ```bash
  cd backend
  sudo -u killreport yarn prisma:generate
  sudo -u killreport yarn tsc
  ```

- [ ] Frontend build:

  ```bash
  cd frontend
  sudo -u killreport yarn build
  ```

- [ ] Install, enable and start the systemd units. Follow "Install and update",
      "Enable" and "Server setup" in [systemd.md](../ops/systemd.md), then:

  ```bash
  sudo systemctl start killreport.target
  ```

---

## Phase 4: Nginx & SSL Setup (20 minutes)

- [ ] Copy Nginx config file:

  ```bash
  sudo cp deployment/nginx.conf /etc/nginx/sites-available/killreport
  sudo ln -s /etc/nginx/sites-available/killreport /etc/nginx/sites-enabled/
  ```

- [ ] Change domain names in config:

  ```bash
  sudo nano /etc/nginx/sites-available/killreport
  # Replace 'yourdomain.com' and 'api.yourdomain.com' placeholders
  # with your actual domain (e.g., killreport.com, api.killreport.com)
  ```

- [ ] Test Nginx and restart:

  ```bash
  sudo nginx -t
  sudo systemctl restart nginx
  ```

- [ ] Add DNS A Records (from domain provider):
  - `yourdomain.com` → `DROPLET_IP`
  - `api.yourdomain.com` → `DROPLET_IP`
  - `www.yourdomain.com` → `DROPLET_IP` (optional)

- [ ] Wait for DNS propagation (5-30 minutes)
  - Test: `dig yourdomain.com +short` (should return droplet IP)

- [ ] Get SSL certificate:

  ```bash
  sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com -d www.yourdomain.com
  # Replace 'yourdomain.com' with your actual domain
  ```

- [ ] Activate HTTPS sections in Nginx config (uncomment)

---

## Phase 5: Database Trusted Sources (5 minutes)

- [ ] DigitalOcean Console → Databases → killreport_production
- [ ] Settings → Trusted Sources
- [ ] Add droplet IP address
- [ ] Test: Connect from droplet with `psql $DATABASE_URL`

---

## Phase 6: Verification (15 minutes)

- [ ] Is frontend accessible? `https://yourdomain.com`
- [ ] Backend health check: `https://api.yourdomain.com/health`
- [ ] GraphQL Yoga Playground: `https://api.yourdomain.com/graphql`

- [ ] Are the systemd units running?

  ```bash
  systemctl list-units 'killreport-*'
  ```

- [ ] Check worker logs:

  ```bash
  journalctl -u killreport-worker-redisq -f
  journalctl -u killreport-worker-characters -f
  journalctl -u killreport-worker-corporations -f
  journalctl -u killreport-worker-alliances -f
  journalctl -u killreport-worker-types -f
  journalctl -u killreport-worker-zkillboard -f
  journalctl -u killreport-worker-user-killmails -f
  ```

- [ ] Is RabbitMQ running?

  ```bash
  sudo systemctl status rabbitmq-server
  ```

- [ ] Test EVE SSO login:
  - Go to frontend → Click Login button
  - Redirect to EVE SSO
  - Check if token received after callback

---

## Phase 7: Initial Data Seeding (Optional - 30 minutes)

**Worker System:**

- **worker-redisq**: zKillboard RedisQ real-time stream (auto-starts)
- **worker-characters**: Fetches character info from ESI (10 concurrent)
- **worker-corporations**: Fetches corporation info (5 concurrent)
- **worker-alliances**: Fetches alliance info (3 concurrent)
- **worker-types**: Fetches ship/item type info (10 concurrent)
- **worker-zkillboard**: zKillboard character killmail sync (1 concurrent)
- **worker-user-killmails**: Fetches user killmails via ESI
- **worker-bulk-alliances**: Syncs all alliance list (manual)
- **worker-bulk-corporations**: Syncs all corporation list (manual)

**Workers running under systemd:** the long-running workers start with `killreport.target`. Bulk workers are manually started.

- [ ] Sync alliance and corporation lists (optional, for initial setup):

  ```bash
  cd /var/www/killreport/backend
  yarn queue:alliances
  ```

- [ ] Workers run automatically, watch with journald:

  ```bash
  journalctl -u killreport-worker-alliances -f
  journalctl -u killreport-worker-corporations -f
  ```

---

## Post-Deployment

- [ ] Setup monitoring:

  ```bash
  # Logs are kept by journald; set SystemMaxUse= in /etc/systemd/journald.conf
  # (see systemd.md, "Daily commands")
  systemd-cgtop
  ```

- [ ] Firewall rules (UFW):

  ```bash
  sudo ufw allow 22/tcp   # SSH
  sudo ufw allow 80/tcp   # HTTP
  sudo ufw allow 443/tcp  # HTTPS
  sudo ufw enable
  ```

- [ ] Take droplet snapshot (save first working state)

- [ ] Test PostgreSQL backup:

  ```bash
  pg_dump "$DATABASE_URL" > test_backup.sql
  ```

---

## Maintenance Schedule

### Daily

- [ ] Process health check with `systemctl list-units 'killreport-*'`
- [ ] Check disk usage with `df -h`

### Weekly

- [ ] Review error logs with `journalctl -u 'killreport-*' -p err --since '7 days ago'`
- [ ] PostgreSQL backup check (DigitalOcean automatic)

### Monthly

- [ ] `sudo apt update && sudo apt upgrade -y`
- [ ] Take droplet snapshot
- [ ] Check database size → Upgrade plan if needed

---

## Troubleshooting Commands

```bash
# Restart all
sudo systemctl restart killreport.target

# Backend logs
journalctl -u killreport-backend -n 200

# Worker logs
journalctl -u killreport-worker-characters -n 100

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

- [ ] CPU usage > 80% sustained
- [ ] RabbitMQ queues backing up (> 10k messages)
- [ ] Processing > 100k killmails/day

---

## Emergency Rollback

```bash
# Stop all application processes
sudo systemctl stop killreport.target

# Checkout previous git commit
cd /var/www/killreport
git log --oneline -10
git checkout <previous_commit_hash>

# Rebuild
cd backend && yarn tsc
cd ../frontend && yarn build

# Restart
cd ..
sudo systemctl start killreport.target
```
