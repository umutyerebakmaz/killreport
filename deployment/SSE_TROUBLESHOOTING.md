# SSE Subscription Troubleshooting Guide

## Problem: Subscription Pending Forever on Production

Local works fine, but production subscription hangs in "pending" state with no events received.

## Header Comparison

### Local (Working) ✅

```
URL: http://localhost:4000/graphql
content-type: text/event-stream
cache-control: no-cache
connection: keep-alive
```

### Production (Hanging) ❌

```
URL: https://api.killreport.com/graphql
content-type: text/event-stream
cache-control: no-cache
connection: keep-alive
server: nginx/1.24.0 (Ubuntu)  ← Nginx is proxying
```

**Headers look correct!** The problem is likely:

1. ❌ **Redis not running** - Workers can't publish events
2. ❌ **Nginx buffering SSE** - Events get stuck in proxy buffer
3. ❌ **Wrong Nginx config file active** - Old config without SSE settings

---

## Diagnostic Steps

### Step 1: Check if Redis is Running

```bash
ssh root@188.166.49.7

# Check Redis service
systemctl status redis-server
# Should show: active (running)

# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis clients
redis-cli CLIENT LIST
# Should show at least 2 connections (publish + subscribe)
```

**If Redis is not running:**

```bash
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server
```

### Step 2: Check Backend Environment Variables

```bash
cd /var/www/killreport/backend

# Check if Redis env vars exist
cat .env | grep REDIS
# Should show:
# REDIS_URL="redis://localhost:6379"
# USE_REDIS_PUBSUB="true"
```

**If missing:**

```bash
cat >> .env << 'EOF'
REDIS_URL="redis://localhost:6379"
USE_REDIS_PUBSUB="true"
EOF
```

### Step 3: Check Backend Logs

```bash
pm2 logs killreport-backend --lines 50

# Look for:
# ✅ "📡 PubSub: Redis (distributed)" - Good!
# ❌ "📡 PubSub: In-memory (single process only)" - Redis not connected!
# ❌ "ECONNREFUSED" - Redis not running
```

### Step 4: Check Worker Logs

```bash
pm2 logs worker-redisq --lines 50

# Look for:
# ✅ "Published NEW_KILLMAIL event" - Events being sent
# ❌ "pubsub.publish error" - Redis publish failing
```

### Step 5: Verify Active Nginx Config

```bash
# Check which config Nginx is using
nginx -T | grep -A 30 "server_name api.killreport.com"

# Critical SSE settings should be present:
# proxy_buffering off;
# proxy_cache off;
# proxy_set_header Connection '';
# proxy_set_header X-Accel-Buffering 'no';
# proxy_read_timeout 86400s;
```

### Step 6: Check Which Nginx Config File is Active

```bash
# List enabled sites
ls -la /etc/nginx/sites-enabled/

# Check if killreport-backend is linked
ls -la /etc/nginx/sites-enabled/killreport-backend

# Should point to: /etc/nginx/sites-available/killreport-backend
```

---

## Common Issues & Fixes

### Issue 1: Redis Not Installed

**Symptom:** Backend logs show "In-memory (single process only)"

**Fix:**

```bash
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# Restart backend
pm2 restart killreport-backend
```

### Issue 2: Old Nginx Config Without SSE Settings

**Symptom:** SSE connection works but no events arrive, or connection times out

**Fix:**

```bash
# Copy the correct config
cp /var/www/killreport/deployment/killreport-backend /etc/nginx/sites-available/

# Test config
nginx -t

# Reload Nginx
systemctl reload nginx
```

### Issue 3: Nginx Using Wrong Config File

**Symptom:** You updated the config but changes don't apply

**Fix:**

```bash
# Remove old symlink
rm /etc/nginx/sites-enabled/default
rm /etc/nginx/sites-enabled/api.killreport.com

# Create correct symlink
ln -sf /etc/nginx/sites-available/killreport-backend /etc/nginx/sites-enabled/killreport-backend

# Test and reload
nginx -t
systemctl reload nginx
```

### Issue 4: PM2 Not Passing Redis Env Vars

**Symptom:** `.env` has Redis vars but backend doesn't use them

**Fix:**

