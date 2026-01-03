#!/bin/bash

# SSE Subscription Diagnostic Script
# Run this on the Droplet to diagnose SSE/subscription issues

echo "=================================================="
echo "KillReport SSE/Subscription Diagnostic"
echo "=================================================="
echo ""

# 1. Check Redis
echo "1️⃣  Redis Status:"
if systemctl is-active --quiet redis-server; then
    echo "  ✅ Redis service: RUNNING"
    if redis-cli ping > /dev/null 2>&1; then
        echo "  ✅ Redis ping: PONG"
        echo "  📊 Redis clients:"
        redis-cli CLIENT LIST | wc -l | xargs echo "     Connected clients:"
    else
        echo "  ❌ Redis ping: FAILED"
    fi
else
    echo "  ❌ Redis service: NOT RUNNING"
fi
echo ""

# 2. Check Backend Environment
echo "2️⃣  Backend Environment:"
if [ -f "/var/www/killreport/backend/.env" ]; then
    if grep -q "USE_REDIS_PUBSUB=true" /var/www/killreport/backend/.env; then
        echo "  ✅ USE_REDIS_PUBSUB: true"
    else
        echo "  ❌ USE_REDIS_PUBSUB: not set or false"
    fi

    if grep -q "REDIS_URL" /var/www/killreport/backend/.env; then
        echo "  ✅ REDIS_URL: configured"
    else
        echo "  ❌ REDIS_URL: not set"
    fi
else
    echo "  ❌ .env file not found"
fi
echo ""

# 3. Check Backend Logs
echo "3️⃣  Backend PubSub Mode:"
if pm2 logs killreport-backend --nostream --lines 50 2>/dev/null | grep -q "Redis (distributed)"; then
    echo "  ✅ Backend using: Redis (distributed)"
else
    if pm2 logs killreport-backend --nostream --lines 50 2>/dev/null | grep -q "In-memory"; then
        echo "  ❌ Backend using: In-memory (single process)"
    else
        echo "  ⚠️  Cannot determine PubSub mode"
    fi
fi
echo ""

# 4. Check Worker Events
echo "4️⃣  Worker Events (last 50 lines):"
WORKER_EVENTS=$(pm2 logs worker-redisq --nostream --lines 50 2>/dev/null | grep -c "Published NEW_KILLMAIL")
if [ "$WORKER_EVENTS" -gt 0 ]; then
    echo "  ✅ Worker published $WORKER_EVENTS events"
else
    echo "  ⚠️  No published events found in recent logs"
fi
echo ""

# 5. Check Nginx Configuration
echo "5️⃣  Nginx SSE Configuration:"
if nginx -T 2>/dev/null | grep -A 40 "server_name api.killreport.com" | grep -q "gzip off"; then
    echo "  ✅ gzip: disabled"
else
    echo "  ❌ gzip: enabled or not configured (PROBLEM!)"
fi

if nginx -T 2>/dev/null | grep -A 40 "server_name api.killreport.com" | grep -q "proxy_buffering off"; then
    echo "  ✅ proxy_buffering: off"
else
    echo "  ❌ proxy_buffering: on or not configured (PROBLEM!)"
fi

if nginx -T 2>/dev/null | grep -A 40 "server_name api.killreport.com" | grep -q "X-Accel-Buffering"; then
    echo "  ✅ X-Accel-Buffering: configured"
else
    echo "  ⚠️  X-Accel-Buffering: not found"
fi
echo ""

# 6. Check Active Nginx Config File
echo "6️⃣  Active Nginx Config:"
if [ -L "/etc/nginx/sites-enabled/killreport-backend" ]; then
    TARGET=$(readlink -f /etc/nginx/sites-enabled/killreport-backend)
    echo "  ✅ Symlink exists: $TARGET"
else
    echo "  ⚠️  killreport-backend not in sites-enabled"
    echo "     Enabled sites:"
    ls -1 /etc/nginx/sites-enabled/ | sed 's/^/     - /'
fi
echo ""

# 7. Test SSE Connection
echo "7️⃣  SSE Connection Test:"
echo "  Testing https://api.killreport.com/graphql..."
RESPONSE=$(curl -s -N -H "Accept: text/event-stream" \
    -H "Content-Type: application/json" \
    -d '{"query":"subscription { newKillmail { id } }"}' \
    https://api.killreport.com/graphql \
    --max-time 3 2>&1)

if echo "$RESPONSE" | grep -q "event:"; then
    echo "  ✅ SSE connection successful, receiving events"
else
    echo "  ⚠️  No events received in 3 seconds (might be normal if no new killmails)"
fi
echo ""

# 8. Redis PubSub Monitor
echo "8️⃣  Redis PubSub Channels:"
CHANNELS=$(redis-cli PUBSUB CHANNELS 2>/dev/null)
if [ -n "$CHANNELS" ]; then
    echo "  Active channels:"
    echo "$CHANNELS" | sed 's/^/     - /'

    # Check NEW_KILLMAIL subscribers
    SUBS=$(redis-cli PUBSUB NUMSUB NEW_KILLMAIL 2>/dev/null | awk '{print $2}')
    echo "  NEW_KILLMAIL subscribers: $SUBS"
else
    echo "  ⚠️  No active channels"
fi
echo ""

# 9. PM2 Process Status
echo "9️⃣  PM2 Process Status:"
pm2 jlist 2>/dev/null | python3 -m json.tool 2>/dev/null | grep -E '"name"|"status"|"memory"' | head -15
echo ""

# Summary
echo "=================================================="
echo "🔍 TROUBLESHOOTING SUMMARY"
echo "=================================================="
echo ""
echo "If you see ❌ or ⚠️  above, fix those issues:"
echo ""
echo "Redis not running:"
echo "  sudo systemctl start redis-server"
echo ""
echo "Backend using in-memory PubSub:"
echo "  1. Add to /var/www/killreport/backend/.env:"
echo "     REDIS_URL=\"redis://localhost:6379\""
echo "     USE_REDIS_PUBSUB=\"true\""
echo "  2. pm2 restart killreport-backend"
echo ""
echo "Nginx buffering enabled:"
echo "  1. cd /var/www/killreport"
echo "  2. git pull"
echo "  3. cp deployment/killreport-backend /etc/nginx/sites-available/"
echo "  4. nginx -t"
echo "  5. systemctl reload nginx"
echo ""
echo "To monitor events in real-time:"
echo "  redis-cli MONITOR"
echo ""
echo "=================================================="
