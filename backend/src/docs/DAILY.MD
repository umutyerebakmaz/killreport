# Daily Workflows (Backend)

## 📋 Simple Daily Sequence

```bash
# 1. Update Alliance & Corporation Data
+yarn queue:alliances              # Queue all alliance IDs from ESI -
yarn worker:info:alliances        # Fetch and UPDATE alliance details - 3547

+yarn queue:alliance-corporations  # Queue alliances (for corporation discovery) - 3547
yarn worker:alliance-corporations # Fetch corporation IDs from ESI for each alliance and queue them - 17,769
yarn worker:info:corporations     # Fetch and UPDATE corporation details from ESI

# 2. Take Snapshots
yarn snapshot:alliances
yarn snapshot:corporations
```

## 📖 What Each Command Does

**`yarn queue:alliances`**

- Fetches ALL alliance IDs from ESI
- Adds them to the `esi_alliance_info_queue`

**`yarn worker:info:alliances`**

- Processes alliance IDs from the queue
- Fetches details from ESI for each alliance
- Performs **UPSERT** in database (updates existing, inserts new)
- Updated fields: name, ticker, executor_corporation_id, faction_id

**`yarn queue:alliance-corporations`**

- Fetches ALL alliances from database
- Queues each alliance ID to `esi_alliance_corporations_queue`

**`yarn worker:alliance-corporations`**

- Processes alliance IDs from the queue
- Fetches corporation IDs from ESI for each alliance (`GET /alliances/{id}/corporations/`)
- Queues corporation IDs to `esi_corporation_info_queue`
- **IMPORTANT:** Without this step, corporations cannot be discovered!

**`yarn worker:info:corporations`**

- Processes corporation IDs from the queue
- Fetches details from ESI for each corporation
- Performs **UPSERT** in database (updates existing, inserts new)
- Updated fields: name, ticker, member_count, ceo_id, alliance_id, tax_rate

**`yarn snapshot:alliances`**

- Takes a snapshot of all alliances

**`yarn snapshot:corporations`**

- Takes a snapshot of all corporations

---

## 📅 Character & Corporation Management (January 5, 2026)

### Updating Character Information

To update **all characters** in the database from ESI:

```bash
# 1. Add all character IDs to queue
yarn queue:characters

# 2. Start worker (5 concurrent)
yarn worker:info:characters
```

**What it does:**

- Scans ~93k character IDs in database
- Adds all to `esi_character_info_queue`
- Worker fetches current info from ESI and updates database

**When to use:**

- For weekly/monthly character information updates
- To ensure all characters are up to date
- To catch alliance/corporation changes

---

### Detect and Update Missing Corporations

Detects missing corporations from characters and fetches their info from ESI:

```bash
# 1. Scan characters and queue missing corporations
yarn queue:character-corporations

# 2. Start worker (5 concurrent)
yarn worker:info:corporations
```

**What it does:**

- Collects all character `corporation_id`s from database (~24k unique)
- Identifies those not in database
- Adds missing corporations to `esi_corporation_info_queue`
- Worker fetches corporation info from ESI and adds to database

**When to use:**

- After character sync to fill missing corporations
- After new killmails to populate missing corporations
- To maintain database consistency

---

### Update Specific Characters

Update specific characters for logged-in users or special cases:

```bash
# Single character
yarn queue:characters 379226154

# Multiple characters
yarn queue:characters 379226154 95465499 123456

# Start worker
yarn worker:info:characters
```

**What it does:**

- Adds specified character IDs directly to `esi_character_info_queue`
- Worker fetches current info from ESI and updates database

**When to use:**

- To update logged-in user information
- To manually update a specific character
- For testing and debugging

---

## 🔄 Recommended Workflow Scenarios

### Scenario 1: Weekly Full Update

```bash
# 1. Alliance & Corporation updates
yarn queue:alliances
yarn worker:info:alliances

yarn queue:alliance-corporations
yarn worker:alliance-corporations
yarn worker:info:corporations

# 2. Character updates
yarn queue:characters
yarn worker:info:characters

# 3. Fill missing corporations
yarn queue:character-corporations
yarn worker:info:corporations

# 4. Take snapshots
yarn snapshot:alliances
yarn snapshot:corporations
```

### Scenario 2: Fill Missing Entities Only

```bash
# Scan and fill all missing entities from killmails
yarn scan:entities

# Specifically check character corporations
yarn queue:character-corporations
yarn worker:info:corporations
```

---

## 📊 Worker Performance Table

| Worker                         | Queue Name                        | Concurrency | Rate Limit | Usage                           |
| ------------------------------ | --------------------------------- | ----------- | ---------- | ------------------------------- |
| `worker:info:alliances`        | `esi_alliance_info_queue`         | 3           | 50 req/sec | Updates alliance information    |
| `worker:info:corporations`     | `esi_corporation_info_queue`      | 5           | 50 req/sec | Updates corporation information |
| `worker:info:characters`       | `esi_character_info_queue`        | 5           | 50 req/sec | Updates character information   |
| `worker:info:types`            | `esi_type_info_queue`             | 10          | 50 req/sec | Updates ship/item information   |
| `worker:alliance-corporations` | `esi_alliance_corporations_queue` | 5           | 50 req/sec | Discovers alliance corporations |

**Important:** All ESI workers share the same rate limit (50 req/sec). Be careful when running multiple workers.

---

## 🔍 Monitoring and Debug

### Check Queue Status

```graphql
query {
  workerStatus {
    queueName
    messageCount
    consumerCount
  }
}
```

### RabbitMQ Management

- URL: `http://localhost:15672`
- User/Pass: Defined in `.env` file

### Worker Logs

- `info`: General progress
- `debug`: Batch details
- `error`: Errors

---

## ⚠️ Important Notes

1. **Rate Limiting:** ESI API has 50 req/sec limit. Adjust worker concurrency accordingly.
2. **Database Connections:** Workers use `prisma-worker.ts` (2 connection max).
3. **Memory:** 93k character sync can use ~2GB RAM.
4. **Duration:** 93k characters takes ~31 minutes (5 concurrent, 50 req/sec).
5. **Always run `scan:entities` after killmail sync**
6. Keep workers running continuously in production with PM2

---

## 🔗 Related Documentation

- [Enrichment System](./ENRICHMENT_README.MD)
- [Workers Documentation](./WORKERS_DOCUMENTATION.MD)
- [Character Killmail Worker](./CHARACTER_KILLMAIL_WORKER.MD)
