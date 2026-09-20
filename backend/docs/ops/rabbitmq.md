# RabbitMQ Dead Letter Policy - KillReport

This documents how to attach the retry topology (`killreport.dlx`,
`killreport.retry`, `killreport.wait`, `killreport.parking`) — declared in code
by `ensureAllQueuesExist()` in
[`../../src/services/rabbitmq.ts`](../../src/services/rabbitmq.ts) — to the 25
application queues listed in
[`../../src/services/queue-names.ts`](../../src/services/queue-names.ts).

Declaring the exchanges and the wait/parking queues does **not** wire a single
application queue into them. That wiring is a RabbitMQ **policy**, applied
once against the broker, and it is an operator action — nothing in the
codebase does it for you. `backend/docs/ops/pm2.md` and `crontab.md` cover the
processes and the schedules; this covers the broker.

---

## ⚠️ Why a policy and not a queue argument

`ensureAllQueuesExist()` declares every application queue with
`arguments: { 'x-max-priority': 10 }`. Queue arguments take part in RabbitMQ's
**declaration equivalence** check: if a queue already exists, a second
`assertQueue` call for the same name must pass the exact same arguments, or the
broker refuses it.

Adding `x-dead-letter-exchange` directly to that `assertQueue` call would
change the declared arguments for every one of the 25 queues that already
exist. The next time the server starts and re-declares them, the broker sees a
queue that already exists with `x-max-priority: 10` only, and a declaration
that now also asks for `x-dead-letter-exchange`, and refuses it:

```text
406 PRECONDITION_FAILED - inequivalent arg 'x-dead-letter-exchange' for queue
'esi_type_info_queue' in vhost '/': received the value
'killreport.dlx' of type 'longstr' but current is none
```

The worker exits immediately. This is the same failure mode `queue-names.ts`
documents for `x-max-priority` itself (#135 — the region, constellation and
solar system queues and workers were all unable to start until it was fixed).
A queue argument added after a queue already exists is not a migration, it is
an outage.

A **policy** is different: it is matched against queue names by the broker at
runtime, is not part of a queue's own declared arguments, and is not part of
declaration equivalence. Applying one attaches a dead-letter exchange to every
matching queue that already exists — no redeclaration, no queue deletion, no
downtime, and no message is touched, including the several hundred real
messages currently sitting in `esi_user_killmails_queue`.

---

## 🚀 Applying the policy

> **Ship this with the release that introduces the shared failure path, not
> ahead of it.** Today, `backend/src/queues/topology-messages.ts` is the only
> `handleWorkerError` in the codebase, and it does not use this topology at
> all — it counts attempts in its own message payload and dead-letters to
> `esi_topology_dlq`. Several other workers already call `nack(msg, false,
false)` on failure. Right now, with no policy applied, that nack has nowhere
> to send the message and RabbitMQ discards it silently — a real bug, but a
> bounded one: the message is gone once, not looping.
>
> Applying this policy on its own, **before** the generalised failure path
> (`backend/src/workers/worker-error.ts`, Task 8, not built yet) ships,
> changes that failure mode rather than fixing it: those same `nack(msg,
false, false)` calls now route origin → `killreport.dlx` → `killreport.wait`
> (30 s TTL) → `killreport.retry` → origin, and nothing ever parks the message
> — because the death-count check that parks it after `MAX_ATTEMPTS` is part
> of the code that doesn't exist yet. The result is an unbounded loop, once
> every 30 seconds, forever, instead of a silent drop. Apply this policy in
> the same deploy as `worker-error.ts`, not before it.

Primary form, on a box with `rabbitmqctl` (the production droplet):

```bash
sudo rabbitmqctl set_policy killreport-dlx \
  "^(esi_|zkillboard_|backfill_|alliance_)" \
  '{"dead-letter-exchange":"killreport.dlx"}' \
  --apply-to queues
sudo rabbitmqctl list_policies
```

Fallback, through the management HTTP API, when `sudo`/`rabbitmqctl` are not
available (guest/guest, vhost `/`, URL-encoded as `%2F`):

```bash
curl -u guest:guest -X PUT \
  http://localhost:15672/api/policies/%2F/killreport-dlx \
  -H 'content-type: application/json' \
  -d '{
    "pattern": "^(esi_|zkillboard_|backfill_|alliance_)",
    "definition": { "dead-letter-exchange": "killreport.dlx" },
    "apply-to": "queues"
  }'

curl -u guest:guest http://localhost:15672/api/policies
```

