# ✅ Backfill System - Ready for Production

## 📦 New Files Created

### Queue Scripts

- ✅ **`backend/queue-character-killmails.ts`**
  - Adds character IDs to backfill queue
  - Usage: `yarn queue:character-killmails <characterId>`

### Worker Scripts

- ✅ **`backend/worker-backfill-zkillboard.ts`**
  - Fetches historical killmails
  - Rate limited: 10-second delay
  - Processes zkillboard_backfill_queue

### Helper Files

- ✅ **`backend/src/services/zkillboardBackfillService.ts`**
  - Core logic
  - Pagination support
  - Duplicate detection
  - error handling

---

## 🎯 How to Use

### Manual Backfill (Single Character)

```bash
cd backend
yarn queue:character-killmails 2117325769  # Killman Blu character ID
```

### Automatic Backfill (Via GraphQL Mutation)

```graphql
mutation {
  startKillmailBackfill(
    input: {
      characterId: 2117325769
      options: { fromDate: "2023-01-01", maxPages: 10 }
    }
  ) {
    success
    message
    queuedAt
  }
}
```

### Tracking Worker

```bash
cd backend
yarn worker:backfill
```

PM2 setup:

```bash
pm2 start ecosystem.config.js --only worker-backfill
pm2 logs worker-backfill
```

---

## 📊 What Gets Backfilled

When backfilling character killmails:

1. ✅ Killmail itself (`Killmail` table)
2. ✅ Victim information
3. ✅ Attackers (all entities)
4. ✅ Victim items (if destroyed)
5. ✅ Related entities added to enrichment queue:
   - Characters → `esi_character_info_queue`
   - Corporations → `esi_corporation_info_queue`
   - Alliances → `esi_alliance_info_queue`
   - Ships/Items → `esi_type_info_queue`

### What Gets Enriched Afterward

- Character names, corps, alliances
- Corporation info (ticker, CEO, etc.)
- Alliance info (ticker, executor, etc.)
- Ship/module names and details

---

## 🎛️ Advanced Options

### Available Options

```typescript
interface BackfillOptions {
  fromDate?: string; // "2023-01-01" (only this date and after)
  maxPages?: number; // 10 (max 10 pages = 1000 killmails)
  limit?: number; // 100 (killmails per page, max 200)
  skipExisting?: boolean; // Default: true (skip duplicates)
}
```

### Example GraphQL Query

```graphql
mutation {
  startKillmailBackfill(
    input: {
      characterId: 2117325769
      options: { fromDate: "2024-01-01", maxPages: 5, limit: 200 }
    }
  ) {
    success
    message
  }
}
```

---

## 📈 Performance Metrics

### Processing Time

- **zKillboard API delay:** 10 seconds/page
- **1 page (100 killmails):** ~10 seconds
- **10 pages (1000 killmails):** ~1 minute 40 seconds

### Limits

- **Max killmails per page:** 200 (zKillboard limit)
- **Typical per page:** 100 (default)
- **Max in 1 backfill:** No limit (processes until no data left)

---

## 🧪 Test Status

Tested on production:

- ✅ Killman Blu (2117325769) - 3 pages (~300 killmails)
- ✅ Entity enrichment working (characters, corps, alliances)
- ✅ No duplicates

---

## 🔄 Integration with Existing System

### Compatible with Existing Workers

- ✅ `worker-zkillboard` (old system, still working)
  - Runs per killmail
  - Uses different queue: `zkillboard_character_queue`

- ✅ `worker-backfill` (new system)
  - Processes pages in batches
  - Uses different queue: `zkillboard_backfill_queue`

Both can run simultaneously.

### Queue Names

| Worker            | Queue Name                 | Purpose    |
| ----------------- | -------------------------- | ---------- |
| worker-zkillboard | zkillboard_character_queue | Old system |
| worker-backfill   | zkillboard_backfill_queue  | New system |

---

## 🛡️ Safety

### Rate Limiting

- ✅ 10-second delay (zKillboard rules)
- ✅ No excessive requests

### Duplicate Detection

- ✅ Checks `killmail_id + killmail_hash`
- ✅ Skips if already in database
- ✅ No duplicate data

### Error Handling

- ✅ Graceful failure (no crashes)
- ✅ Error logging
- ✅ Automatic retry (RabbitMQ `requeue`)

---

## 🚀 Production Readiness

| Feature              | Status |
| -------------------- | ------ |
| Rate limiting        | ✅     |
| Duplicate prevention | ✅     |
| Entity enrichment    | ✅     |
| Error handling       | ✅     |
| Logging              | ✅     |
| GraphQL integration  | ✅     |
| PM2 support          | ✅     |
| Tested in production | ✅     |

---

## 📚 Documentation

- **Full Value Backfill:** [BACKFILL_VALUES_GUIDE.MD](/backend/docs/workers/BACKFILL_VALUES_GUIDE.MD)

---

**Status:** ✅ Ready for production use
**Last Updated:** January 8, 2026
