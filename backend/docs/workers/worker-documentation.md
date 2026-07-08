# Workers Documentation

## Overview

KillReport uses a distributed worker system based on RabbitMQ. Each worker performs a specific task and runs as an independent process. This system is designed to manage ESI API rate limits and perform large data processing operations in parallel.

## Worker Types

### 1. Queue Scripts (Queueing Scripts)

Scripts responsible for adding jobs to the queue. They run once and close after adding jobs to the queue.

### 2. Worker Scripts (Worker Scripts)

Services that continuously listen to and process messages from the queue. They run continuously in the background.

## Worker Types

All workers operate with the **enrichment (automatic completion)** principle. They automatically fetch missing data from killmails or scheduled jobs from ESI and save to database.

### Info Workers (Entity Enrichment)

**Alliance Info Worker** - `worker-info-alliances.ts`:

- **Purpose**: Automatically populate missing alliance information from killmails- **Queue**: `esi_alliance_info_queue`
- **Usage**: `yarn worker:info:alliances`
- **Features**:
  - Processes 3 messages concurrently
  - Only adds new records (no updates)
  - Central rate limiter (50 req/sec)
  - Service abstraction (`getAllianceInfo()`)

**Corporation Info Worker** - `worker-info-corporations.ts`:

- **Purpose**: Automatically populate missing corporation information from killmails
- **Queue**: `esi_corporation_info_queue`
- **Usage**: `yarn worker:info:corporations`
- **Features**:
  - Processes 5 messages concurrently
  - Only adds new records (no updates)
  - Central rate limiter (50 req/sec)
  - Service abstraction (`getCorporationInfo()`)

---

## Queue Scripts

### `queue-alliances.ts`

**Purpose**: Fetches all alliance IDs from ESI and adds them to `esi_alliance_info_queue`.

**Usage**:

```bash
yarn queue:alliances
```

**How it works**:

1. Fetches all alliance IDs from ESI (`/alliances/` endpoint)
2. Adds each alliance ID to `esi_alliance_info_queue`
3. Processes in batches of 100

**Next Step**: Processed by `worker-info-alliances.ts`

---

### `queue-corporations.ts`

**Purpose**: Fetches all corporation IDs from ESI and adds them to queue.

**Usage**:

```bash
yarn queue:corporations
```

**Note**: See worker file for details.

---

### `queue-character-killmails.ts`

**Purpose**: Adds characters of users in database to `zkillboard_character_queue`.

**Usage**:

```bash
yarn queue:character
```

**How it works**:

1. Fetches all users from database
2. Prepares character information for each user
3. Adds to `zkillboard_character_queue`

**Queue**: `zkillboard_character_queue`

**Next Step**: Processed by `worker-zkillboard-sync.ts`

---

### `queue-zkillboard-sync.ts`

**Purpose**: Adds jobs to queue to synchronize killmails of a specific character.

**Usage**:

```bash
yarn queue:zkillboard
```

**Queue**: `zkillboard_character_queue`

---

### `queue-alliance-corporations.ts` ⭐ NEW

**Purpose**: Adds IDs of all alliances in database to `esi_alliance_corporations_queue`.

**Usage**:

```bash
yarn queue:alliance-corporations
```

**How it works**:

1. Fetches all alliance IDs from database
2. Adds each alliance ID to `esi_alliance_corporations_queue`

**Queue**: `esi_alliance_corporations_queue`

**Next Step**: Processed by `worker-alliance-corporations.ts`

---

### `scan-killmail-entities.ts`

**Purpose**: Scans all entities (character, corporation, alliance, type) in killmails and adds missing ones in database to respective queues.

**Usage**:

```bash
yarn scan:entities
```

**How it works**:

1. Scans all killmails in database (100 per batch)
2. Collects character, corporation, alliance, type IDs from each killmail
3. Filters NPCs (character_id < 1M or between 3M-4M)
4. Identifies missing ones in database
5. Adds to separate queue for each entity type

**Queues**:

- `esi_character_info_queue`
- `esi_corporation_info_queue`
- `esi_alliance_info_queue`
- `esi_type_info_queue`

**Next Step**: Processed by respective enrichment workers

---

## Worker Scripts

### `worker-info-alliances.ts`

**Purpose**: Fetches alliance IDs from ESI and saves to database.

**Usage**:

