# Running the Universe Topology Ingest by Hand

Step-by-step runbook for filling `stars`, `planets`, `moons`, `asteroid_belts`,
`stargates` and `stations` from ESI.

Static universe data is scheduled by neither PM2 nor the crontab. It is run by
hand, once, and left alone — so this is the procedure. For how the chain works
and why, see [`../workers/universe-topology-chain.md`](../workers/universe-topology-chain.md).

Every command runs from `backend/`.

---

## Before you start

RabbitMQ and PostgreSQL must be up, and the API server should be running so you
can watch queue depth:

```bash
yarn dev:backend      # from the repo root, separate terminal
```

Check that nothing is already consuming — every `consumerCount` should be 0, or
you will have two workers racing on the same queue:

```graphql
{ workerStatus { queues { name messageCount consumerCount } } }
```

From a shell:

```bash
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ workerStatus { queues { name messageCount consumerCount } } }"}'
```

If a stray worker is running:

```bash
pkill -f 'worker-(solar-systems|planets|stars|stations|stargates|asteroid-belts|moons)'
```

---

## Optional: start from a clean slate

Only when you want to re-ingest from scratch. **This deletes rows** — roughly
480,000 of them — and they come back only by finishing the full run below, which
takes hours.

`solar_systems` is deliberately NOT truncated. Other tables reference it, and the
root scan re-upserts every row anyway.

```bash
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")

psql "$DB" -c "TRUNCATE stars, planets, moons, asteroid_belts, stargates, stations;"
```

Then purge the queues. Skipping this is the classic mistake: messages published
against the old rows will try to write children of planets that no longer exist,
fail with `P2003` five times each, and pile up in the dead letter queue.

```bash
npx tsx -e "
import { getRabbitMQChannel } from './src/services/rabbitmq';
const QS = ['esi_solar_systems_queue','esi_stars_queue','esi_planets_queue',
            'esi_moons_queue','esi_asteroid_belts_queue','esi_stargates_queue',
            'esi_stations_queue','esi_topology_dlq'];
(async () => {
  const ch = await getRabbitMQChannel();
  for (const q of QS) {
    await ch.assertQueue(q, { durable: true, arguments: { 'x-max-priority': 10 } });
    const r = await ch.purgeQueue(q);
    console.log('purged', q, r.messageCount);
  }
  process.exit(0);
})();
"
```

---

## The run, in order

The order is not a preference. `worker-planets` is what publishes the moon and
asteroid belt messages, so those two queues stay empty until it has run. And
finishing the system queue before the stargates means the
`destination_system_id` foreign key never fires.

```bash
# 1. Root scan. Publishes 8,490 plain-integer messages. Seconds.
yarn queue:solar-systems

# 2. Writes solar_systems, publishes stars / stargates / stations / planets.
#    Let this one FINISH before moving on. ~3 minutes.
yarn worker:solar-systems

# 3. The chain node. Writes planets, publishes moons and asteroid belts.
yarn worker:planets

# 4. The leaves, in any order.
yarn worker:stars
yarn worker:stations
yarn worker:asteroid-belts
yarn worker:moons

# 5. Last, so every destination system row already exists.
yarn worker:stargates
```

Each worker prints `🎉 ALL TASKS COMPLETED` when its queue has been quiet for five
seconds, then waits for more messages. That is your cue to press Ctrl+C.

### Going faster

Running the same worker in two terminals doubles throughput — both consume the
same queue, and every write is an `upsert` keyed on the primary key, so there is
nothing to collide over.

**Do not go past two.** `esiRateLimiter` caps each *process* at 50 req/sec, and
ESI's ceiling is 150. Two workers is 100 req/sec with margin; three sits on the
limit and starts earning HTTP 420s.

That applies across workers too: two workers of any kind at once, not two of each.

### Rough timings

Measured on a full run (2026-09-01), one worker unless noted:

