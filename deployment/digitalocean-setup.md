# KillReport Production Deployment Guide

## 🎯 Deployment Overview

### Production Setup - $63/month

- DigitalOcean Droplet (4 vCPU, 8 GB RAM) - $48/month
- Managed PostgreSQL (1 GB RAM, 10 GB storage) - $15/month
- Professional setup from day one with automatic backups

### Scale-Up Options (When Needed)

- Upgrade to 16 GB RAM (+$36/month) for 50+ concurrent users (500-1,000 daily)
- Separate Worker Droplet (+$69/month) for high load
- Upgrade PostgreSQL for larger databases

**User Capacity Guidelines:**

- 8GB Droplet: 20-30 concurrent (200-600 daily, 600-1,800 monthly)
- 16GB Droplet: 50-80 concurrent (500-1,600 daily, 1,500-4,800 monthly)

---

## 💰 Step-by-Step Deployment

### Infrastructure Components

**DigitalOcean Droplet:**

- **Size:** Basic (4 vCPU, 8 GB RAM, 160 GB SSD)
- **Cost:** $48/month (~₺1,750/month)
- **OS:** Ubuntu 22.04 LTS
- **Region:** Frankfurt (closest to EVE servers)
- **Services:** Backend GraphQL Yoga + Next.js Frontend + 6 Workers + RabbitMQ

**DigitalOcean Managed PostgreSQL:**

- **Plan:** Basic (1 GB RAM, 10 GB Storage, 25 connections)
- **Cost:** $15/month (~₺550/month)
- **Region:** Frankfurt (same as droplet)
- **Features:** Automatic daily backups, 99.99% uptime, Easy scaling

### Total: $63/month (~₺2,300/month)

**Why Managed PostgreSQL?**

- ✅ Production-ready from day one
- ✅ Automatic backups (7 day retention)
- ✅ High availability with failover
- ✅ One-click scaling without downtime
- ✅ Professional monitoring dashboard
- ✅ Point-in-time recovery

---

### Step 1: Create Managed PostgreSQL Database

```bash
# DigitalOcean Console:
1. Databases → Create Database Cluster
2. Engine: PostgreSQL 16
3. Plan: Basic ($15/month)
   - 1 GB RAM, 10 GB Storage, 25 connections
4. Region: Frankfurt (same as droplet)
5. Database name: killreport
```

**Save Connection Details:**

- Host: `your-db-cluster.db.ondigitalocean.com`
- Port: `25060`
- Username: `doadmin`
- Password: `[auto-generated]`
- Database: `killreport`

**Configure Trusted Sources:**

```bash
# DigitalOcean Console → Database → Settings → Trusted Sources
# Add droplet IP (after creating droplet in Step 2)
# Optional: Add your local IP for remote management
```

---

### Step 2: Create Droplet & Initial Server Setup

```bash
# DigitalOcean Console:
1. Create Droplet
2. Choose: Basic (4 vCPU, 8 GB RAM)
3. Region: Frankfurt (closest to EVE servers)
4. OS: Ubuntu 22.04 LTS
5. Add SSH key
6. Enable backups (+20% cost, optional but recommended)
```

**Server Setup:**

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

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

---

### Step 3: Deploy Application

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
# Managed PostgreSQL Database
DATABASE_URL="postgresql://doadmin:YOUR_PASSWORD@your-db-cluster.db.ondigitalocean.com:25060/killreport?sslmode=require&connection_limit=2"

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
yarn tsc

# Build frontend
cd ../frontend
yarn install
yarn build

# Start with PM2 (from root)
cd ..
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## Step 4: Performance Optimization

**Connection Pool Configuration:**

```bash
# Backend uses two separate Prisma clients:
# - prisma.ts: 5 connections (for API/resolvers)
# - prisma-worker.ts: 2 connections per worker

# For managed PostgreSQL, use connection_limit=2 in DATABASE_URL
# Calculation:
# API (prisma.ts): 5 connections (hardcoded in prisma.ts)
# Workers (prisma-worker.ts): 6 workers × 2 = 12 connections
# Total: 5 + 12 = 17 connections
# Managed PostgreSQL Basic limit = 25 connections ✅
# 8 connections reserved for maintenance and bulk operations
```

---

## Step 5: Nginx Configuration

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

---

## Step 6: Monitoring Setup

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

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Application health
pm2 status

# Database connection check
psql "$DATABASE_URL" -c "SELECT version();"

# RabbitMQ queue status
rabbitmqctl list_queues name messages consumers

# Disk usage
df -h
du -sh /var/www/killreport
```

### Performance Monitoring

```bash
# Managed PostgreSQL Monitoring
# Use DigitalOcean dashboard → Database → Metrics tab
# - CPU usage
# - Memory usage
# - Disk I/O
# - Connection count
```

### Log Analysis

```bash
# Backend errors
pm2 logs backend --lines 100 --err

# Worker queue processing
pm2 logs worker-characters --lines 50

# Nginx access logs
tail -f /var/log/nginx/access.log
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
yarn tsc

# Rebuild frontend
cd ../frontend
yarn build

# Run migrations if needed
cd ../backend
yarn prisma:migrate deploy

# Restart services (zero-downtime with cluster mode)
cd ..
pm2 reload all
```

---

## 🚨 Disaster Recovery

### Managed Database Recovery

```bash
# DigitalOcean Managed PostgreSQL includes:
# - Automatic daily backups (7 day retention)
# - Point-in-time recovery
# - One-click restore from DigitalOcean Console

# To restore:
# 1. Go to DigitalOcean Console → Databases → Your Database
# 2. Navigate to Backups tab
# 3. Select backup date/time
# 4. Click "Restore" button
```

---

## 💡 Cost Optimization Tips

1. **Monitor database usage** - Basic plan is sufficient for most startups
2. **Enable droplet backups** (+$9.60/month) for full system snapshots
3. **Monitor database size** - Upgrade PostgreSQL plan only when needed
4. **Use PM2 clustering** for Node.js instead of more droplets
5. **Implement efficient queries** before scaling infrastructure

---

## 📈 Scaling Checklist

**When to upgrade Managed PostgreSQL:**

- [ ] Database size >8 GB
- [ ] Connection pool frequently maxed out
- [ ] Query response times consistently >500ms

**Add Worker Droplet:**

- [ ] 50+ concurrent users
- [ ] RabbitMQ queues consistently backing up (>10k messages)
