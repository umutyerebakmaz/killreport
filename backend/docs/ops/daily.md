# Daily Workflows (Backend)

Every step below has a Rust version (`:rs` suffix, built from `backend-rs/`)
and a Node version (no suffix). Both read and write the same queues and run
the same SQL, so they can be mixed, but run only one consumer type per queue at
a time when you want comparable numbers. The Rust versions are the default.

## 📋 Simple Daily Sequence

Start the three workers first and leave them running:

```bash
yarn worker:info:alliances:rs        # esi_alliance_info_queue → alliances table
yarn worker:alliance-corporations:rs # esi_alliance_corporations_queue → esi_corporation_info_queue
yarn worker:info:corporations:rs     # esi_corporation_info_queue → corporations table
```

Then queue the whole chain with one command:

```bash
yarn queue:alliance-chain:rs
# = yarn queue:alliances:rs && yarn queue:alliance-corporations:rs
```

When `esi_corporation_info_queue` has drained, recount the alliances and take
the snapshots:

```bash
yarn update:alliance-counts:rs
yarn snapshot:alliances:rs
yarn snapshot:corporations:rs
```

Reference numbers from the 2026-11-16 runs:

- Alliance chain: 3645 alliances processed, 18,470 corporations queued,
  0 errors.
- `update:alliance-counts:rs`: 4207 alliances updated in 0.06 s.
- `snapshot:alliances:rs`: 4207 new snapshots in 0.10 s.
- `snapshot:corporations:rs`: 57,650 new snapshots in 1.16 s. sqlx logs a
  `slow statement` warning for anything over 1 s; it is informational.

### Why the chain does not wait between steps

Both Rust queue scripts read the alliance list from ESI (`GET /alliances`), so
`queue:alliance-corporations:rs` does not depend on `worker:info:alliances`
having finished. The Node `queue:alliance-corporations` reads alliance IDs from
the **database** instead: run it only after `worker:info:alliances` has drained
its queue, or it misses alliances created since the last run.

## 📖 What Each Command Does

**`yarn queue:alliances:rs`** (Node: `queue:alliances`)

- Fetches ALL alliance IDs from ESI
- Adds them to the `esi_alliance_info_queue`

**`yarn worker:info:alliances:rs`** (Node: `worker:info:alliances`)

- Processes alliance IDs from the queue
- Fetches details from ESI for each alliance
- Performs **UPSERT** in database (updates existing, inserts new)
- Updated fields: name, ticker, executor_corporation_id, faction_id

**`yarn queue:alliance-corporations:rs`** (Node: `queue:alliance-corporations`)

- Rust: fetches ALL alliance IDs from ESI; Node: reads them from the database
- Queues each alliance ID to `esi_alliance_corporations_queue`

**`yarn worker:alliance-corporations:rs`** (Node: `worker:alliance-corporations`)

- Processes alliance IDs from the queue
- Fetches corporation IDs from ESI for each alliance (`GET /alliances/{id}/corporations/`)
- Queues corporation IDs to `esi_corporation_info_queue`
- Acks an alliance only after RabbitMQ has confirmed every corporation message
- Prints `📊 final: N alliances processed, M corporations queued, E errors`
  once the queue has been quiet for 5 s
- **IMPORTANT:** Without this step, corporations cannot be discovered!

**`yarn worker:info:corporations:rs`** (Node: `worker:info:corporations`)

- Processes corporation IDs from the queue
- Fetches details from ESI for each corporation
- Performs **UPSERT** in database (updates existing, inserts new)
- Updated fields: name, ticker, member_count, ceo_id, alliance_id, tax_rate

**`yarn update:alliance-counts:rs`** (Node: `update:alliance-counts`)

- Recomputes `member_count` and `corporation_count` on every alliance from the
  `corporations` table, in one SQL statement
- The only writer of those two columns
- Without it the alliance counts stay stale even after the corporations update

**`yarn snapshot:alliances:rs`** / **`yarn snapshot:corporations:rs`** (Node: `snapshot:alliances` / `snapshot:corporations`)

- Takes a snapshot of all alliances / corporations for the current **UTC** day
- One snapshot per alliance / corporation per day: a second run the same day
  adds nothing (`new snapshots: 0`)
- The alliance snapshot computes its counts straight from `corporations` and
  writes only `alliance_snapshots`, so it does not wait for
  `update:alliance-counts`

---

## 📅 Character & Corporation Management

### Updating Character Information

To update **all characters** in the database from ESI:

```bash
yarn worker:info:characters:rs   # start the worker
yarn queue:characters:rs         # add all character IDs to the queue
```

**What it does:**

- Scans every character ID in the database
- Adds all to `esi_character_info_queue`
- Worker fetches current info from ESI and updates database

**When to use:**

- For weekly/monthly character information updates
- To catch alliance/corporation changes

---

### Detect and Update Missing Corporations

Detects missing corporations from characters and fetches their info from ESI
(Node: `queue:character-corporations`):

```bash
yarn worker:info:corporations:rs
yarn queue:character-corporations:rs
```

**What it does:**

- Collects all character `corporation_id`s from database
- Identifies those not in database
- Adds missing corporations to `esi_corporation_info_queue`
- Worker fetches corporation info from ESI and adds to database

**When to use:**

- After character sync to fill missing corporations
- After new killmails to populate missing corporations