| Step | Calls | Time |
|---|---|---|
| `worker-solar-systems` | 8,490 | 3 min |
| `worker-planets` (×2) | 68,407 | 14 min |
| `worker-stars` + `worker-stations` | 13,299 | 3 min |
| `worker-stargates` + `worker-asteroid-belts` | 54,906 | 11 min |
| `worker-moons` (×2) | 344,457 | ~60 min |

The whole universe is about 490,000 ESI calls.

---

## Watching it

Queue depth, any time:

```bash
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ workerStatus { queues { name messageCount } } }"}'
```

Row counts:

```bash
psql "$DB" -c "SELECT
  (SELECT COUNT(*) FROM solar_systems)  AS solar_systems,
  (SELECT COUNT(*) FROM stars)          AS stars,
  (SELECT COUNT(*) FROM planets)        AS planets,
  (SELECT COUNT(*) FROM stargates)      AS stargates,
  (SELECT COUNT(*) FROM stations)       AS stations,
  (SELECT COUNT(*) FROM asteroid_belts) AS belts,
  (SELECT COUNT(*) FROM moons)          AS moons;"
```

### What "done" means

Not "the system queue is empty". Moon and belt rows are born one hop later, so
the ingest is finished only when **all seven queues are empty at once**.

### Expected totals

From the 2026-09-01 full run. Two independent ingests produced these exact
numbers, so a materially different count means something went wrong:

| Table | Rows |
|---|---|
| `solar_systems` | 8,490 |
| `stars` | 8,089 |
| `planets` | 68,407 |
| `stargates` | 13,978 (all destinations resolved) |
| `stations` | 5,210 |
| `asteroid_belts` | 40,928 |
| `moons` | 344,457 |

Sovereign nullsec regions legitimately have **zero** stations — Fade and Deklein
are both 0 while The Forge has 350. NPC stations do not exist in conquerable
space, and ESI's `stations` array does not include player structures. That is not
a gap in the ingest.

---

## Finishing up

```bash
yarn doctor:topology
```

It reports orphaned cross-pipeline references, the `name IS NULL` count per table
with the repair command for each, and the depth of the dead letter queue.

A clean report has every count at zero, except `stations.owner_corporation_id`,
which is currently around 2,535: those are station owners the **corporation**
pipeline has not fetched. That is a separate job, not a topology fault.

---

## When something goes wrong

**Rows left with `name IS NULL`.** ESI failed for those IDs. The repair scripts
find them and republish:

```bash
yarn queue:stars   |  yarn queue:planets   |  yarn queue:moons
yarn queue:asteroid-belts  |  yarn queue:stargates  |  yarn queue:stations
```

Each reads `WHERE name IS NULL` out of the database and publishes the same JSON
contract its worker consumes, so run the matching worker afterwards. A re-run
queues only what is still missing.

**Messages in `esi_topology_dlq`.** Something failed five times. Inspect before
re-running the scan — the depth is in the `doctor:topology` output. Read one
without consuming it:

```bash
npx tsx -e "
import { getRabbitMQChannel } from './src/services/rabbitmq';
(async () => {
  const ch = await getRabbitMQChannel();
  const m = await ch.get('esi_topology_dlq', { noAck: false });
  if (m) { console.log(m.content.toString()); ch.nack(m, false, true); }
  else console.log('empty');
  process.exit(0);
})();
"
```

**`retry n/5 - parent row not written yet (P2003)` in the logs.** A child arrived
before its parent. Expected only if you ran `worker-stargates` alongside
`worker-solar-systems`. It resolves itself; finish the system queue first to
avoid it.

**HTTP 420.** ESI error limiting. The worker waits 60 seconds and requeues on its
own. If it keeps happening, you have too many workers running — drop to two.

**`406 PRECONDITION_FAILED` on startup.** A queue was declared without
`arguments: { 'x-max-priority': 10 }`. Every declaration in the repo passes it and
`ensureAllQueuesExist()` creates them all that way, so this means a new
declaration is missing it.
