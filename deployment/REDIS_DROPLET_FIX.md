# Redis PubSub Droplet Fix

## Problem

Redis PubSub works locally but fails on DigitalOcean Droplet because:

1. ❌ Redis server not installed on Droplet
2. ❌ `REDIS_URL` not configured in `.env`
3. ❌ `USE_REDIS_PUBSUB` not set in environment
4. ❌ PM2 config doesn't pass Redis env vars to workers

## Local vs Production

### Local (Working)

```bash
✅ Redis installed via Homebrew
✅ Running on localhost:6379
✅ .env has REDIS_URL and USE_REDIS_PUBSUB=true
```

### Droplet (Not Working)

```bash
❌ Redis not installed
❌ No Redis env vars in .env
❌ Workers can't connect to Redis PubSub
```

## Solution

### Step 1: Install Redis on Droplet

```bash
# SSH into Droplet
ssh root@your-droplet-ip

# Install Redis
apt update
apt install -y redis-server

# Configure for production
sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sed -i 's/bind 127.0.0.1 ::1/bind 127.0.0.1/' /etc/redis/redis.conf

# Enable and start
systemctl enable redis-server
systemctl start redis-server

# Verify
redis-cli ping  # Should return: PONG
```

### Step 2: Update Backend .env

```bash
cd /var/www/killreport/backend

# Add to .env
cat >> .env << 'EOF'

# Redis (for distributed PubSub)
REDIS_URL="redis://localhost:6379"
USE_REDIS_PUBSUB="true"
EOF
```

### Step 3: Update PM2 Config

PM2 config has been updated to include Redis env vars. Restart all processes:

```bash
cd /var/www/killreport
pm2 delete all
pm2 start ecosystem.config.js --env production
pm2 save
```

### Step 4: Verify PubSub is Working

```bash
# Check backend logs
pm2 logs killreport-backend --lines 20

# Should see:
# 📡 PubSub: Redis (distributed)

# Check worker logs
pm2 logs worker-redisq --lines 20

# Test subscription in GraphQL Playground
# https://api.yourdomain.com/graphql
```

## GraphQL Subscription Test

```graphql
subscription {
  onNewKillmail {
    killmailId
    killmailTime
    solarSystem {
      solarSystemName
    }
    victim {
      character {
        characterName
      }
      shipType {
        typeName
      }
    }
  }
}
```

## Architecture

```
┌─────────────────┐        ┌──────────────┐        ┌────────────────┐
│  Backend Server │◄──────►│ Redis PubSub │◄──────►│    Workers     │
│   (GraphQL)     │        │ (localhost)  │        │ (6 instances)  │
└─────────────────┘        └──────────────┘        └────────────────┘
         │                                                  │
         │ SSE Subscription                                │
         ▼                                                  │
    ┌─────────┐                                            │
    │ Browser │                                            │
    └─────────┘                                            │
                                                           │
        NEW_KILLMAIL event published ◄────────────────────┘
```

## Why This Happens

**Development:**

- Redis installed via Homebrew
- Automatically starts on system boot
- `.env` configured for local use

**Production:**

- Clean Ubuntu server
- Only PostgreSQL, RabbitMQ, Node.js installed
- **Redis not in original deployment guide**
- Environment variables not set

## Prevention

✅ Updated `deployment/digitalocean-setup.md` with Redis installation
✅ Updated `ecosystem.config.js` with Redis env vars
✅ Added Redis health checks to monitoring section

## Monitoring

```bash
# Check Redis status
redis-cli ping
redis-cli INFO server
redis-cli CLIENT LIST

# Monitor PubSub channels
redis-cli PUBSUB CHANNELS
redis-cli PUBSUB NUMSUB NEW_KILLMAIL

# Check memory usage
redis-cli INFO memory | grep used_memory_human
```

## Common Issues

### Workers not publishing events

```bash
# Check if USE_REDIS_PUBSUB is set
pm2 env worker-redisq | grep REDIS

# If not found, restart with new config
pm2 reload ecosystem.config.js
```

### Redis connection refused

```bash
# Check if Redis is running
systemctl status redis-server

# Check if Redis is listening
netstat -tlnp | grep 6379

# Test connection
redis-cli -h localhost -p 6379 ping
```

### SSE connection timeout in browser

```bash
# Check Nginx config
cat /etc/nginx/sites-enabled/api.yourdomain.com

# Ensure these settings exist:
# proxy_buffering off;
# proxy_cache off;
# proxy_set_header Connection '';
# proxy_read_timeout 86400s;
```

## Performance

Redis PubSub is **extremely lightweight**:

- ~1-2 MB memory usage
- Minimal CPU impact
- No disk I/O (in-memory only)
- Perfect for real-time events

**Cost:** $0 (uses existing Droplet resources)
