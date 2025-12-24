# DigitalOcean Deployment Guide

## 1. PostgreSQL Managed Database Kurulumu

### DigitalOcean Console'dan

1. **Databases** → **Create Database Cluster**
2. Seçimler:

   - Database Engine: **PostgreSQL 16**
   - Plan: **Basic** (1 vCPU, 1 GB RAM) - $15/ay
   - Datacenter: **Frankfurt** veya **Amsterdam** (Türkiye'ye yakın)
   - Database name: `killreport_production`

3. Cluster oluşunca:
   - Connection string'i kopyala: `postgresql://user:pass@host:25060/killreport_production?sslmode=require`
   - Trusted Sources'a droplet IP'sini ekle

### Database Migration

```bash
# Local'den connection string'i .env'e ekle
cd backend
DATABASE_URL="postgresql://..." yarn prisma:migrate deploy
```

---

## 2. Droplet Kurulumu (CPU-Optimized $48/ay)

### Droplet Oluştur

- **Droplet Type**: CPU-Optimized
- **Size**: 4 vCPU, 8 GB RAM
- **Region**: Frankfurt FRA1
- **Image**: Ubuntu 24.04 LTS
- **SSH Keys**: SSH key'ini ekle

### İlk Kurulum (Droplet'e SSH ile bağlan)

```bash
# System update
sudo apt update && sudo apt upgrade -y

# Node.js 20 kurulumu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Yarn kurulumu
sudo npm install -g yarn

# PM2 kurulumu (process manager)
sudo npm install -g pm2

# RabbitMQ kurulumu
sudo apt install -y rabbitmq-server
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server

# RabbitMQ Management UI (opsiyonel)
sudo rabbitmq-plugins enable rabbitmq_management
```

---

## 3. Uygulama Deployment

### Git Repository Clone

```bash
cd /var/www
sudo git clone https://github.com/YOUR_USERNAME/killreport.git
sudo chown -R $USER:$USER killreport
cd killreport
```

### Environment Variables

```bash
# Backend .env
cat > backend/.env << EOF
DATABASE_URL="postgresql://user:pass@db-host:25060/killreport_production?sslmode=require"
RABBITMQ_URL="amqp://localhost"
EVE_CLIENT_ID="your_eve_client_id"
EVE_CLIENT_SECRET="your_eve_client_secret"
EVE_CALLBACK_URL="https://your-domain.com/auth/callback"
FRONTEND_URL="https://your-domain.com"
JWT_SECRET="$(openssl rand -base64 32)"
NODE_ENV="production"
PORT=4000
EOF

# Frontend .env.local
cat > frontend/.env.local << EOF
NEXT_PUBLIC_GRAPHQL_URL="https://api.your-domain.com/graphql"
NEXT_PUBLIC_WS_URL="wss://api.your-domain.com/graphql"
EOF
```

### Build & Install

```bash
# Root dependencies
yarn install

# Backend build
cd backend
yarn install
yarn prisma:generate
yarn build

# Frontend build
cd ../frontend
yarn install
yarn build
```

---

## 4. PM2 Process Management

### PM2 Ecosystem Config

Proje root'unda `ecosystem.config.js` dosyası oluştur (aşağıda hazırladım)

### PM2 Başlatma

```bash
cd /var/www/killreport
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Sistem yeniden başladığında otomatik başlat
```

### PM2 Monitoring

```bash
pm2 list                    # Tüm process'leri listele
pm2 logs                    # Tüm logları göster
pm2 logs backend            # Sadece backend logları
pm2 logs worker-characters  # Sadece character worker logları
pm2 monit                   # Real-time monitoring
pm2 restart all            # Tüm process'leri restart
```

---

## 5. Nginx Reverse Proxy

### Nginx Kurulumu

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Nginx Config

```bash
sudo nano /etc/nginx/sites-available/killreport
```

İçerik aşağıdaki nginx config dosyasında (oluşturuyorum)

```bash
sudo ln -s /etc/nginx/sites-available/killreport /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

---

## 6. Domain Ayarları

DNS A Records ekle:

- `your-domain.com` → Droplet IP
- `api.your-domain.com` → Droplet IP

---

## 7. Monitoring & Maintenance

### Log Rotation

```bash
# PM2 otomatik log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

### Database Backups

DigitalOcean Managed Database otomatik daily backup yapıyor.
Manuel backup için:

```bash
# Droplet'ten backup al
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

### System Monitoring

```bash
# Disk kullanımı
df -h

# Memory kullanımı
free -h

# PM2 metrics
pm2 monit
```

---

## 8. Deployment Update (Git Pull Strategy)

Yeni kod deploy etmek için:

```bash
cd /var/www/killreport
git pull origin main

# Backend update
cd backend
yarn install
yarn prisma:migrate deploy
yarn build

# Frontend update
cd ../frontend
yarn install
yarn build

# Restart all processes
cd ..
pm2 restart all
```

---

## 🚨 Önemli Notlar

### Resource Limits

- **4 vCPU, 8 GB RAM** ile şu worker'lar rahat çalışır:
  - 10 concurrent character workers
  - 5 concurrent corporation workers
  - 3 concurrent alliance workers
  - RedisQ stream worker
  - Backend GraphQL API
  - Next.js frontend

### Scaling Strategy

1. **Database büyürse**: Managed PostgreSQL plan'ını upgrade et (4 GB → 8 GB)
2. **Worker yükü artarsa**: Worker droplet'ini ayır ($48/ay ek)
3. **Frontend trafiği artarsa**: Vercel'e taşı (CDN + auto-scaling)

### Maliyet Optimizasyonu

- İlk 6 ay Basic PostgreSQL yeterli
- Günde 50k killmail'e kadar tek droplet yeterli
- RabbitMQ lokal kurulum ile aylık $30-40 tasarruf

### Backup Strategy

- PostgreSQL: Otomatik daily backup (7 gün retention)
- Manual backups: Haftada 1 kez `scripts/backup-db.sh` çalıştır
- Droplet snapshots: Ayda 1 kez ($1-2 ek maliyet)
