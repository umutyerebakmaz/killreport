# Redis Setup for Distributed PubSub

## Why Redis?

The system uses Redis for **distributed PubSub** to enable communication between independent processes:

```bash
Server Process (GraphQL)  ←→  Redis PubSub  ←→  Worker Processes
   ↓                                              ↓
Subscribers listen                          publish() events
```

This allows:

- ✅ Server and workers to run independently
- ✅ Horizontal scaling (multiple worker instances)
- ✅ Zero downtime worker restarts
- ✅ Production-ready architecture

## Installation

### Option 1: macOS with Homebrew (Recommended for Development)

```bash
# Install Redis
brew install redis

# Start Redis as a service (runs on startup)
brew services start redis

# Test connection
redis-cli ping
# Should return: PONG

# View Redis status
brew services info redis

# Stop Redis (if needed)
brew services stop redis

# Restart Redis
brew services restart redis
```

### Option 3: Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install redis-server

sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## Configuration

Redis connection is configured in `.env`:

```bash
# Redis Configuration
REDIS_URL="redis://localhost:6379"
USE_REDIS_PUBSUB=true
```

## Architecture

### Process Structure

```
Terminal 1: Server
├── GraphQL API (port 4000)
├── Subscriptions
└── Redis PubSub subscriber

Terminal 2: RedisQ Worker
├── Fetches killmails from zKillboard
├── Saves to database
└── Publishes to Redis → Server receives → UI updates

Terminal 3: User Killmail Worker
├── Processes user killmail queue
├── Fetches from ESI API
└── Publishes to Redis → Server receives → UI updates
```

### Running the System

```bash
# Terminal 1: Start server
cd backend
yarn dev

# Terminal 2: Start RedisQ worker (real-time killmail stream)
cd backend
yarn worker:redisq

# Terminal 3: Start User Killmail worker
cd backend
yarn worker:user-killmails

# Terminal 4: Queue users for sync
cd backend
yarn queue:user-killmails
```

## Testing and Diagnostics

### Quick Connection Test

```bash
# Test basic Redis connection
redis-cli -u $REDIS_URL ping
# Should return: PONG
```

### Comprehensive Diagnostic

Run the full diagnostic script to test all PubSub functionality:

```bash
cd backend
yarn diagnose:redis
```

This will test:
1. Environment variable configuration
2. Redis connection (PING)
3. PubSub publish/subscribe
4. NEW_KILLMAIL channel specifically

### Health Check Endpoint

Check Redis connection status via HTTP:

```bash
# Local development
curl http://localhost:4000/health/redis

# Production
curl https://your-domain.com/health/redis
```

Expected response when working:
```json
{
  "enabled": true,
  "publishClient": "ready",
  "subscribeClient": "ready",
  "connected": true,
  "url": "redis://****@localhost:6379",
  "timestamp": "2026-01-02T16:00:00.000Z"
}
```

### Manual PubSub Test

Test with the existing test script:

```bash
cd backend
yarn ts-node redis/test-redis-pubsub.ts
```

## Monitoring

### Check Redis Status

```bash
# Connect to Redis CLI
redis-cli

# Check stats
INFO stats

# Monitor PubSub in real-time
PUBSUB CHANNELS

# Subscribe to killmail events (for debugging)
SUBSCRIBE killmail:*
```

### Check System Health

```bash
# Check Redis connection
redis-cli ping

# Check RabbitMQ
docker ps | grep rabbitmq

# Check PostgreSQL
psql -U postgres -h localhost -c "SELECT 1"
```

## Troubleshooting

### Redis not connecting

```bash
# Check if Redis is running
redis-cli ping

# If using Homebrew
brew services info redis

# Start/restart if needed
brew services restart redis
```

### PubSub not working

**First, run the diagnostic:**

```bash
cd backend
yarn diagnose:redis
```

**Then check:**

1. Verify `USE_REDIS_PUBSUB=true` in `.env`
2. Check Redis is accessible: `redis-cli ping`
3. Check `/health/redis` endpoint
4. Review server logs for Redis connection errors
5. See [PRODUCTION_TROUBLESHOOTING.md](./PRODUCTION_TROUBLESHOOTING.md) for detailed guide

### Worker not publishing events

Check worker logs for:

```
📡 PubSub: Redis (distributed)  ✅ Good
📡 PubSub: In-memory (single process only)  ❌ Wrong config
```

## Scaling

### Multiple Worker Instances

```bash
# Terminal 2: Worker instance 1
WORKER_ID=1 yarn worker:redisq

# Terminal 3: Worker instance 2
WORKER_ID=2 yarn worker:redisq

# All workers publish to same Redis → All subscribers receive events
```

### Production Deployment

For production, use Redis cluster or managed Redis (AWS ElastiCache, Redis Cloud):

```bash
# .env (production)
REDIS_URL="redis://your-redis-cluster.com:6379"
REDIS_PASSWORD="your-secure-password"
USE_REDIS_PUBSUB=true
```

## Performance

- Redis PubSub has negligible latency (<1ms)
- No persistence required for PubSub messages
- Scales to thousands of messages/second
- Perfect for real-time updates