```bash
cd /var/www/killreport

# Delete all processes
pm2 delete all

# Start with updated ecosystem.config.js
pm2 start ecosystem.config.js --env production

# Save
pm2 save

# Verify env vars
pm2 env killreport-backend | grep REDIS
```

---

## Test Subscription After Fixes

### Method 1: GraphQL Playground

```bash
# Open browser: https://api.killreport.com/graphql

# Run this subscription:
subscription {
  onNewKillmail {
    killmailId
    killmailTime
  }
}

# In another terminal, trigger an event:
pm2 logs worker-redisq --lines 10
# Wait for "✅ Killmail saved" message
```

### Method 2: curl Test

```bash
# Subscribe to events
curl -N -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"query":"subscription { onNewKillmail { killmailId } }"}' \
  https://api.killreport.com/graphql

# Should keep connection open and receive events
```

### Method 3: Browser DevTools

```javascript
// Open browser console on https://www.killreport.com
// Run subscription
// Check Network tab → graphql request
// Status should be "200 OK (pending)"
// Preview tab should show events arriving in real-time
```

---

## Verify Everything is Working

```bash
# 1. Redis is running
redis-cli ping
# PONG ✅

# 2. Backend connected to Redis
pm2 logs killreport-backend --lines 20 | grep PubSub
# 📡 PubSub: Redis (distributed) ✅

# 3. Worker publishing events
pm2 logs worker-redisq --lines 50 | grep "Published NEW_KILLMAIL"
# ✅ Published NEW_KILLMAIL event for killmail... ✅

# 4. Nginx not buffering
curl -I https://api.killreport.com/graphql
# x-accel-buffering: no ✅

# 5. Active subscriptions
redis-cli PUBSUB NUMSUB NEW_KILLMAIL
# Should show > 0 if someone is subscribed ✅
```

---

## Network Tab Debugging

### Working Local Subscription

```
Status: 200 OK (pending)
Type: text/event-stream
Preview tab shows:
  event: next
  data: {"data":{"onNewKillmail":{...}}}

  event: next
  data: {"data":{"onNewKillmail":{...}}}
```

### Broken Production Subscription

```
Status: 200 OK (pending)
Type: text/event-stream
Preview tab shows:
  [empty - no events arriving]
```

This means:

- ✅ SSE connection established
- ✅ Nginx not killing connection
- ❌ **No events being published to Redis**
- ❌ **Or backend not receiving from Redis**

---

## Quick Checklist

Run these commands in order:

```bash
# 1. Check Redis
redis-cli ping

# 2. Check backend logs
pm2 logs killreport-backend --lines 20

# 3. Check worker logs
pm2 logs worker-redisq --lines 20

# 4. Check Nginx config
nginx -T | grep -A 5 "proxy_buffering"

# 5. Restart everything if needed
pm2 restart all

# 6. Monitor Redis
redis-cli MONITOR
# Then trigger subscription in browser
# You should see PUBLISH commands
```

---

## Expected vs Actual

### What Should Happen

```
1. Browser → GraphQL subscription request → Nginx → Backend
2. Backend subscribes to Redis channel "NEW_KILLMAIL"
3. Worker fetches killmail → Saves to DB → Publishes to Redis
4. Backend receives from Redis → Sends SSE event → Nginx → Browser
5. Browser receives real-time update
```

### What's Actually Happening (Broken)

```
1. Browser → GraphQL subscription request → Nginx → Backend ✅
2. Backend subscribes to Redis channel "NEW_KILLMAIL" ❌ (Redis not running?)
3. Worker fetches killmail → Saves to DB → Publishes to Redis ❌ (Can't connect?)
4. [No events flow]
5. Browser hangs in "pending" state
```

---

## Final Verification Command

```bash
# Run this one-liner to check everything:
echo "=== Redis ===" && redis-cli ping && \
echo "=== Backend PubSub ===" && pm2 logs killreport-backend --nostream --lines 30 | grep PubSub && \
echo "=== Worker Events ===" && pm2 logs worker-redisq --nostream --lines 30 | grep "Published NEW_KILLMAIL" && \
echo "=== Nginx Config ===" && nginx -T 2>/dev/null | grep -A 3 "proxy_buffering" | head -20 && \
echo "=== Redis Clients ===" && redis-cli CLIENT LIST
```

If any of these fail, you found the problem! 🎯
