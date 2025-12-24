# KillReport Production Deployment Guide

## 🎯 Deployment Strategy

### Phase 1: Initial Launch (Month 1-3) - $48/month

- Single DigitalOcean Droplet with PostgreSQL inside
- Minimal risk, perfect for testing and first users
- Manual backups with automated scripts

### Phase 2: Growth Phase (Month 4-6) - $63/month

- Add Managed PostgreSQL when database >3GB
- Triggered by: first paying users or 10k+ daily killmails
- Professional setup with automatic backups

### Phase 3: Scale Phase (Month 7+) - $78-88/month

- Add Redis cache for performance
- Optional CDN for static assets
- Enterprise-ready infrastructure

---

## 💰 Phase 1: Initial Deployment ($48/month)

### Infrastructure Setup

**DigitalOcean Droplet:**

- **Size:** Basic (4 vCPU, 8 GB RAM, 160 GB SSD)
- **Cost:** $48/month (~₺1,750/month)
- **OS:** Ubuntu 22.04 LTS
- **Services:** Backend + Frontend + Workers + PostgreSQL (all-in-one)

**Why this approach?**

- ✅ $15/month savings (first 6 months = $90 saved)
- ✅ Localhost database connection (faster)
- ✅ Simpler setup, less moving parts
- ✅ Perfect for MVP and early users

### Step 1: Create Droplet

```bash
# DigitalOcean Console:
1. Create Droplet
2. Choose: Basic (4 vCPU, 8 GB RAM)
3. Region: Frankfurt (closest to EVE servers)
4. OS: Ubuntu 22.04 LTS
5. Add SSH key
6. Enable backups (+20% cost, optional but recommended)
```

### Step 2: Initial Server Setup

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PostgreSQL 16
apt install -y postgresql-16 postgresql-contrib

# Install PM2 globally
npm install -g pm2 yarn

# Install Nginx
apt install -y nginx certbot python3-certbot-nginx

# Install RabbitMQ
apt install -y rabbitmq-server
systemctl enable rabbitmq-server
systemctl start rabbitmq-server

# Enable RabbitMQ management plugin
rabbitmq-plugins enable rabbitmq_management
```

### Step 3: PostgreSQL Configuration

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE killreport;
CREATE USER killreport WITH PASSWORD 'your-secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE killreport TO killreport;
ALTER DATABASE killreport OWNER TO killreport;
\q

# Configure PostgreSQL for remote connections (optional, for local dev access)
nano /etc/postgresql/16/main/postgresql.conf
# Set: listen_addresses = '*'

nano /etc/postgresql/16/main/pg_hba.conf
# Add: host    killreport    killreport    your-dev-ip/32    md5

# Restart PostgreSQL
systemctl restart postgresql
```

# Restart PostgreSQL

systemctl restart postgresql

````

**Connection Pool Configuration:**
```bash
# With localhost PostgreSQL, we can use more connections
DATABASE_URL="postgresql://killreport:password@localhost:5432/killreport?connection_limit=5"

# Calculation:
# 8 processes (backend + frontend + 6 workers) × 5 = 40 connections
# PostgreSQL default max_connections = 100 ✅
# 60 connections reserved for bulk workers and maintenance
````

### Step 4: Automated Backup System

```bash
# Create backup directory
mkdir -p /backup/postgres

# Create backup script
cat > /usr/local/bin/postgres-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/postgres"
RETENTION_DAYS=7

# Dump database
pg_dump -U killreport killreport | gzip > $BACKUP_DIR/killreport-$DATE.sql.gz

# Remove old backups
find $BACKUP_DIR -name "killreport-*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Optional: Upload to DigitalOcean Spaces (S3-compatible)
# s3cmd put $BACKUP_DIR/killreport-$DATE.sql.gz s3://your-bucket/backups/
EOF

chmod +x /usr/local/bin/postgres-backup.sh

# Add to crontab (daily at 3 AM)
crontab -e
# Add: 0 3 * * * /usr/local/bin/postgres-backup.sh
```

**Optional: DigitalOcean Spaces Integration ($5/month for 250 GB)**

```bash
# Install s3cmd
apt install -y s3cmd

