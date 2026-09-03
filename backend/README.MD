# Killreport Backend

GraphQL API server for EVE Online killmail tracking and analytics.

## 🚀 Quick Start

### 1. Installation

```bash
# Install entire workspace from root
yarn install

# Or just backend
cd backend
yarn install
```

### 2. Environment Setup

Copy the template and fill it in (full reference [below](#environment-variables)):

```bash
cp .env.example .env
```

The minimum to boot:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/killreport"
RABBITMQ_URL="amqp://localhost:5672"
REDIS_URL="redis://localhost:6379"
EVE_CLIENT_ID="your_client_id"
EVE_CLIENT_SECRET="your_client_secret"
```

`src/config/config.ts` validates these on boot with Zod and exits with a readable
error listing anything missing.

### 3. Database Setup

The Prisma schema is split across `prisma/schema/*.prisma` (one file per model)
rather than a single `schema.prisma`.

```bash
yarn prisma:migrate    # Run migrations + generate Prisma client
yarn prisma:studio     # Open database GUI (optional)
```

### 4. Development Server

```bash
yarn dev              # http://localhost:4000/graphql
```

### 5. Initial Data Sync (Optional)

```bash
# Terminal 1: Queue alliances
yarn queue:alliances

# Terminal 2: Start worker
yarn worker:info:alliances

# For enrichment (find missing data from killmails)
yarn scan:entities
yarn worker:info:characters
yarn worker:info:corporations
```

Server runs on: **<http://localhost:4000/graphql>**

## Documentation

**→ [Full documentation index](./docs/README.md)** — architecture, authentication,
ESI, workers, leaderboards, caching, operations and deployment.

### Operations & Maintenance

- [**📅 Daily Operations Guide**](./docs/ops/daily.md) - Daily character/corporation sync and maintenance tasks
- [PM2 Process Management](./docs/ops/pm2.md) - How the API and workers run in production
- [Crontab](./docs/ops/crontab.md) - Scheduled jobs

### Core Features

- [Architecture Overview](./docs/architecture.md) - How the processes fit together
- [EVE SSO Authentication](./docs/authentication/eve-sso-readme.md)
- [GraphQL Schema](./src/generated-schema.graphql)
- [Database Schema](./prisma/schema/) - Split per model
- [**Killmail Enrichment System**](./docs/workers/enrichment.md) - Automatic data enrichment for killmails
- [**Capsule Value Calculation**](./docs/workers/capsule-value-calculation.md) - Fixed 10 ISK ship value for Capsules

### Workers & Background Jobs

- [**Complete Workers Documentation**](./docs/workers/worker-documentation.md) - All workers and queue systems
- [**RedisQ Real-Time Stream**](./docs/redis-cache/redisq-stream.md) - Live killmail feed from zKillboard
- [**Character Killmail Worker**](./docs/workers/character-killmail-worker.md) - Sync killmails for any character
- [Worker Status Monitoring](./docs/workers/worker-status-monitoring.md) - Worker and queue health
- [Alliance Documentation](./docs/workers/alliance.md) - Alliance data management
- [Alliance Corporations](./docs/workers/alliance-corporation.md) - Alliance corporation syncing
- [Corporation Killmail Sync](./docs/workers/corporation-killmail-sync.md) - Corporation killmail synchronization

### Performance & Optimization

- [**Top Charts Cost Analysis**](./docs/leaderboards/top-charts-cost-analysis.md) - Leaderboard aggregation cost analysis
- [Cache Strategy](./docs/redis-cache/cache-strategy.md) - Caching implementation and optimization
- [Performance Improvements](./docs/ops/performance-improvements.md) - Database and query optimizations
- [Redis Memory Planning](./docs/redis-cache/redis-memory-planning.md) - Sizing the cache
- [Redis Setup](./redis/REDIS_SETUP.MD) - Installing and configuring Redis

### API Integration

- [Rate Limiting](./docs/api/rate-limiting.md) - GraphQL API rate limiting
- [zKillboard API](./src/services/zkillboard.ts)
- [RabbitMQ Queue System](./src/services/rabbitmq.ts)
- [Rate Limiter](./src/services/rate-limiter.ts)
- [Dogma Services](./src/services/dogma/README.MD) - Type attribute/effect resolution

## 📋 Available Scripts

### Development

```bash
yarn dev              # Start dev server with hot reload
yarn codegen          # Generate GraphQL types
yarn codegen:watch    # Watch mode for codegen
yarn kill:port        # Kill process on port 4000
```

### Database

```bash
yarn prisma:generate  # Generate Prisma client
yarn prisma:migrate   # Run migrations
yarn prisma:studio    # Open Prisma Studio GUI
```

### Queue Management

```bash
# Queue data for syncing
yarn queue:alliances              # Queue all alliances
yarn queue:corporations           # Queue NPC corporations
yarn queue:alliance-corporations  # Queue alliance corporations
yarn queue:zkillboard             # Queue logged-in users' killmails
yarn queue:character <id>         # Queue specific character(s)

# Character & Corporation Management (NEW)
yarn queue:characters             # Queue ALL characters from DB for update
yarn queue:character-corporations # Scan characters, queue missing corporations

# Enrichment - scan killmails for missing entities
yarn scan:entities                # Queue missing characters/corps/alliances/types

# Backfill killmail values (calculate total_value for historical killmails)
yarn queue:backfill-values                    # Queue NULL values (default)
yarn queue:backfill-values --mode=null        # Queue only NULL values
yarn queue:backfill-values --mode=zero        # Queue only ZERO values
yarn queue:backfill-values --mode=all         # Queue ALL killmails (recalculate)
yarn queue:backfill-values --limit=1000       # Process only 1000 killmails
```

### Workers

```bash
# Info Workers (Enrichment - add missing data)
yarn worker:info:alliances        # Process alliance info queue (3 concurrent)
yarn worker:alliance-corporations # Process alliance corporations (5 concurrent)
yarn worker:info:corporations     # Process corporation info queue (5 concurrent)
yarn worker:info:characters       # Process character info queue (10 concurrent)
yarn worker:info:types            # Process type info queue (10 concurrent)

# Killmail Workers
yarn worker:zkillboard            # Process zKillboard killmail sync (2 concurrent)
yarn worker:redisq                # Real-time RedisQ stream (live feed)
yarn worker:backfill-values       # Calculate killmail values (5 concurrent)

# Snapshot Workers
yarn snapshot:alliances           # Generate alliance snapshots
```

### Direct Sync (No Queue)

```bash
# Sync specific character killmails directly
yarn sync:character <characterId> [maxPages]

# Examples:
yarn sync:character 95465499      # Default 50 pages
yarn sync:character 95465499 10   # Only 10 pages
yarn sync:character 95465499 999  # ALL history
```

### Utilities

```bash
yarn remove:all       # Clean all dependencies
```

## 🏗️ Tech Stack

### Core Technologies

- **Runtime**: Node.js 20+ with TypeScript (run via `tsx`)
- **API Framework**: GraphQL Yoga 5
- **Database**: PostgreSQL + Prisma ORM 7
- **Message Queue**: RabbitMQ (amqplib)
- **Cache & Pub/Sub**: Redis (ioredis)
- **Subscriptions**: `graphql-ws` over `ws`
- **Authentication**: EVE Online SSO (OAuth2) + JWT (jose)
- **Rate Limiting**: Custom ESI rate limiter (50 req/sec)

### External API Integrations

- **EVE ESI API**: EVE Online official API (character/corp/alliance/item data)
- **zKillboard API**: Killmail data source

### Architecture Features

- **GraphQL Schema**: Modular extend type pattern
- **DataLoader Pattern**: Prevents N+1 query problems
- **Worker System**: RabbitMQ-based distributed task processing
- **Connection Pooling**: Separate pools for API (5 conn) and Workers (2 conn)
- **Real-time**: GraphQL subscriptions over WebSocket (`graphql-ws`), optionally
  backed by Redis PubSub so events reach clients regardless of which process
  produced them — see [WebSocket deployment](./docs/deployment/websocket-deployment.md)
- **Code Generation**: GraphQL schema → TypeScript types (automatic)

## 🔍 GraphQL Playground

When server is running: **<http://localhost:4000/graphql>**

Example queries:

```graphql
query {
  alliances(limit: 10) {
    alliance_id
    name
    ticker
    member_count
  }
}

query {
  me {
    character_id
    name
    corporation {
      name
      ticker
    }
  }
}
```

## Environment Variables

Start from `.env.example`. Validation lives in [`src/config/config.ts`](./src/config/config.ts).

| Variable                   | Required | Default                               | Purpose                                          |
| -------------------------- | -------- | ------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`             | yes      | —                                     | PostgreSQL connection string                     |
| `EVE_CLIENT_ID`            | yes      | —                                     | EVE SSO application ID                           |
| `EVE_CLIENT_SECRET`        | yes      | —                                     | EVE SSO application secret                       |
| `EVE_CALLBACK_URL`         | no       | `http://localhost:4000/auth/callback` | Must match the EVE application                   |
| `FRONTEND_URL`             | no       | `http://localhost:3000`               | Post-login redirect target                       |
| `RABBITMQ_URL`             | no       | `amqp://localhost`                    | Job queue connection                             |
| `REDIS_URL`                | no       | —                                     | Response cache, RedisQ cursor, PubSub            |
| `USE_REDIS_PUBSUB`         | no       | —                                     | Fan subscriptions out across processes           |
| `JWT_SECRET`               | no       | —                                     | Session token signing key                        |
| `PORT`                     | no       | `4000`                                | API port                                         |
| `NODE_ENV`                 | no       | `development`                         | `development` \| `production` \| `test`          |
| `LOG_LEVEL`                | no       | `info`                                | `error` \| `warn` \| `info` \| `http` \| `debug` |
| `GRAPHQL_INTROSPECTION`    | no       | `true`                                | Disable in production                            |
| `GRAPHQL_PLAYGROUND`       | no       | `true`                                | Disable in production                            |
| `REDISQ_ENABLE_ENRICHMENT` | no       | —                                     | Enrich entities inline in the RedisQ worker      |

## Common Tasks

### Enrich Killmail Data (Add Missing Entities)

```bash
# 1. Scan killmails for missing data
yarn scan:entities

# 2. Start info workers (separate terminals)
yarn worker:info:alliances
yarn worker:info:corporations
yarn worker:info:characters
yarn worker:info:types
```

### Sync All Alliance Corporations

```bash
# 1. Queue all alliance IDs
yarn queue:alliance-corporations

# 2. Start workers (separate terminals)
yarn worker:alliance-corporations
yarn worker:info:corporations
```

### Sync Character Killmails

```bash
# Method 1: Direct sync (fastest for single character)
yarn sync:character 95465499

# Method 2: Queue system (for multiple)
yarn queue:character 95465499 123456 789012
yarn worker:zkillboard
```

### Check Database

```bash
# Open Prisma Studio GUI
yarn prisma:studio

# Or use psql
psql $DATABASE_URL
```

## Development Tips

1. **Hot Reload**: `yarn dev` watches for file changes
2. **Type Safety**: `yarn codegen` generates TypeScript types from GraphQL schema
3. **Database Changes**: Always run `yarn prisma:migrate` after schema changes
4. **Queue Monitoring**: RabbitMQ Management UI at <http://localhost:15672>

## Troubleshooting

### Port already in use

```bash
yarn kill:port
```

### Database connection issues

```bash
# Check PostgreSQL is running (Linux/macOS)
sudo systemctl status postgresql
# or
pg_isready

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### RabbitMQ connection issues

```bash
# Check RabbitMQ is running (Linux/macOS)
sudo systemctl status rabbitmq-server
# or
sudo rabbitmqctl status

# Restart RabbitMQ
sudo systemctl restart rabbitmq-server
```

### Prisma client errors

```bash
# Regenerate Prisma client
yarn prisma:generate
```

## License

MIT

---

## 📞 Contact

- **In-Game**: General XAN (EVE Online)
- **Issues**: [GitHub Issues](https://github.com/umutyerebakmaz/killreport/issues)

Feel free to send ISK, feedback, or questions in-game!
