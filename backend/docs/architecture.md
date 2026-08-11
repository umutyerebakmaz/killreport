# 🚀 KillReport Backend - Independent Process Architecture

## Architecture Overview

The backend uses an **independent process architecture** for maximum flexibility and scalability:

```mermaid
flowchart TB
    Client["Frontend<br/><i>Next.js</i>"]

    subgraph procs["Node processes — supervised by PM2"]
        direction LR
        Server["<b>Server process</b><br/>GraphQL API · Auth<br/>Subscriptions · :4000"]
        Workers["<b>Worker processes</b><br/>RedisQ stream · User killmails<br/>Enrichment · Snapshots"]
    end

    subgraph infra["Infrastructure"]
        direction LR
        Rabbit["RabbitMQ<br/><i>job queue · :5672</i>"]
        Redis[("Redis<br/><i>PubSub · cache · :6379</i>")]
        Postgres[("PostgreSQL<br/><i>:5432</i>")]
    end

    External["EVE ESI · zKillboard"]

    Client -->|"queries, mutations<br/>over HTTP"| Server
    Server -.->|"subscription events<br/>over WebSocket"| Client

    Server -->|"reads"| Postgres
    Server -->|"enqueues jobs<br/>from mutations"| Rabbit

    Rabbit -->|"consumed by"| Workers
    Workers -->|"fetches killmails<br/>and entity data"| External
    Workers -->|"writes"| Postgres

    Workers -->|"publishes events"| Redis
    Redis -.->|"delivers events"| Server
```

The two process groups never talk to each other directly. Workers announce what they
wrote by publishing to Redis; the server picks those events up and pushes them to
subscribed clients. That indirection is what lets either side restart without the
other noticing.

## Why This Architecture?

### ✅ Benefits

1. **Independence**: Server and workers run separately
2. **Scalability**: Run multiple worker instances
3. **Reliability**: Worker crash doesn't affect server
4. **Development**: Easier debugging and testing
5. **Production-Ready**: Deploy services independently

### 🆚 vs In-Memory PubSub

| Feature            | In-Memory                | Redis PubSub   |
| ------------------ | ------------------------ | -------------- |
| Process isolation  | ❌ Same process          | ✅ Independent |
| Horizontal scaling | ❌ No                    | ✅ Yes         |
| Worker restart     | ❌ Server restart needed | ✅ Independent |
| Production ready   | ⚠️ Limited               | ✅ Yes         |

## Quick Start

### 1. Verify Services Running

```bash
# Redis
redis-cli ping
# Should return: PONG

# macOS (Homebrew)
brew services list | grep -E '(redis|postgresql|rabbitmq)'

# Linux (Ubuntu/Debian)
sudo systemctl status redis-server
sudo systemctl status postgresql
sudo systemctl status rabbitmq-server
```

### 2. Run Database Migrations

```bash
yarn prisma:migrate
```

### 3. Start Server (Terminal 1)

```bash
yarn dev
```

Server starts on <http://localhost:4000/graphql>

### 4. Start Workers (Separate Terminals)

```bash
# Terminal 2: RedisQ Worker (real-time killmail stream)
yarn worker:redisq

# Terminal 3: User Killmail Worker
yarn worker:user-killmails
```

### 5. Queue Jobs

```bash
# Queue users for killmail sync
yarn queue:user-killmails

# Queue other background jobs
yarn queue:alliances
yarn queue:corporations
```

## Configuration

### Environment Variables (.env)

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/killreport"

# Message Queue
RABBITMQ_URL="amqp://localhost"

# Redis PubSub (REQUIRED for independent processes)
REDIS_URL="redis://localhost:6379"
USE_REDIS_PUBSUB=true

# EVE SSO
EVE_CLIENT_ID=your_client_id
EVE_CLIENT_SECRET=your_client_secret
EVE_CALLBACK_URL=http://localhost:4000/auth/callback
```

## Available Workers

### Real-Time Workers

```bash
# RedisQ Stream - Real-time killmails from zKillboard
yarn worker:redisq

# User Killmails - Authenticated user killmail sync
yarn worker:user-killmails
```

### Enrichment Workers

```bash
# Character info enrichment
yarn worker:info:characters

# Corporation info enrichment
yarn worker:info:corporations

# Alliance info enrichment
yarn worker:info:alliances