# Configure with DigitalOcean Spaces credentials
s3cmd --configure
# Access Key: Your Spaces key
# Secret Key: Your Spaces secret
# S3 Endpoint: fra1.digitaloceanspaces.com (or your region)
```

### Step 5: Deploy Application

```bash
# Create deployment directory
mkdir -p /var/www/killreport
cd /var/www/killreport

# Clone repository
git clone https://github.com/umutyerebakmaz/killreport.git .

# Install dependencies
yarn install

# Configure environment (backend)
cat > backend/.env << EOF
# Database (localhost for Phase 1)
DATABASE_URL="postgresql://killreport:your-password@localhost:5432/killreport?connection_limit=5"

# RabbitMQ
RABBITMQ_URL="amqp://localhost:5672"

# EVE SSO
EVE_CLIENT_ID="your-client-id"
EVE_CLIENT_SECRET="your-client-secret"
EVE_CALLBACK_URL="https://yourdomain.com/auth/callback"

# JWT
JWT_SECRET="$(openssl rand -base64 32)"

# Server
PORT=4000
NODE_ENV=production
FRONTEND_URL="https://yourdomain.com"
EOF

# Configure environment (frontend)
cat > frontend/.env.local << EOF
NEXT_PUBLIC_GRAPHQL_URL="https://api.yourdomain.com/graphql"
NEXT_PUBLIC_WS_URL="wss://api.yourdomain.com/graphql"
EOF

# Build backend
cd backend
yarn install
yarn prisma:generate
yarn prisma:migrate deploy
yarn build

# Build frontend
cd ../frontend
yarn install
yarn build

# Start with PM2 (from root)
cd ..
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 6: Performance Tuning (PostgreSQL)

```bash
# Edit PostgreSQL config
nano /etc/postgresql/16/main/postgresql.conf

# For 8 GB RAM droplet, optimize:
shared_buffers = 2GB                 # 25% of RAM
effective_cache_size = 6GB           # 75% of RAM
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1               # For SSD
effective_io_concurrency = 200       # For SSD
work_mem = 10MB                      # Per connection
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 100                # Default, enough for Phase 1

# Restart PostgreSQL
systemctl restart postgresql
```

### Step 7: Nginx Configuration

```bash
# Backend API
cat > /etc/nginx/sites-available/api.yourdomain.com << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Frontend
cat > /etc/nginx/sites-available/yourdomain.com << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable sites
ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/

# Test and reload
nginx -t
systemctl reload nginx

# Setup SSL certificates
certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

### Step 8: Monitoring Setup

```bash
# Install monitoring tools
pm2 install pm2-logrotate

# Configure log rotation (keep 7 days)
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:max_size 100M

# View logs
pm2 logs              # All processes
pm2 logs backend      # Backend only
pm2 logs worker-characters  # Specific worker

# Monitor resources
pm2 monit
```

---

## 💰 Phase 2: Growth Phase ($63/month)

**Trigger Migration When:**

- ✅ Database size exceeds 3 GB
- ✅ Daily killmail ingestion >10,000
- ✅ First paying subscriber
- ✅ Consistent uptime needed (99.99%)

### Step 1: Create Managed PostgreSQL

```bash
# DigitalOcean Console:
1. Databases → Create Database
2. Engine: PostgreSQL 16
3. Plan: Basic ($15/month)
   - 1 GB RAM, 10 GB Storage, 25 connections
4. Region: Same as droplet (Frankfurt)
5. Database name: killreport
```

**Get Connection Details:**

```bash
# DigitalOcean provides:
Host: your-db-cluster.db.ondigitalocean.com
Port: 25060
Username: doadmin
Password: auto-generated
Database: defaultdb
```

**Configure Trusted Sources:**

```bash
# DigitalOcean Console:
1. Database → Settings → Trusted Sources
2. Add droplet IP address
3. Optional: Add your local IP for remote access (TablePlus, DBeaver)
   - Get your IP: https://www.whatismyip.com
