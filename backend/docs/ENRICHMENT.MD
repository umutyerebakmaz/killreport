# Killmail Enrichment System

## Overview

When a new killmail is added to the database, information about **characters**, **corporations**, **alliances**, and **items (types)** are automatically fetched from ESI and saved to the database using a **microservice architecture** with specialized workers.

## Architecture

### Microservice Approach

The info fetch system uses 4 specialized workers for maximum scalability:

```bash
┌─────────────────┐
│  Killmails      │
│  Database       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  Scan Killmail Entities     │ ◄── Detects missing entities
│  (scan-killmail-entities)   │
└─────────┬───────────────────┘
          │
          ├──► esi_character_info_queue ──► Worker (10 concurrent)
          ├──► esi_corporation_info_queue ──► Worker (5 concurrent)
          ├──► esi_alliance_info_queue ──► Worker (3 concurrent)
          └──► esi_type_info_queue ──► Worker (10 concurrent)
```

### How It Works

1. **Scanner**: `scan-killmail-entities.ts` scans all killmails and detects missing entities
2. **Queuing**: Missing entities are queued to 4 separate RabbitMQ queues
3. **Workers**: Specialized workers process their respective queues independently
4. **ESI Fetching**: All workers use rate-limited ESI calls (50 req/sec max)
5. **Database**: Enriched data is saved to PostgreSQL

### Benefits

- **Independent Scaling**: Each worker can run multiple instances
- **Fault Tolerance**: One entity type failure doesn't block others
- **Monitoring**: Progress tracking per entity type
- **Efficiency**: Only processes missing entities (skip already enriched)

## Database Tables

### Types (New)

```prisma
model Type {
  id          Int     @id
  name        String
  description String?
  group_id    Int
  published   Boolean
  volume      Float?
  capacity    Float?
  mass        Float?
  icon_id     Int?
  // ...
}
```

Ships, weapons, and items are all stored in the `Type` table.

### Other Tables

- `characters` - Pilots
- `corporations` - Corporations
- `alliances` - Alliances

## Usage

### Step 1: Scan Killmails for Missing Entities

Run the scanner to detect missing entities and queue them:

```bash
cd backend
yarn scan:entities
```

This will:

- Scan all killmails in batches of 100
- Filter out NPCs automatically
- Check which entities are missing from database
- Queue missing entities to specialized queues

### Step 2: Start Specialized Workers

Start all 4 info workers (each in a separate terminal):

```bash
# Terminal 1: Character enrichment (10 concurrent)
yarn worker:info:characters

# Terminal 2: Corporation enrichment (5 concurrent)
yarn worker:info:corporations

# Terminal 3: Alliance enrichment (3 concurrent)
yarn worker:info:alliances

# Terminal 4: Type enrichment (10 concurrent)
yarn worker:info:types
```

Each worker will:

- Process its own queue independently
- Skip entities that already exist in database
- Fetch data from ESI with rate limiting (50 req/sec shared)
- Save to database
- Show progress every N items (varies by worker)
- Handle 404 errors (deleted entities) gracefully
- Requeue on other errors for retry

### Production Deployment

You can scale each worker independently based on load:

```bash
# Run 3 instances of character worker
yarn worker:info:characters &
yarn worker:info:characters &
yarn worker:info:characters &

# Run 2 instances of corporation worker
yarn worker:info:corporations &
yarn worker:info:corporations &

# Single instance for others (lower load)
yarn worker:info:alliances &
yarn worker:info:types &
```

### Legacy: Single Killmail Enrichment

For testing or backward compatibility, you can still enrich a single killmail:

```bash
cd backend
npx tsx test-enrichment.ts
```

## Key Benefits

✅ **Automatic**: Runs automatically when each killmail is saved
✅ **Lazy Loading**: Only unknown data is fetched
✅ **Error Tolerant**: Enrichment errors don't affect killmail saving
✅ **Rate Limiting**: Complies with ESI rate limits (10ms delay)
✅ **Performant**: Batch checks prevent unnecessary ESI calls

## Example Log Output

