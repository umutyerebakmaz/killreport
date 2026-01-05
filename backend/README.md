# Killreport Backend

GraphQL API server for EVE Online killmail tracking and analytics.

## Quick Start

```bash
# Install dependencies
yarn install

# Setup database
yarn prisma:migrate
yarn prisma:generate

# Start development server
yarn dev
```

Server runs on: http://localhost:4000/graphql

## Documentation

### Operations & Maintenance

- [**📅 Daily Operations Guide**](./DAILY_OPERATIONS.md) - Günlük karakter/corporation sync ve bakım işlemleri

### Core Features

- [EVE SSO Authentication](./src/docs/EVE_SSO_README.md)
- [GraphQL Schema](./src/generated-schema.graphql)
- [Database Schema](./prisma/schema.prisma)
- [**Killmail Enrichment System**](./src/docs/ENRICHMENT_README.md) - Automatic data enrichment for killmails

### Workers & Background Jobs

- [**Complete Workers Documentation**](./src/docs/WORKERS_DOCUMENTATION.md) - All workers and queue systems
- [**RedisQ Real-Time Stream**](./src/docs/redisq-stream.md) - Live killmail feed from zKillboard
- [**Character Killmail Worker**](./src/docs/CHARACTER_KILLMAIL_WORKER.md) - Sync killmails for any character
- [Alliance Documentation](./src/docs/ALLIANCE.md) - Alliance data management
- [Alliance Corporations](./src/docs/ALLIANCE_CORPORATION.md) - Alliance corporation syncing

### API Integration

- [EVE ESI API](./src/services/eve-esi.ts)
- [zKillboard API](./src/services/zkillboard.ts)
- [RabbitMQ Queue System](./src/services/rabbitmq.ts)
- [Rate Limiter](./src/services/rate-limiter.ts)

## Available Scripts

### Development

```bash
yarn dev              # Start dev server with hot reload
yarn codegen          # Generate GraphQL types
yarn codegen:watch    # Watch mode for codegen
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
```

### Workers

```bash
# Info Workers (Enrichment - add missing data)
yarn worker:info:alliances        # Process alliance info queue (3 concurrent)
yarn worker:info:corporations     # Process corporation info queue (5 concurrent)
yarn worker:info:characters       # Process character info queue (10 concurrent)
yarn worker:info:types            # Process type info queue (10 concurrent)

# Bulk Sync Workers
yarn worker:alliances             # Process alliance bulk sync (1 concurrent)
yarn worker:corporations          # Process corporation bulk sync (1 concurrent)
yarn worker:alliance-corporations # Process alliance corporations (5 concurrent)

# Killmail Workers
yarn worker:zkillboard            # Process zKillboard killmail sync (2 concurrent)
yarn worker:redisq                # Real-time RedisQ stream (live feed)

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

### Testing

```bash
yarn test:enrichment  # Test killmail enrichment system
```

### Utilities

```bash
yarn kill:port        # Kill process on port 4000
yarn remove:all       # Clean all dependencies
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **API**: GraphQL (yoga)
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: RabbitMQ
- **Auth**: EVE Online SSO (OAuth2)
- **External APIs**:
  - EVE ESI API
  - zKillboard API

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration files
├── src/
│   ├── resolvers/              # GraphQL resolvers
│   │   ├── alliance.resolver.ts
│   │   ├── auth.resolver.ts
│   │   ├── character.resolver.ts
│   │   ├── corporation.resolver.ts
│   │   ├── killmail.resolver.ts
│   │   └── user.resolver.ts
│   ├── schema/                 # GraphQL schema definitions
│   │   ├── alliance.graphql
│   │   ├── auth.graphql
│   │   ├── character.graphql
│   │   ├── corporation.graphql
│   │   ├── killmail.graphql
│   │   └── user.graphql
│   ├── services/               # External services
│   │   ├── database.ts         # Database connection
│   │   ├── dataloaders.ts      # DataLoader for N+1 queries
│   │   ├── eve-esi.ts          # EVE ESI API client
│   │   ├── eve-sso.ts          # EVE SSO authentication
│   │   ├── prisma.ts           # Prisma client
│   │   ├── rabbitmq.ts         # RabbitMQ queue
│   │   ├── rate-limiter.ts     # ESI rate limiting
│   │   └── zkillboard.ts       # zKillboard API client
│   ├── workers/                # Background workers
│   │   ├── queue-alliances.ts
│   │   ├── queue-alliance-corporations.ts
│   │   ├── queue-character-killmails.ts
│   │   ├── queue-corporations.ts
│   │   ├── queue-zkillboard-sync.ts
│   │   ├── scan-killmail-entities.ts
│   │   ├── sync-character-killmails.ts
│   │   ├── worker-alliance-corporations.ts
│   │   ├── worker-alliance-snapshots.ts
│   │   ├── worker-corporations.ts
│   │   ├── worker-info-alliances.ts
│   │   ├── worker-info-characters.ts
│   │   ├── worker-info-corporations.ts
│   │   ├── worker-info-types.ts
│   │   ├── worker-killmails.ts
│   │   └── worker-zkillboard-sync.ts
│   ├── config.ts               # Configuration
│   ├── server.ts               # Main server file
│   ├── generated-schema.graphql
│   ├── generated-schema.ts
│   └── generated-types.ts
└── package.json
```

## Environment Variables

Create a `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/killreport"

# RabbitMQ
RABBITMQ_URL="amqp://localhost:5672"

# EVE Online SSO
EVE_CLIENT_ID="your_client_id"
EVE_CLIENT_SECRET="your_client_secret"
EVE_CALLBACK_URL="http://localhost:4000/auth/callback"

# Frontend URL (for redirects)
FRONTEND_URL="http://localhost:3000"
```

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
4. **Queue Monitoring**: RabbitMQ Management UI at http://localhost:15672

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