---

### Update Specific Characters

```bash
# Single character
yarn queue:characters:rs 365974960

# Multiple characters
yarn queue:characters:rs 365974960 443630591 196379789
```

With `worker:info:characters:rs` running, the IDs go straight to
`esi_character_info_queue` and are updated from ESI.

---

## 🔄 Recommended Workflow Scenarios

### Scenario 1: Weekly Full Update

With `worker:info:alliances:rs`, `worker:info:corporations:rs`,
`worker:info:characters:rs` and `worker:alliance-corporations:rs` running:

```bash
# 1. Alliance & Corporation updates
yarn queue:alliance-chain:rs

# 2. Refresh every corporation already in the database
yarn queue:corporations:rs

# 3. Character updates
yarn queue:characters:rs

# 4. Fill missing corporations (after step 3 has drained)
yarn queue:character-corporations:rs

# 5. Recount and take snapshots (after esi_corporation_info_queue has drained)
yarn update:alliance-counts:rs
yarn snapshot:alliances:rs
yarn snapshot:corporations:rs
```

Step 2 is what catches a corporation that left its alliance without joining
another one. The alliance chain finds corporations only through alliance
membership lists, so such a corporation is never queued by step 1 and keeps
its old `alliance_id`, which inflates that alliance's counts and snapshots.

### Scenario 2: Fill Missing Entities Only

With the four info workers (`worker:info:characters:rs`,
`worker:info:corporations:rs`, `worker:info:alliances:rs`,
`worker:info:types:rs`) running:

```bash
# Scan and fill all missing entities from killmails (Node: scan:entities)
yarn scan:entities:rs

# Specifically check character corporations
yarn queue:character-corporations:rs
```

**`yarn scan:entities:rs`** (Node: `scan:entities`)

- Chains four commands, each of which can also run on its own:
  `queue:killmail-characters:rs`, `queue:killmail-corporations:rs`,
  `queue:killmail-alliances:rs` and `queue:killmail-types:rs`
- Each runs one SQL anti-join over `victims`, `attackers` (and, for types,
  `killmail_items`) against its own table and queues only what is missing
- NPCs are kept: ESI resolves them and killmail pages show their names
- A part with nothing to queue prints `✅ no missing <entity> to queue!` and
  the chain goes on

Reference numbers from the 2026-11-19 run: 140 characters, 1 corporation,
1 alliance and 0 types queued; the slowest query (types) takes about 1.5 s.

---

## 📊 Worker Table

| Worker (Rust)                     | Queue Name                        | Output                       |
| --------------------------------- | --------------------------------- | ---------------------------- |
| `worker:info:alliances:rs`        | `esi_alliance_info_queue`         | `alliances` table            |
| `worker:info:corporations:rs`     | `esi_corporation_info_queue`      | `corporations` table         |
| `worker:info:characters:rs`       | `esi_character_info_queue`        | `characters` table           |
| `worker:info:types:rs`            | `esi_type_info_queue`             | `types` table                |
| `worker:alliance-corporations:rs` | `esi_alliance_corporations_queue` | `esi_corporation_info_queue` |

The four parts of `scan:entities:rs`, one queue each:

| Queue script (Rust)              | Reads                                    | Queue                        |
| -------------------------------- | ---------------------------------------- | ---------------------------- |
| `queue:killmail-characters:rs`   | `victims`, `attackers`                   | `esi_character_info_queue`   |
| `queue:killmail-corporations:rs` | `victims`, `attackers`                   | `esi_corporation_info_queue` |
| `queue:killmail-alliances:rs`    | `victims`, `attackers`                   | `esi_alliance_info_queue`    |
| `queue:killmail-types:rs`        | `victims`, `attackers`, `killmail_items` | `esi_type_info_queue`        |

One-shot database jobs. They touch neither RabbitMQ nor ESI, and each writes
a single table:

| Job (Rust)                  | Reads          | Writes                                                        |
| --------------------------- | -------------- | ------------------------------------------------------------- |
| `update:alliance-counts:rs` | `corporations` | `alliances.member_count`, `corporation_count`                 |
| `snapshot:alliances:rs`     | `corporations` | `alliance_snapshots` (one row per alliance per UTC day)       |
| `snapshot:corporations:rs`  | `corporations` | `corporation_snapshots` (one row per corporation per UTC day) |

Prefetch for the info workers is `max(ESI_PREFETCH, ceil(ESI_MAX_RPS / 2))`,
25 with the defaults. The request rate itself is set by the shared ESI limiter
in Redis: every Node and Rust process spends one common budget of up to
`ESI_MAX_RPS` (default 50) requests per second, so running more workers does
not exceed it.

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

---

## ⚠️ Important Notes

1. **Rate Limiting:** ESI limits are enforced by the shared limiter from
   response headers. Do not add sleeps or limits of your own.
2. **Database Connections:** Workers use up to 10 connections per process
   (`prisma-worker.ts`, mirrored by the Rust `db` crate), released when idle.
3. **Always run `scan:entities:rs` after killmail sync**
4. Keep workers running continuously in production with systemd (see [systemd](./systemd.md))

---

## 🔗 Related Documentation

- [Enrichment System](../workers/enrichment.md)
- [Workers Documentation](../workers/worker-documentation.md)
- [Character Killmail Worker](../workers/character-killmail-worker.md)
