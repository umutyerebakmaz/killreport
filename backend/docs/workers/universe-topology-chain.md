# Universe Topology Chain

How the celestial bodies of a solar system - its star, stargates, stations,
planets, moons and asteroid belts - get into the database.

Each celestial type has its own queue and its own worker, and each worker is the
**sole writer** of exactly one table. The system worker used to write all six
foreign tables inside a single transaction; that is what this design replaced.

## Flow

```text
queue:solar-systems  (ESI list endpoint, unfiltered root scan)
        |  esi_solar_systems_queue            message: plain Int
worker-solar-systems
        |  writes: solar_systems  (one row, one table)
        +--> esi_stars_queue           { starId, solarSystemId }
        +--> esi_stargates_queue       { stargateId, solarSystemId }
        +--> esi_stations_queue        { stationId, solarSystemId }
        +--> esi_planets_queue         { planetId, solarSystemId, orbitIndex,
                                         moonIds[], asteroidBeltIds[] }
                |
        worker-planets
                |  writes: planets
                +--> esi_moons_queue           { moonId, solarSystemId, planetId, orbitIndex }
                +--> esi_asteroid_belts_queue  { beltId, solarSystemId, planetId, orbitIndex }
                        |
                worker-moons / worker-asteroid-belts
                        writes: moons / asteroid_belts
```

## Ownership

| Worker                                                                | Writes           | Publishes to                        |
| --------------------------------------------------------------------- | ---------------- | ----------------------------------- |
| [`worker-solar-systems`](../../src/workers/worker-solar-systems.ts)   | `solar_systems`  | stars, stargates, stations, planets |
| [`worker-stars`](../../src/workers/worker-stars.ts)                   | `stars`          | —                                   |
| [`worker-stargates`](../../src/workers/worker-stargates.ts)           | `stargates`      | —                                   |
| [`worker-stations`](../../src/workers/worker-stations.ts)             | `stations`       | —                                   |
| [`worker-planets`](../../src/workers/worker-planets.ts)               | `planets`        | moons, asteroid_belts               |
| [`worker-moons`](../../src/workers/worker-moons.ts)                   | `moons`          | —                                   |
| [`worker-asteroid-belts`](../../src/workers/worker-asteroid-belts.ts) | `asteroid_belts` | —                                   |

Because every row has exactly one writer, one worker overwriting another step's
column is structurally impossible.

## Why the chain is hierarchical, not a flat fan-out

`Moon.planet_id` and `AsteroidBelt.planet_id` are NOT NULL with a foreign key to
`planets`. RabbitMQ guarantees no ordering across queues, so feeding all six
queues at once would produce a foreign key violation whenever a moon message beat
its planet message.

The alternative was making `planet_id` nullable. It was rejected: it weakens the
schema and leaves the link to a "we will fill it in later" state.

Moon and belt messages only come into existence after the planet row is written,
so the ordering is structural and needs no checking code.

## Message contracts

Defined in [`topology-messages.ts`](../../src/queues/topology-messages.ts). Every
message carries the common envelope `{ queuedAt, source, attempts? }`.

`esi_solar_systems_queue` is the exception and stays a **plain integer**. It is a
root scan fed by an ESI list endpoint, so there is no parent to carry.

`moonIds` and `asteroidBeltIds` travel only in the planet message and are consumed
only by `worker-planets`; they are never written to a table. The
planet-to-moon nesting exists **only** in the `/universe/systems/{id}/` response -
neither `/universe/moons/{id}/` nor `/universe/asteroid_belts/{id}/` returns
`planet_id` - so if the chain does not carry it, it is unrecoverable.

## Write order inside worker-planets

The chain node writes first and enriches last:

1. `upsert` the `planets` row from the message alone. `id`, `solar_system_id` and
   `orbit_index` are all authoritative there; `orbit_index` encodes the ordering
   of the `planets[]` array and has no equivalent in the by-ID response.
2. Publish the moon and asteroid belt messages.
3. Call `/universe/planets/{id}/` and fill in `name`, `type_id` and the position.

A failed ESI call therefore costs a name, not the row and not the chain. The
repair script finds what is left with `WHERE name IS NULL`.

The leaf workers stay single-write: nothing depends on their rows, and a second
write would be pure cost on `moons`, the largest table in the topology.

## Errors and retries