```bash
📥 Found 150 killmails
💾 Processing killmails...
     📊 Progress: 50/150 (Saved: 48, Skipped: 2, Errors: 0)
     🔍 Enriched: 12 chars, 5 corps, 2 alliances, 23 types
     📊 Progress: 100/150 (Saved: 96, Skipped: 4, Errors: 0)
✅ Saved: 146, Skipped: 4, Errors: 0
```

## ESI Endpoints Used

- `GET /characters/{character_id}/` - Public
- `GET /corporations/{corporation_id}/` - Public
- `GET /alliances/{alliance_id}/` - Public
- `GET /universe/types/{type_id}/` - Public

All endpoints are **public** and **don't require authentication**.

## Monitoring & Progress Tracking

Each worker logs progress at different intervals:

- **Characters**: Every 50 items
- **Corporations**: Every 50 items
- **Alliances**: Every 20 items
- **Types**: Every 100 items

Example output:

```bash
🚀 Character Info Worker started
📦 Waiting for character IDs to enrich...
✅ Character Enrichment: Processed 50 (Added: 48, Skipped: 2, Errors: 0)
✅ Character Enrichment: Processed 100 (Added: 95, Skipped: 5, Errors: 0)
```

## Queue Information

| Queue Name                   | Worker Script                 | Concurrency | Progress Interval |
| ---------------------------- | ----------------------------- | ----------- | ----------------- |
| `esi_character_info_queue`   | `worker-info-characters.ts`   | 10          | Every 50          |
| `esi_corporation_info_queue` | `worker-info-corporations.ts` | 5           | Every 50          |
| `esi_alliance_info_queue`    | `worker-info-alliances.ts`    | 3           | Every 20          |
| `esi_type_info_queue`        | `worker-info-types.ts`        | 10          | Every 100         |

## Future Improvements (Optional)

1. **Bulk API usage**: ESI supports bulk queries for some endpoints
2. **Cache layer**: Cache frequently used types in Redis
3. **Auto-scaling**: Automatically scale workers based on queue depth
4. **Metrics**: Prometheus/Grafana integration for monitoring

## Error Handling

The info fetch system gracefully handles common errors:

- **404 errors**: Silently skipped (deleted/invalid characters, corporations, alliances, or types)
- **NPC filtering**: Automatically filters NPC characters and corporations
- **Smart rate limiting**: Built-in rate limiter ensures we never exceed ESI limits (50 req/sec max, ESI allows 150)
- **Partial failures**: Other entities continue processing even if one fails
- **Conservative processing**: 2 killmails processed concurrently to avoid overwhelming ESI
- **Guaranteed compliance**: 100ms minimum delay between ESI requests, automatic queue management

### NPC Detection

NPCs are automatically detected and skipped to prevent unnecessary ESI calls:

**NPC Characters** (rats, mission agents, CONCORD, etc.):

- System NPCs: ID < 1,000,000
- Standard NPCs: ID 3,000,000 - 4,000,000
- Note: NPC attackers in killmails appear without `character_id` (ship only)

**NPC Corporations** (empire factions, pirate factions, etc.):

- NPC corps: ID < 2,000,000
- Player corps: ID ≥ 2,000,000

This prevents unnecessary ESI calls for entities that don't exist in the database

## Troubleshooting

### Q: Getting type errors

```bash
cd backend
npx prisma generate
```

## Q: Migration errors

```bash
cd backend
npx prisma migrate dev
```

### Q: Seeing 404 errors in results\*\*

This is normal! Characters, corporations, or alliances may have been deleted from EVE Online. The system skips these and continues with valid entities

### Q: Enrichment not working

- Check worker logs
- Test ESI accessibility: `curl https://esi.evetech.net/latest/status/`

## Value Calculation

For detailed information about killmail value calculations, including the special 10 ISK fixed value for Capsules, see:

**[Capsule Value Calculation](../../../docs/CAPSULE_VALUE_CALCULATION.MD)**

Key points:

- Capsules (type_id: 670) have a fixed ship value of 10 ISK
- Other ships use market prices
- Implants and items always use market prices
- Values can be backfilled using: `yarn queue:backfill-values --mode=zero --capsules-only`