```bash
yarn worker:info:alliances
```

**Queue**: `esi_alliance_info_queue`

**Concurrency**: 3 (processes 3 alliances simultaneously)

**How it works**:

1. Gets alliance ID from queue
2. Skips if already exists in database
3. Fetches alliance information from ESI (`getAllianceInfo()`)
4. Saves to database with `upsert` (race condition prevention)

**ESI Endpoint**: `/alliances/{alliance_id}/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

---

### `worker-info-corporations.ts`

**Purpose**: Fetches corporation IDs from ESI and saves to database.

**Usage**:

```bash
yarn worker:info:corporations
```

**Queue**: `esi_corporation_info_queue`

**Concurrency**: 5 (processes 5 corporations simultaneously)

**How it works**:

1. Gets corporation ID from queue
2. Skips if already exists in database
3. Fetches corporation information from ESI (`getCorporationInfo()`)
4. Saves to database with `upsert`

**ESI Endpoint**: `/corporations/{corporation_id}/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

---

### `worker-info-characters.ts`

**Purpose**: Fetches character IDs from ESI and saves to database.

**Usage**:

```bash
yarn worker:info:characters
```

**Queue**: `esi_character_info_queue`

**Concurrency**: 10 (processes 10 characters simultaneously)

**How it works**:

1. Gets character ID from queue
2. Filters NPCs (id < 1M or 3M-4M range)
3. Skips if already exists in database
4. Fetches character information from ESI (`getCharacterInfo()`)
5. Saves to database with `upsert`

**ESI Endpoint**: `/characters/{character_id}/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

---

### `worker-info-types.ts`

**Purpose**: Fetches type/item IDs from ESI and saves to database.

**Usage**:

```bash
yarn worker:info:types
```

**Queue**: `esi_type_info_queue`

**Concurrency**: 10 (processes 10 types simultaneously)

**How it works**:

1. Gets type ID from queue
2. Skips if already exists in database
3. Fetches type information from ESI (`getTypeInfo()`)
4. Saves to database with `upsert`

**ESI Endpoint**: `/universe/types/{type_id}/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

---

### `worker-zkillboard-sync.ts`

**Purpose**: Fetches killmails of users/characters from zKillboard and saves to database.

**Usage**:

```bash
yarn worker:zkillboard
```

**Queue**: `zkillboard_character_queue`

**Concurrency**: 2 (due to rate limit)

**How it works**:

1. Gets user/character information from queue
2. Fetches killmail IDs from zKillboard (200/page, max 100 pages)
3. Gets details from ESI for each killmail
4. Saves to database (together with victim, attackers, items)
5. Uses 10 second zKillboard delay, rate limiter for ESI

**ESI Endpoint**: `/killmails/{killmail_id}/{hash}/`

**zKillboard Endpoint**: `/api/kills/characterID/{character_id}/`

**Rate Limits**:

- zKillboard: 10 seconds for same endpoint
- ESI: 50 req/sec with `esiRateLimiter`

---

### `worker-alliance-snapshots.ts`

**Purpose**: Creates and saves alliance snapshots.

**Usage**:

```bash
yarn snapshot:alliances
```

**Note**: See worker file for details.

---

### `worker-alliance-corporations.ts` ⭐ NEW

**Purpose**: Fetches corporation IDs belonging to alliances from ESI and adds them to `esi_esi_corporation_info_queue`.

**Usage**:

```bash
yarn worker:alliance-corporations
```

**Queue**: `esi_alliance_corporations_queue`

**Concurrency**: 5 (processes 5 alliances simultaneously)

**How it works**:

1. Gets alliance ID from queue
2. Fetches alliance's corporation IDs from ESI (`/alliances/{alliance_id}/corporations/`)
3. Adds each corporation ID to `esi_corporation_info_queue`
4. Thus `worker-info-corporations.ts` processes these IDs

