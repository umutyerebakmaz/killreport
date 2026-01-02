# Redis PubSub Production Troubleshooting Guide

## Issue: Real-time Killmail Updates Not Working in Production

### Problem Description
- Redis PubSub works locally (`localhost:6379`)
- In production, new killmails are saved to database but subscriptions don't receive updates
- No errors visible in browser console or server logs

### Root Causes

#### 1. Silent Connection Failures
**Problem**: The original `pubsub.ts` created Redis clients without error handlers, making connection failures invisible.

**Solution**: Added comprehensive error handling and logging:
- Connection status monitoring
- Automatic reconnection with logging
- Health check endpoint (`/health/redis`)
- Startup connection verification

#### 2. Production Redis Configuration Differences

##### Common Production Issues:

**TLS/SSL Requirements**
```bash
# ❌ Wrong for production with TLS
REDIS_URL=redis://my-redis.example.com:6379

# ✅ Correct for production with TLS
REDIS_URL=rediss://my-redis.example.com:6379
#        ^^^^^^ - Note the 's' for TLS
```

**Authentication Required**
```bash
# ❌ Wrong - missing password
REDIS_URL=redis://my-redis.example.com:6379

# ✅ Correct with password
REDIS_URL=redis://:my-password@my-redis.example.com:6379
#                 ^^^^^^^^^^^^ - Password after colon

# ✅ Correct with username and password
REDIS_URL=redis://username:password@my-redis.example.com:6379
```

**Wrong Port**
```bash
# ❌ Wrong - default port
REDIS_URL=redis://my-redis.example.com:6379

# ✅ Correct - check your provider's port
REDIS_URL=redis://my-redis.example.com:16379
```

**Database Selection**
```bash
# Default is db 0
REDIS_URL=redis://localhost:6379

# Specify different database (0-15)
REDIS_URL=redis://localhost:6379/1
```

#### 3. Environment Variable Not Set
```bash
# ❌ Wrong - Redis disabled
USE_REDIS_PUBSUB=false

# ✅ Correct - Redis enabled
USE_REDIS_PUBSUB=true
```

### Diagnostic Steps

#### Step 1: Check Environment Variables
```bash
# In your production environment, verify:
echo $REDIS_URL
echo $USE_REDIS_PUBSUB

# Should output:
# redis://[credentials]@host:port
# true
```

#### Step 2: Test Redis Connection
```bash
# On production server, try to connect with redis-cli
redis-cli -u $REDIS_URL ping
# Should return: PONG

# If using TLS:
redis-cli -u $REDIS_URL --tls ping
```

#### Step 3: Run Diagnostic Script
```bash
cd backend
yarn diagnose:redis
```

This will test:
- Environment variable configuration
- Redis connection (PING)
- PubSub publish/subscribe
- NEW_KILLMAIL channel

#### Step 4: Check Server Health Endpoint
```bash
# Check Redis status via HTTP
curl https://your-domain.com/health/redis

# Expected output:
{
  "enabled": true,
  "publishClient": "ready",
  "subscribeClient": "ready",
  "connected": true,
  "url": "redis://****@host:port",
  "timestamp": "2026-01-02T16:00:00.000Z"
}
```

**Problem indicators**:
- `enabled: false` → Set `USE_REDIS_PUBSUB=true`
- `publishClient: "connecting"` → Connection timeout or wrong URL
- `publishClient: "close"` → Connection failed
- `connected: false` → Redis not ready

#### Step 5: Check Server Logs

Look for these messages in server startup logs:

**✅ Good (Working)**:
```
📡 PubSub: Initializing Redis (distributed mode)
   Redis URL: redis://****@host:port
✅ Redis Publish Client: Connected
✅ Redis Publish Client: Ready
✅ Redis Subscribe Client: Connected
✅ Redis Subscribe Client: Ready
✅ PubSub: Redis-based PubSub initialized successfully
✅ Redis Health Check: PING response: PONG
```

**❌ Bad (Not Working)**:
```
❌ Redis Publish Client Error: connect ECONNREFUSED
❌ Redis Subscribe Client Error: getaddrinfo ENOTFOUND
❌ Redis Health Check Failed: Connection timeout
📡 PubSub: In-memory mode (single process only)
```

### Provider-Specific Configuration

#### AWS ElastiCache
```bash
# Standard (no TLS)
REDIS_URL=redis://my-cluster.cache.amazonaws.com:6379

# With encryption in-transit (TLS)
REDIS_URL=rediss://my-cluster.cache.amazonaws.com:6379
```

#### Azure Cache for Redis
```bash
# Format: rediss://:{access-key}@{hostname}:{ssl-port}
REDIS_URL=rediss://:your-access-key@your-redis.redis.cache.windows.net:6380

# Note: Azure uses port 6380 for SSL
```