# Type (ship/item) info enrichment
yarn worker:info:types
```

### Background Jobs

```bash
# Alliance snapshots (daily statistics)
yarn snapshot:alliances

# Corporation snapshots
yarn snapshot:corporations

# Sync all alliances
yarn queue:alliances && yarn worker:info:alliances
```

## GraphQL Subscriptions

### How It Works

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as Server process
    participant R as Redis PubSub
    participant W as Worker process
    participant DB as PostgreSQL

    C->>S: subscribe (WebSocket)
    S->>R: SUBSCRIBE killmail channel
    Note over C,S: connection stays open

    W->>DB: save killmail
    W->>R: PUBLISH event
    R-->>S: event
    S-->>C: push update

    Note over S,W: neither process knows the other exists
```

### Example Subscription

```graphql
subscription OnNewKillmail {
  killmailAdded {
    killmailId
    killmailTime
    victim {
      characterName
      shipTypeName
    }
  }
}
```

## Development Workflow

### Typical Development Session

```bash
# In separate terminals:

# Terminal 1: Server (auto-restarts on file changes)
yarn dev

# Terminal 2: RedisQ Worker
yarn worker:redisq

# Terminal 3: User Killmail Worker
yarn worker:user-killmails

# Terminal 4: Run commands as needed
yarn queue:user-killmails
yarn prisma:studio
```

### Stopping Services

```bash
# macOS (Homebrew)
brew services stop redis
brew services stop postgresql@15
brew services stop rabbitmq

# Linux (Ubuntu/Debian)
sudo systemctl stop redis-server
sudo systemctl stop postgresql
sudo systemctl stop rabbitmq-server
```

## Monitoring

### Service Health Checks

```bash
# Check Redis
redis-cli ping

# Check RabbitMQ
curl http://localhost:15672/api/overview

# Check PostgreSQL
# macOS
psql postgres -c "SELECT 1"

# Linux
sudo -u postgres psql -c "SELECT 1"
```

### Management UIs

- **RabbitMQ**: <http://localhost:15672> (guest/guest)
- **Prisma Studio**: `yarn prisma:studio` → <http://localhost:5555>
- **GraphiQL**: <http://localhost:4000/graphql>

## Troubleshooting

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# macOS (Homebrew)
brew services info redis
brew services restart redis
tail -f /usr/local/var/log/redis.log

# Linux (Ubuntu/Debian)
sudo systemctl status redis-server
sudo systemctl restart redis-server
sudo journalctl -u redis-server -f
```

### Worker Not Processing

```bash
# Check RabbitMQ queues
curl -u guest:guest http://localhost:15672/api/queues

# Reset RabbitMQ (clears all queues)
yarn rabbitmq:reset
```

### Subscriptions Not Working

1. Verify `USE_REDIS_PUBSUB=true` in `.env`
2. Check Redis is running: `redis-cli ping`
3. Look for "Redis (distributed)" in server logs
4. Restart server and workers

## Production Deployment

For production, use managed services:

- **PostgreSQL**: AWS RDS, DigitalOcean Managed Database
- **RabbitMQ**: CloudAMQP, AWS MQ
- **Redis**: Redis Cloud, AWS ElastiCache, Upstash

### Scaling Workers

Workers that consume from RabbitMQ scale by running more instances — the broker
load-balances deliveries across them:

```bash
# Run multiple instances of a queue-backed worker
yarn worker:info:characters &
yarn worker:info:characters &
yarn worker:info:characters &
```

Per-instance concurrency is the `PREFETCH_COUNT` constant at the top of each worker
file; raise it before adding instances, and keep the total within ESI's rate limit.

> **Do not scale `worker:redisq` this way.** It is not a queue consumer — it walks
> zKillboard's killmail stream sequentially using a cursor, so a second instance
> re-reads the same sequence and processes every killmail twice. Run exactly one.

## Performance Tips

1. **Worker Concurrency**: Adjust `PREFETCH_COUNT` in workers
2. **Database Pooling**: Configure in `prisma.config.ts`
3. **Redis Memory**: Monitor with `redis-cli INFO memory`
4. **Queue Monitoring**: Check RabbitMQ management UI

## Learn More

- [REDIS_SETUP.MD](../redis/REDIS_SETUP.MD) - Detailed Redis configuration
- [docs/worker-documentation.md](./workers/worker-documentation.md) - Worker patterns
- [docs/enrichment.md](./workers/enrichment.md) - Entity enrichment system