**ESI Endpoint**: `/alliances/{alliance_id}/corporations/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

**Next Step**: Processed by `worker-info-corporations.ts`

---

## Other Scripts

### `sync-character-killmails.ts`

**Purpose**: Directly synchronizes killmails for a specific character (without using queue).

**Usage**:

```bash
yarn sync:character <characterId> [maxPages]
```

**Example**:

```bash
yarn sync:character 95465499 50     # 50 pages (10,000 killmails)
yarn sync:character 95465499 999    # ALL history
```

**How it works**:

1. Fetches killmail IDs from zKillboard
2. Gets details from ESI for each killmail
3. Saves directly to database
4. Shows progress

**Note**: Useful for small tasks. Worker system should be preferred for large tasks.

---

## Workflows

### 1. Killmail Enrichment Workflow

**Purpose**: Complete missing entity information from killmails

```
┌─────────────────────┐
│ yarn scan:entities  │ - Scans killmails
└──────────┬──────────┘
           │
           ├──────────────────────────────────┐
           │                                  │
           ▼                                  ▼
┌──────────────────────┐          ┌────────────────────────┐
│ character_enrichment │          │ corporation_enrichment │
│       _queue         │          │        _queue          │
└──────────┬───────────┘          └───────────┬────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────┐          ┌────────────────────────┐
│ worker:info:         │          │ worker:info:           │
│    characters        │          │    corporations        │
└──────────────────────┘          └────────────────────────┘
           │                                  │
           ├──────────────────────────────────┤
           ▼                                  ▼
┌──────────────────────────────────────────────┐
│         PostgreSQL Database                  │
│  (characters, corporations, alliances, types)│
└──────────────────────────────────────────────┘
```

**Steps**:

1. `yarn scan:entities` - Detect missing entities in killmails
2. `yarn worker:info:characters` - Fetch character information
3. `yarn worker:info:corporations` - Fetch corporation information
4. `yarn worker:info:alliances` - Fetch alliance information
5. `yarn worker:info:types` - Fetch type information

---

### 2. User Killmail Sync Workflow

**Purpose**: Synchronize users' killmails

```
┌──────────────────┐
│ yarn queue:      │ - Add users to queue
│   character      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ killmail_sync_   │
│     queue        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ worker:zkillboard│ - Fetch from zKillboard
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ PostgreSQL       │
│  (killmails)     │
└──────────────────┘
```

**Steps**:

1. `yarn queue:character` - Add users to queue
2. `yarn worker:zkillboard` - Fetch and save killmails

---

### 3. Alliance Corporation Enrichment Workflow ⭐ NEW

**Purpose**: Add all corporations belonging to alliances to database

```
┌─────────────────────────┐
│ yarn queue:alliance-    │ - Add alliances from DB to queue
│    corporations         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ alliance_corporation_   │
│        queue            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ worker:alliance-        │ - Fetch alliance corp IDs from ESI
│    corporations         │ - Add to esi_corporation_info_queue
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ corporation_enrichment_ │
│        queue            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ worker:info:            │ - Fetch corporation info from ESI
│    corporations         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│    PostgreSQL Database  │
│     (corporations)      │
└─────────────────────────┘
```

**Steps**:

1. `yarn queue:alliance-corporations` - Add alliance IDs to queue
2. `yarn worker:alliance-corporations` - Get corp IDs for each alliance and add to queue
3. `yarn worker:info:corporations` - Fetch and save corporation information

---

## Rate Limiting

### ESI Rate Limiter

**File**: `src/services/rate-limiter.ts`

**Settings**:

- Max: 50 req/sec (ESI limit is 150 but 50 for safe play)
- Min delay: 20ms

**Usage**: All ESI functions automatically use rate limiter

```typescript
return esiRateLimiter.execute(async () => {
  // ESI API call
});
```

### zKillboard Rate Limiting

**Rule**: 10 second wait for same endpoint

**Implementation**: Manual delay in `zkillboard.ts` service

---

## RabbitMQ Queue System

### Queue Properties

- **Durable**: true (messages don't get lost after RabbitMQ restart)
- **Priority**: 0-10 priority system
- **Prefetch**: Different for each worker (concurrency control)

### Message Format

```typescript
interface EntityQueueMessage {
  entityId: number; // Entity ID to process
  queuedAt: string; // Queue time (ISO string)
  source: string; // Message source (e.g., "killmail_scan")
}
```

### Queue Names

| Queue Name                        | Purpose                       |
| --------------------------------- | ----------------------------- |
| `esi_alliance_info_queue`         | Fetch alliance information    |
| `esi_corporation_info_queue`      | Fetch corporation information |
| `esi_character_info_queue`        | Fetch character information   |
| `esi_type_info_queue`             | Fetch type information        |
| `zkillboard_character_queue`      | zKillboard killmail fetching  |
| `esi_alliance_corporations_queue` | Fetch alliance corp IDs       |

---

## Concurrency Settings

| Worker                  | Prefetch | Description                  |
| ----------------------- | -------- | ---------------------------- |
| enrichment-alliances    | 3        | Safe for ESI rate limit      |
| enrichment-corporations | 5        | Medium level concurrency     |
| enrichment-characters   | 10       | High concurrency             |
| enrichment-types        | 10       | High concurrency             |
| zkillboard-sync         | 2        | Due to zKillboard rate limit |
| alliance-corporations   | 5        | Safe for ESI rate limit      |

---

## Monitoring

### Worker Status

Worker status can be queried via GraphQL:

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

### Logs

Each worker provides detailed log output:

- Startup information (queue name, prefetch)
- Processing progress (processed/added/skipped/errors)
- Completion summary
- Error details

---

## Best Practices

### 1. Start Workers in Order

For enrichment operations:

```bash
# 1. Scan entities and add to queue
yarn scan:entities