#### Google Cloud Memorystore
```bash
# Standard instance
REDIS_URL=redis://10.0.0.3:6379

# If using AUTH
REDIS_URL=redis://:your-auth-string@10.0.0.3:6379
```

#### DigitalOcean Managed Redis
```bash
# Format: rediss://default:{password}@{hostname}:{port}
REDIS_URL=rediss://default:your-password@db-redis-nyc1-12345.db.ondigitalocean.com:25061
```

#### Upstash Redis
```bash
# Always uses TLS
REDIS_URL=rediss://:your-token@us1-central-12345.upstash.io:6379
```

### Testing in Production

#### 1. Manual Test via GraphQL Playground

Navigate to `https://your-domain.com/graphql` and run:

```graphql
subscription {
  newKillmail {
    id
    killmailTime
    victim {
      character {
        name
      }
    }
  }
}
```

Keep this open in a browser tab.

#### 2. Trigger a Test Event

In another terminal, run the RedisQ worker:
```bash
yarn worker:redisq
```

Watch for new killmails to be saved and see if the subscription receives them.

#### 3. Check Worker Logs

The worker should log:
```
📡 Publishing NEW_KILLMAIL event for killmail: 123456789
```

#### 4. Check Server Logs

The server should log:
```
🔔 Client subscribed to NEW_KILLMAIL
📨 Resolving NEW_KILLMAIL for killmail_id: 123456789
```

### Common Issues and Solutions

#### Issue: "ECONNREFUSED"
**Cause**: Wrong host or port, or Redis not running
**Solution**: 
1. Verify REDIS_URL is correct
2. Check Redis is running: `redis-cli -u $REDIS_URL ping`
3. Check firewall rules allow connection

#### Issue: "ENOTFOUND" 
**Cause**: DNS resolution failure
**Solution**:
1. Verify hostname is correct
2. Check VPC/network configuration
3. Try using IP address instead of hostname

#### Issue: "ETIMEDOUT"
**Cause**: Connection timeout, likely firewall
**Solution**:
1. Check security group rules
2. Verify Redis allows connections from your server's IP
3. Check if VPC peering is configured (if needed)

#### Issue: "NOAUTH Authentication required"
**Cause**: Missing password in REDIS_URL
**Solution**: Add password to URL:
```bash
REDIS_URL=redis://:your-password@host:port
```

#### Issue: "ERR Client sent AUTH, but no password is set"
**Cause**: Password provided but Redis doesn't require auth
**Solution**: Remove password from URL:
```bash
REDIS_URL=redis://host:port
```

#### Issue: Messages Published but Not Received
**Cause**: Using different Redis clients for pub/sub
**Solution**: Ensure all processes use the same REDIS_URL

#### Issue: Works in Dev, Not in Production
**Cause**: Different Redis instance or configuration
**Solution**: 
1. Verify REDIS_URL in production matches expected value
2. Check both server and workers use same REDIS_URL
3. Ensure USE_REDIS_PUBSUB=true in production

### Monitoring and Verification

#### Health Check Script
Add to your deployment pipeline:
```bash
#!/bin/bash
# check-redis-pubsub.sh

# Check Redis health endpoint
RESPONSE=$(curl -s https://your-domain.com/health/redis)
CONNECTED=$(echo $RESPONSE | jq -r '.connected')

if [ "$CONNECTED" != "true" ]; then
  echo "❌ Redis PubSub not connected!"
  echo $RESPONSE | jq
  exit 1
fi

echo "✅ Redis PubSub is healthy"
exit 0
```

#### Continuous Monitoring
Set up alerts for:
1. Redis connection status changes
2. Subscription errors in logs
3. Health endpoint returning `connected: false`

### Quick Fix Checklist

When real-time updates aren't working in production:

- [ ] Verify `USE_REDIS_PUBSUB=true` in .env
- [ ] Check `REDIS_URL` format is correct
- [ ] Test Redis connection: `redis-cli -u $REDIS_URL ping`
- [ ] Run diagnostic: `yarn diagnose:redis`
- [ ] Check `/health/redis` endpoint
- [ ] Review server startup logs for Redis errors
- [ ] Verify workers are using same REDIS_URL
- [ ] Check firewall/security group rules
- [ ] Confirm TLS/SSL settings match provider requirements
- [ ] Restart server after fixing REDIS_URL

### Support

If issues persist after following this guide:

1. Run `yarn diagnose:redis` and save output
2. Check `/health/redis` and save response
3. Collect server startup logs
4. Note your Redis provider (AWS, Azure, etc.)
5. Include error messages from logs

This information will help diagnose the specific issue with your setup.
