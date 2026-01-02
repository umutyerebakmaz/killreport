# Daily Workflows (Backend)

## 📋 Simple Daily Sequence

```bash
# 1. Update Alliance & Corporation Data
yarn queue:alliances              # Queue all alliance IDs from ESI
yarn worker:info:alliances        # Fetch and UPDATE alliance details - 3547

yarn queue:alliance-corporations  # Queue alliances (for corporation discovery) - 3547
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
