# Redis PubSub Quick Reference

## Quick Diagnostic Commands

```bash
# 1. Run full diagnostic (recommended first step)
cd backend && yarn diagnose:redis

# 2. Check Redis connection
redis-cli -u $REDIS_URL ping

# 3. Check server health endpoint
curl http://localhost:4000/health/redis

# 4. Test PubSub manually
cd backend && yarn ts-node redis/test-redis-pubsub.ts
```

## Environment Variables

```bash
# Required for distributed PubSub
USE_REDIS_PUBSUB=true

# Local development
REDIS_URL="redis://localhost:6379"

# Production with TLS
REDIS_URL="rediss://host:port"

# Production with authentication
REDIS_URL="redis://:password@host:port"
REDIS_URL="redis://username:password@host:port"
```

## Health Check Response

### ✅ Working
```json
{
  "enabled": true,
  "publishClient": "ready",
  "subscribeClient": "ready",
  "connected": true
}
```

### ❌ Not Working
```json
{
  "enabled": false,  // <- Set USE_REDIS_PUBSUB=true
  "publishClient": "connecting",  // <- Redis connection issue
  "subscribeClient": "close",  // <- Redis connection failed
  "connected": false
}
```

## Server Log Messages

### ✅ Good (Working)
```
📡 PubSub: Initializing Redis (distributed mode)
✅ Redis Publish Client: Connected
✅ Redis Publish Client: Ready
✅ Redis Subscribe Client: Connected
✅ Redis Subscribe Client: Ready
✅ PubSub: Redis-based PubSub initialized successfully
✅ Redis Health Check: PING response: PONG
```

### ❌ Bad (Not Working)
```
❌ Redis Publish Client Error: connect ECONNREFUSED
❌ Redis Subscribe Client Error: getaddrinfo ENOTFOUND
❌ Redis Health Check Failed: Connection timeout
📡 PubSub: In-memory mode (single process only)
```

## Common Production Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Wrong host/port or Redis not running | Check REDIS_URL and Redis status |
| `ENOTFOUND` | DNS resolution failure | Verify hostname or use IP address |
| `ETIMEDOUT` | Connection timeout | Check firewall/security groups |
| `NOAUTH` | Missing password | Add password to REDIS_URL |
| `ERR Client sent AUTH` | Password provided but not needed | Remove password from URL |

## Provider-Specific URLs

```bash
# AWS ElastiCache (no TLS)
REDIS_URL=redis://my-cluster.cache.amazonaws.com:6379

# AWS ElastiCache (with TLS)
REDIS_URL=rediss://my-cluster.cache.amazonaws.com:6379

# Azure Cache for Redis
REDIS_URL=rediss://:access-key@name.redis.cache.windows.net:6380

# DigitalOcean Managed Redis
REDIS_URL=rediss://default:password@db-redis-nyc1-12345.db.ondigitalocean.com:25061

# Upstash Redis
REDIS_URL=rediss://:token@us1-central-12345.upstash.io:6379
```

## Testing Real-time Updates

1. **Start server:**
   ```bash
   cd backend && yarn dev
   ```

2. **Open GraphQL Playground:** http://localhost:4000/graphql

3. **Subscribe to killmails:**
   ```graphql
   subscription {
     newKillmail {
       id
       victim { character { name } }
     }
   }
   ```

4. **Start worker in another terminal:**
   ```bash
   cd backend && yarn worker:redisq
   ```

5. **Watch for new killmails** to appear in the subscription

## Troubleshooting Workflow

1. ✅ Check environment: `echo $USE_REDIS_PUBSUB $REDIS_URL`
2. ✅ Test connection: `redis-cli -u $REDIS_URL ping`
3. ✅ Run diagnostic: `yarn diagnose:redis`
4. ✅ Check health endpoint: `curl localhost:4000/health/redis`
5. ✅ Review server logs for Redis errors
6. ✅ See [PRODUCTION_TROUBLESHOOTING.md](./PRODUCTION_TROUBLESHOOTING.md) for detailed guide

## Need Help?

Run the diagnostic and collect this information:
- Output of `yarn diagnose:redis`
- Response from `/health/redis`
- Server startup logs
- Your Redis provider (AWS, Azure, etc.)
- Any error messages

See [PRODUCTION_TROUBLESHOOTING.md](./PRODUCTION_TROUBLESHOOTING.md) for comprehensive troubleshooting guide.