# 2. Start workers (separate terminals)
yarn worker:info:alliances
yarn worker:info:corporations
yarn worker:info:characters
yarn worker:info:types
```

### 2. Alliance Corporation Enrichment

```bash
# 1. Add alliances to queue
yarn queue:alliance-corporations

# 2. Start workers (separate terminals)
yarn worker:alliance-corporations
yarn worker:info:corporations
```

### 3. In Case of Error

- If worker gets error, it nacks and requeues message
- Messages don't get lost because RabbitMQ messages are durable
- You can continue by restarting worker

### 4. Performance Monitoring

- Adjust concurrency values as needed
- If you get ESI rate limit error, decrease prefetch value
- Adjust database connection pool size according to worker count

---

## New Worker Template

```typescript
/**
 * [Worker Name] Worker
 * [Description]
 */

import { config } from "@config/config";
import prisma from "@services/prisma";
import { getRabbitMQChannel } from "@services/rabbitmq";

const QUEUE_NAME = "your_queue_name";
const PREFETCH_COUNT = 5; // Concurrency

interface EntityQueueMessage {
  entityId: number;
  queuedAt: string;
  source: string;
}

async function yourWorker() {
  console.log("🚀 Your Worker Started");
  console.log(`📦 Queue: ${QUEUE_NAME}`);
  console.log(`⚡ Prefetch: ${PREFETCH_COUNT} concurrent\n`);

  try {
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: { "x-max-priority": 10 },
    });

    channel.prefetch(PREFETCH_COUNT);

    console.log("✅ Connected to RabbitMQ");
    console.log("⏳ Waiting for messages...\n");

    let totalProcessed = 0;
    let totalErrors = 0;

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;

        const message: EntityQueueMessage = JSON.parse(msg.content.toString());
        const entityId = message.entityId;

        try {
          // Processing logic goes here

          channel.ack(msg);
          totalProcessed++;
          console.log(`  ✅ [${totalProcessed}] Processed ${entityId}`);
        } catch (error) {
          totalErrors++;
          console.error(`  ❌ [${totalProcessed}] Error:`, error);
          channel.nack(msg, false, true); // Requeue
        }
      },
      { noAck: false },
    );
  } catch (error) {
    console.error("💥 Worker failed to start:", error);
    process.exit(1);
  }
}

yourWorker();
```

---

## Troubleshooting

### Worker Not Starting

- Check if RabbitMQ is running: `docker ps`
- Is RABBITMQ_URL correct in .env file?
- Is port 5672 open?

### ESI Rate Limit Error

- Decrease prefetch value
- Don't run multiple worker instances
- Check `esiRateLimiter` settings

### Database Connection Error

- Is PostgreSQL running?
- Is DATABASE_URL correct?
- Is connection pool size sufficient?

### Messages Not Being Processed

- Check if worker is running
- Check if messages exist in queue: GraphQL `workerStatus` query
- Is consumer count > 0?

---

## Future Improvements

1. **Dead Letter Queue**: Separate queue for failed messages
2. **Retry Strategy**: Automatic retry with exponential backoff
3. **Worker Health Checks**: Prometheus metrics
4. **Dynamic Scaling**: Automatic worker scaling based on queue length
5. **Dashboard**: RabbitMQ Management UI integration