| Case                                       | Behaviour                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **404**                                    | The ID is dead at ESI. Write the row from the message (`name: null`) and ack - the topology fact is still authoritative. |
| **420 / error limit**                      | Wait 60 s, `nack(requeue)`. No attempt is burned.                                                                        |
| **Foreign key violation** (Prisma `P2003`) | Retryable: the parent row has not arrived yet. Increment `attempts` and republish.                                       |
| **Other** (5xx, timeout, unexpected)       | Increment `attempts` and republish.                                                                                      |
| **`attempts` > 5**                         | Publish to `esi_topology_dlq` and ack. Never silently discarded.                                                         |

The shared implementation is `handleWorkerError()` in `topology-messages.ts`. It
replaces the `channel.nack(msg, false, false)` every worker used to copy, which
discarded the message outright.

`attempts` is carried in the envelope and incremented by **republishing** rather
than requeueing, because a requeue cannot change the message body.

### Why the DLQ is not an x-dead-letter-exchange

Setting `x-dead-letter-exchange` means changing a queue's arguments. Those
arguments must match what `ensureAllQueuesExist()` already declared
(`x-max-priority: 10`), and a mismatch fails with
`406 PRECONDITION_FAILED` - the error that left three workers unable to start in
PR #135. The DLQ is therefore written by an explicit publish.

## Queue registration

All seven queues - the six celestial ones plus `esi_topology_dlq` - are listed in
[`rabbitmq.ts`](../../src/services/rabbitmq.ts), in **both** lists:

- `ALL_QUEUES` drives `ensureAllQueuesExist()` at server startup.
- The separate list inside `getAllQueueStats()` is what the `workerStatus` query
  reads. Registering only the first opens the queues without reporting them.

Check depths with:

```graphql
{
  workerStatus {
    queues {
      name
      messageCount
      consumerCount
    }
  }
}
```

## What "done" means

The root scan finishing is **no longer** "the system queue is empty". Moon and
belt rows are born one hop later, so the ingest is complete only when **all seven
queues are empty at once**. Watch `workerStatus`, not just
`esi_solar_systems_queue`.

## Running it

```bash
yarn queue:solar-systems     # root scan, unfiltered

yarn worker:solar-systems    # let this finish first: it avoids the stargate
                             # destination foreign key ever firing
yarn worker:planets
yarn worker:stars
yarn worker:stations
yarn worker:moons
yarn worker:asteroid-belts
yarn worker:stargates
```

Static universe data is scheduled by neither PM2 nor the crontab. It is run by
hand, once, and left alone. The full operational procedure - including how to
reset, how far you can parallelise, measured timings and what to do when it goes
wrong - is in [`../ops/universe-topology-run.md`](../ops/universe-topology-run.md).

## Repair tools

The `queue-*` scripts are no longer part of the normal flow, but they are not
deleted: after a spell of ESI failures they are the only way to fill in what is
missing. Each reads `WHERE name IS NULL` out of the database and republishes the
same JSON contract its worker consumes.

```bash
yarn queue:stars  |  queue:planets  |  queue:moons
yarn queue:asteroid-belts  |  queue:stargates  |  queue:stations
```

The moon and belt scripts read `planet_id` and `orbit_index` back out of the
database, and the planet script reads its `moonIds` and `asteroidBeltIds` the same
way, so ESI never has to be asked for the nesting twice.

## Integrity

Foreign keys exist only between tables the same pipeline fills:

- `stars`, `planets`, `moons`, `asteroid_belts`, `stargates`, `stations` →
  `solar_systems`, all `ON DELETE CASCADE`.
- `moons` and `asteroid_belts` → `planets` on the **composite**
  `(planet_id, solar_system_id)`, so a moon's system can no longer disagree with
  its planet's.
- `stargates.destination_system_id` → `solar_systems`, `ON DELETE SET NULL`:
  deleting a system must empty the destinations of gates in other systems, not
  delete those gates.

`destination_stargate_id` deliberately has no foreign key - the destination gate
is written by the same worker, so it would be an ordering dependency inside one
queue.

`type_id`, `owner_corporation_id` and `race_id` point at tables the type,
corporation and race pipelines own. A foreign key there would lock two ingests
together, so they are reported rather than enforced:

```bash
yarn doctor:topology
```

That prints orphaned cross-pipeline references, the `name IS NULL` count per
table with the repair command for each, and the depth of the dead letter queue -
which is silent data loss if nobody looks at it.
