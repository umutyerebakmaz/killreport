# Workers Documentation

## Overview

KillReport uses a distributed worker system based on RabbitMQ. Each worker performs a specific task and runs as an independent process. This system is designed to manage ESI API rate limits and perform large data operations in parallel.

## Worker Types

### 1. Queue Scripts

Scripts responsible for adding jobs to the queue. They run once and shut down after adding jobs to the queue.

### 2. Worker Scripts

Services that continuously listen to and process messages from the queue. They run continuously in the background.

## Worker Types

All workers operate on the **enrichment (auto-completion)** principle. They automatically fetch missing data from ESI (from killmails or scheduled jobs) and save it to the database.

### Info Workers (Entity Enrichment)

**Alliance Info Worker** - `worker-info-alliances.ts`:

- **Purpose**: Automatically fill in missing alliance information from killmails
- **Queue**: `esi_alliance_info_queue`
- **Usage**: `yarn worker:info:alliances`
- **Features**:
  - Processes 3 messages in parallel (concurrent)
  - Only inserts new records (no updates)
  - Centralized rate limiter (50 req/sec)
  - Service abstraction (`getAllianceInfo()`)

**Corporation Info Worker** - `worker-info-corporations.ts`:

- **Purpose**: Automatically fill in missing corporation information from killmails
- **Queue**: `esi_corporation_info_queue`
- **Usage**: `yarn worker:info:corporations`
- **Features**:
  - Processes 5 messages in parallel (concurrent)
  - Only inserts new records (no updates)
  - Centralized rate limiter (50 req/sec)
  - Service abstraction (`getCorporationInfo()`)

---

## Queue Scripts

### `queue-alliances.ts`

**Purpose**: Fetches all alliance IDs from ESI and adds them to `esi_alliance_info_queue`.

**Usage**:

```bash
yarn queue:alliances
```

**Process**:

1. Fetches all alliance IDs from ESI (`/alliances/` endpoint)
2. Adds each alliance ID to `esi_alliance_info_queue`
3. Processes in batches of 100

**Next Step**: Processed by `worker-info-alliances.ts`

---

### `queue-corporations.ts`

**Purpose**: Fetches all corporation IDs from ESI and adds them to the queue.

**Usage**:

```bash
yarn queue:corporations
```

**Note**: See the worker file for details.

---

### `queue-character-killmails.ts`

**Purpose**: Adds users' characters from the database to `zkillboard_character_queue`.

**Usage**:

```bash
yarn queue:character
```

**Process**:

1. Fetches all users from the database
2. Prepares character information for each user
3. Adds to `zkillboard_character_queue`

**Queue**: `zkillboard_character_queue`

**Next Step**: Processed by `worker-zkillboard-sync.ts`

---

### `queue-zkillboard-sync.ts`

**Purpose**: Adds a job to the queue to synchronize a specific character's killmails.

**Usage**:

```bash
yarn queue:zkillboard
```

**Queue**: `zkillboard_character_queue`

---

### `queue-alliance-corporations.ts` ⭐ NEW

**Purpose**: Adds all alliance IDs from the database to `esi_alliance_corporations_queue`.

**Usage**:

```bash
yarn queue:alliance-corporations
```

**Process**:

1. Fetches all alliance IDs from the database
2. Adds each alliance ID to `esi_alliance_corporations_queue`

**Queue**: `esi_alliance_corporations_queue`

**Next Step**: Processed by `worker-alliance-corporations.ts`

---

### `scan-killmail-entities.ts`

**Purpose**: Scans all entities (character, corporation, alliance, type) in killmails and adds missing ones to relevant queues.

**Usage**:

```bash
yarn scan:entities
```

**Process**:

1. Scans all killmails in the database (in batches of 100)
2. Collects character, corporation, alliance, type IDs from each killmail
3. Filters NPCs (character_id < 1M or between 3M-4M)
4. Identifies missing ones in the database
5. Adds to separate queues for each entity type

**Queues**:

- `esi_character_info_queue`
- `esi_corporation_info_queue`
- `esi_alliance_info_queue`
- `esi_type_info_queue`

**Next Step**: Processed by relevant enrichment workers

---

## Worker Scripts

### `worker-info-alliances.ts`

**Purpose**: Fetches alliance IDs from ESI and saves them to the database.

**Usage**:

```bash
yarn worker:info:alliances
```

**Queue**: `esi_alliance_info_queue`

**Concurrency**: 3 (processes 3 alliances simultaneously)

**Process**:

1. Gets alliance ID from the queue
2. Skips if already exists in the database
3. Fetches alliance information from ESI (`getAllianceInfo()`)
4. Saves to database with `upsert` (prevents race conditions)

**ESI Endpoint**: `/alliances/{alliance_id}/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

---

### `worker-info-corporations.ts`

**Purpose**: Fetches corporation IDs from ESI and saves them to the database.

**Usage**:

```bash
yarn worker:info:corporations
```

**Queue**: `esi_corporation_info_queue`

**Concurrency**: 5 (processes 5 corporations simultaneously)

**Process**:

1. Gets corporation ID from the queue
2. Skips if already exists in the database
3. Fetches corporation information from ESI (`getCorporationInfo()`)
4. Saves to database with `upsert`

**ESI Endpoint**: `/corporations/{corporation_id}/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

---

### `worker-info-characters.ts`

**Purpose**: Fetches character IDs from ESI and saves them to the database.

**Usage**:

```bash
yarn worker:info:characters
```

**Queue**: `esi_character_info_queue`

**Concurrency**: 10 (processes 10 characters simultaneously)

**Process**:

1. Gets character ID from the queue
2. Filters NPCs (id < 1M or between 3M-4M)
3. Skips if already exists in the database
4. Fetches character information from ESI (`getCharacterInfo()`)
5. Saves to database with `upsert`

**ESI Endpoint**: `/characters/{character_id}/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

---

### `worker-info-types.ts`

**Purpose**: Fetches type/item IDs from ESI and saves them to the database.

**Usage**:

```bash
yarn worker:info:types
```

**Queue**: `esi_type_info_queue`

**Concurrency**: 10 (processes 10 types simultaneously)

**Process**:

1. Gets type ID from the queue
2. Skips if already exists in the database
3. Fetches type information from ESI (`getTypeInfo()`)
4. Saves to database with `upsert`

**ESI Endpoint**: `/universe/types/{type_id}/`

**Rate Limit**: 50 req/sec with `esiRateLimiter`

---

## Best Practices

### 1. Starting Workers in Order

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

### 2. In Case of Error

- If worker gets an error, it nacks the message and requeues
- Messages don't get lost because RabbitMQ messages are durable
- You can restart the worker to continue

### 3. Performance Monitoring

- Adjust concurrency values as needed
- If you get ESI rate limit errors, decrease prefetch value
- Adjust database connection pool size according to number of workers