Both forms declare the same policy; the CLI form is authoritative because the
droplet has `rabbitmqctl`, the HTTP form exists for environments that do not
(sandboxes, CI, a container without `sudo`).

---

## 🔍 Checking it covers every queue

The pattern is matched against **queue names**, not against `queue-names.ts`
directly, so coverage has to be verified against the real list rather than
assumed. `ALL_QUEUES` is the source of truth:

```bash
cd backend
npx tsx -e "
import { ALL_QUEUES } from './src/services/queue-names.ts';
console.log(ALL_QUEUES.length);
console.log(ALL_QUEUES.join('\n'));
"
```

That prints 24 names today (25 before Task 11 retired `esi_topology_dlq` — see
"Retired: `esi_topology_dlq`" below), and every one of them begins with
`esi_`, `zkillboard_`, or `backfill_` — so
`^(esi_|zkillboard_|backfill_|alliance_)` matches all 24 with room to spare.
The `alliance_` branch matches nothing in `ALL_QUEUES` (every alliance queue is
named `esi_alliance_*`); it is there on purpose to also cover `alliance_queue`,
an orphaned queue that exists on the broker with no reference anywhere in the
code. Catching it is harmless — nothing publishes or consumes it, so attaching
a DLX it will never use changes nothing operationally.

The robust check cross-references the policy against that exact list, rather
than trusting a raw count:

```bash
sudo rabbitmqctl list_queues name policy | awk -F'\t' '$2=="killreport-dlx"{print $1}' | sort > /tmp/policed.txt
npx tsx -e "import { ALL_QUEUES } from './backend/src/services/queue-names.ts'; console.log([...ALL_QUEUES].sort().join('\n'))" > /tmp/all_queues.txt
comm -23 /tmp/all_queues.txt /tmp/policed.txt
```

No output means every name in `ALL_QUEUES` carries the policy. A quick,
approximate version is a bare count:

```bash
sudo rabbitmqctl list_queues name policy | grep -c killreport-dlx
```

Treat that count as a floor, not an exact match: on a broker that has
accumulated queues from an earlier naming scheme (this project has had at
least one rename — see `alliance_queue` above, and possibly others left over
from before `queue-names.ts` became the single list), the same pattern matches
those too and inflates the number past 25. That is not a bug in the pattern;
it is the pattern doing exactly what it is asked to do — match by prefix, not
by an enumerated list. The `comm` check above is what actually proves
coverage; the bare count is a sanity check, not the verification.

---

## 🔄 Deployment order — apply the policy first

This assumes the release being deployed carries the shared failure path
(`worker-error.ts`) — see the warning above if it does not.

**Apply the policy before restarting any worker.** This order is load-bearing:

1. Apply the policy (above). Existing queues gain `x-dead-letter-exchange`
   immediately, with no restart needed — a policy change takes effect on
   already-open queues.
2. Only then restart the workers:
   ```bash
   pm2 restart all
   ```

Reversed, a worker that nacks a message **before** the policy exists has
nowhere to send it: `nack(msg, false, false)` with no dead-letter exchange
configured on the queue simply discards the message. There is no error, no
log line, no retry — the message is gone. The dead letter policy has to exist
before the first failure it is meant to catch, not after.

---

## 📊 Inspecting the parking queue

Depth, from the CLI:

```bash
sudo rabbitmqctl list_queues name messages | grep killreport.parking
```

To read why a specific message parked, use the management UI, since
`x-death` is a message header, not something a depth query surfaces:

1. Open `http://localhost:15672/#/queues/%2F/killreport.parking` (droplet:
   substitute the droplet's host).
2. "Get messages" → set "Requeue" to **no** only if you intend to remove it
   from the view for inspection purposes elsewhere; to just look, leave
   messages in place and use a small count (e.g. 1) with requeue **yes**.
3. Expand the message's **Headers** → `x-death` is an array of dead-letter
   events, most recent first. The fields that matter:
   - `queue` — the queue the message was in when RabbitMQ dead-lettered it.
     This is its origin, and it is where a replay has to go back to.
   - `reason` — `rejected` for the `nack(msg, false, false)` path this
     project uses.
   - `count` — how many times this exact hop has happened. A message is
     parked here when this count (read via `deathCount()` in
     `backend/src/workers/worker-error.ts`) reaches `MAX_ATTEMPTS`. This is
     now the only `handleWorkerError` in the codebase — see "Retired:
     `esi_topology_dlq`" below.
   - `time` — when that hop happened.

---

## 🪦 Retired: `esi_topology_dlq`

`esi_topology_dlq` was the topology chain's own dead-letter queue, written by
an explicit publish from a `handleWorkerError` that lived in
`backend/src/queues/topology-messages.ts` and counted attempts inside the
message payload rather than reading `x-death`. That function, `MAX_ATTEMPTS`
and the payload's `attempts` field were removed once every topology worker
moved to the shared failure path in `backend/src/workers/worker-error.ts`
(the same one every other worker in the app uses). New failures from the star,
stargate, station, planet, moon and asteroid belt workers now park on
`killreport.parking` instead, alongside every other worker's parked messages —
see "Inspecting the parking queue" above.

`esi_topology_dlq` is no longer declared in `ALL_QUEUES`
(`backend/src/services/queue-names.ts`), so `ensureAllQueuesExist()` stops
asserting it and `doctor:topology` no longer reports its depth. The queue
itself is **left in place on the broker** — it may still hold messages from
before this change, and no step of this retirement drains, purges, or deletes
it. Checking it, draining it, and deleting it are a separate operator
decision:

```bash
sudo rabbitmqctl list_queues name messages | grep esi_topology_dlq
```

If that shows messages, read them the same way as a parked message (above)
before deciding whether to replay or discard them, then delete the queue by
hand once it is empty and no longer needed:

```bash
sudo rabbitmqctl delete_queue esi_topology_dlq --if-empty
```

---

## 🔧 Replaying a parked message by hand

This section describes the intended behaviour once the shared failure path
(`worker-error.ts`) ships. Parking is not a queue to drain automatically. A
message that reached `killreport.parking` will have failed `MAX_ATTEMPTS`
times against whatever queue's worker is named in its `x-death[0].queue` —
five attempts, roughly two and a half minutes apart given the wait queue's 30
second TTL and RabbitMQ's own redelivery. That is enough attempts to rule out
a transient blip. Replaying it without reading why it failed just runs the
same five attempts again and parks it a second time, and now there are two
identical messages competing for the same investigation.

Before replaying:

1. Read the message body and its `x-death` header (above) to identify the
   origin queue and, from worker logs around the failure times, the actual
   error — a 404 that should never have nacked in the first place, a genuinely
   malformed payload, a bug in that worker, an ESI outage that has since
   ended.
2. Fix the cause if there is one to fix (a code bug, a bad row in the source
   table the queue script read from). Replaying into an unfixed bug just
   produces the same failure a sixth time.
3. Only then republish it to the queue named in `x-death[0].queue`, by hand,
   through the management UI:
   - On `killreport.parking`'s "Get messages" panel, copy the message payload,
     then use requeue **no** to remove that one message from parking.
   - Go to the origin queue's page (`/#/queues/%2F/<queue-name>`) → "Publish
     message" → paste the same payload → Publish.

There is no bulk "replay everything in parking" command in this project, and
that is deliberate: parking exists because these messages already proved they
are not self-healing.

---

## 🛡️ Removing the policy — rollback

```bash
sudo rabbitmqctl clear_policy killreport-dlx
sudo rabbitmqctl list_policies
```

Fallback through the management API:

```bash
curl -u guest:guest -X DELETE \
  http://localhost:15672/api/policies/%2F/killreport-dlx
```

Clearing the policy detaches the dead-letter exchange from every queue it
matched; it does not touch any queue's own declared arguments
(`x-max-priority` stays exactly as `ensureAllQueuesExist()` left it), and it
does not delete, purge, or redeclare anything. A worker that nacks after the
policy is cleared goes back to dropping the message on the floor, so treat
this as an emergency rollback, not a routine toggle — restore the policy as
soon as whatever prompted the rollback is understood.

---

## 📚 Related Documentation

- [PM2 Process Management](./pm2.md) — the workers this policy protects
- [Crontab Configuration](./crontab.md) — the other scheduling mechanism
- [Universe Topology Chain](../workers/universe-topology-chain.md) — the
  worker family the retry topology generalises from
- [Worker Status Monitoring](../workers/worker-status-monitoring.md) — how
  `STALLED` differs from a queue that is meant to hold messages
- Source of truth for names: [`queue-names.ts`](../../src/services/queue-names.ts)
- Retry topology declaration: [`rabbitmq.ts`](../../src/services/rabbitmq.ts)

---

**Last Updated:** September 21, 2026
**RabbitMQ Version:** 3.9.x
**Policy Name:** `killreport-dlx`