4. ⚠️ Never use 0.0.0.0/0 in production
```

### Step 2: Migrate Data

```bash
# Backup current database
pg_dump -U killreport killreport > /tmp/killreport-migration.sql

# Restore to managed database
psql "postgresql://doadmin:password@your-db-cluster.db.ondigitalocean.com:25060/defaultdb?sslmode=require" < /tmp/killreport-migration.sql
```

### Step 3: Update Configuration

```bash
# Update backend/.env
DATABASE_URL="postgresql://doadmin:password@your-db-cluster.db.ondigitalocean.com:25060/killreport?sslmode=require&connection_limit=2"

# Connection pool recalculation:
# 8 processes × 2 connections = 16 connections
# Managed PostgreSQL Basic limit = 25 connections ✅
# 9 connections reserved for bulk workers and maintenance
```

### Step 4: Restart Services

```bash
cd /var/www/killreport
pm2 restart all
pm2 save
```

### Step 5: Cleanup Old PostgreSQL (Optional)

```bash
# Stop local PostgreSQL
systemctl stop postgresql
systemctl disable postgresql

# Free up ~2 GB RAM for application
# Keep /backup/postgres for safety (delete after 1 month)
```

---

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Application health
pm2 status

# Database connection check (Phase 1)
psql -U killreport -d killreport -c "SELECT version();"

# Database connection check (Phase 2)
psql "$DATABASE_URL" -c "SELECT version();"

# RabbitMQ queue status
rabbitmqctl list_queues name messages consumers

# Disk usage
df -h
du -sh /var/www/killreport
du -sh /backup/postgres  # Phase 1 only
```

### Performance Monitoring

```bash
# PostgreSQL performance (Phase 1)
sudo -u postgres psql killreport -c "
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Managed PostgreSQL (Phase 2)
# Use DigitalOcean dashboard → Metrics tab
```

### Log Analysis

```bash
# Backend errors
pm2 logs backend --lines 100 --err

# Worker queue processing
pm2 logs worker-characters --lines 50

# Nginx access logs
tail -f /var/log/nginx/access.log

# PostgreSQL logs (Phase 1)
tail -f /var/log/postgresql/postgresql-16-main.log
```

---

## 🔄 Deployment Updates

```bash
# Pull latest changes
cd /var/www/killreport
git pull origin main

# Install new dependencies
yarn install

# Rebuild backend
cd backend
yarn build

# Rebuild frontend
cd ../frontend
yarn build

# Run migrations if needed
cd ../backend
yarn prisma:migrate deploy

# Restart services
cd ..
pm2 restart all

# Zero-downtime restart (advanced)
pm2 reload all
```

---

## 🚨 Disaster Recovery

### Phase 1: Restore from Backup

```bash
# List available backups
ls -lh /backup/postgres/

# Restore specific backup
gunzip -c /backup/postgres/killreport-20250124_030001.sql.gz | psql -U killreport killreport

# If using DigitalOcean Spaces
s3cmd get s3://your-bucket/backups/killreport-20250124_030001.sql.gz /tmp/
gunzip -c /tmp/killreport-20250124_030001.sql.gz | psql -U killreport killreport
```

### Phase 2: Managed Database Recovery

```bash
# DigitalOcean provides:
# - Automatic daily backups (7 day retention)
# - Point-in-time recovery
# - Restore via Console → Database → Backups → Restore
```

---

## 💡 Cost Optimization Tips

1. **Start with Phase 1** - Save $90 in first 6 months
2. **Enable droplet backups** (+$9.60/month) instead of Spaces ($5/month) if you don't need off-site storage
3. **Monitor database size** - Migrate to Phase 2 only when needed
4. **Use PM2 clustering** for Node.js instead of more droplets
5. **Implement caching** before scaling infrastructure

---

## 📈 Scaling Checklist

**Migration to Phase 2 (Managed PostgreSQL):**

- [ ] Database size >3 GB
- [ ] Consistent 99.9% uptime needed
- [ ] First paying users acquired
- [ ] Revenue covers infrastructure costs

**Add Redis Cache (Phase 3):**

- [ ] 50+ concurrent users
