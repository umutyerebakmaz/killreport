# RabbitMQ Dead Letter Policy - KillReport

This documents how to attach the retry topology (`killreport.dlx`,
`killreport.retry`, `killreport.wait`, `killreport.parking`) — declared in code
by `ensureAllQueuesExist()` in
[`../../src/services/rabbitmq.ts`](../../src/services/rabbitmq.ts) — to the 24
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
change the declared arguments for every one of the 24 queues that already
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

> **This policy ships in the same release as the shared failure path
> (`backend/src/workers/worker-error.ts`) — apply it together, not ahead of
> it.** Every worker in the app now routes through `handleWorkerError()`,
> and `nack(msg, false, false)` only recovers anything once the queue it
> failed in actually has `x-dead-letter-exchange` set — which is what this
> policy attaches.
>
> Applying this policy to a deployment whose workers do **not** yet carry
> `worker-error.ts` does not fix anything early — it changes the failure mode
> for the worse. Without the policy, an old-code `nack(msg, false, false)`
> has nowhere to send the message and RabbitMQ discards it silently: a real
> bug, but a bounded one — the message is gone once, not looping. With the
> policy applied but the death-count check that parks a message after
> `MAX_ATTEMPTS` still absent from the running code, that same nack instead
> loops origin → `killreport.dlx` → `killreport.wait` (30 s TTL) →
> `killreport.retry` → origin, forever, once every 30 seconds, and nothing
> ever parks it. Do not apply this policy ahead of a release that carries
> `worker-error.ts` — see "Deployment order" below for the order once it does.

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

`yarn rabbitmq:policy` in `backend/package.json` is the CLI form without the
`sudo`, for a development machine where `rabbitmqctl` runs as your own user —
a Homebrew install does. It sets the same policy, so which one applied it is
not something the broker records or cares about.

The policy is stored in the broker's own schema database, never in git. A
second development machine that pulls the branch therefore starts with no
policy at all, even though every line of code that depends on one is present;
`rabbitmqctl list_policies` returning nothing there is an unconfigured broker,
not a broken checkout. Each broker needs this run once, and it survives
restarts afterwards.

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
those too and inflates the number past 24. That is not a bug in the pattern;
it is the pattern doing exactly what it is asked to do — match by prefix, not
by an enumerated list. The `comm` check above is what actually proves
coverage; the bare count is a sanity check, not the verification.

None of this proves the policy does anything, though. A queue can carry
`x-dead-letter-exchange: killreport.dlx` and still drop every message it
dead-letters, silently, if `killreport.dlx` itself does not exist on the
broker — see "Deployment order" below for when that exchange is created.
Coverage of the queues and existence of the exchanges are two different
checks; verify both:

```bash
sudo rabbitmqctl list_exchanges | grep killreport
```

Expect two lines, `killreport.dlx` and `killreport.retry`.

---

## 🔄 Deployment order — exchanges, then the policy, then the workers

This assumes the release being deployed carries the shared failure path
(`worker-error.ts`) — see the warning above if it does not.

`killreport.dlx` and `killreport.retry` are declared by
`ensureAllQueuesExist()` in
[`../../src/services/rabbitmq.ts`](../../src/services/rabbitmq.ts), which
runs when the **API server** starts — not by `set_policy`, and not by
`pm2 restart all` on its own until that restart includes the API process.
Applying the policy before those exchanges exist leaves every matching queue
with a `dead-letter-exchange` that names something the broker doesn't have
yet, and RabbitMQ drops anything dead-lettered into a missing exchange with
no error and no log — the same silent-discard failure mode this whole policy
exists to close, reopened for the gap between the two steps.

On a broker that has run this app before, both exchanges already exist from
the last time the API server started, so this only matters for a fresh
broker or a staging box where the API server has never come up. This order
is load-bearing regardless:

1. Confirm the exchanges exist:
   ```bash
   sudo rabbitmqctl list_exchanges | grep killreport
   ```
   Expect `killreport.dlx` and `killreport.retry`. If neither appears, start
   the API server first so `ensureAllQueuesExist()` runs, then re-check.
2. Apply the policy (above). Existing queues gain `x-dead-letter-exchange`
   immediately, with no restart needed — a policy change takes effect on
   already-open queues.
3. Only then restart the workers:
   ```bash
   pm2 restart all
   ```

Reversed — restarting workers before the policy exists — a worker that nacks
a message **before** the policy is attached has nowhere to send it:
`nack(msg, false, false)` with no dead-letter exchange configured on the
queue simply discards the message. There is no error, no log line, no retry
— the message is gone. The dead letter policy has to exist before the first
failure it is meant to catch, not after.

---

## ♻️ Retry belongs to the broker, not to a publisher

A publisher must not re-send work that failed. Since #234 the broker holds it:
[`../../src/workers/worker-error.ts`](../../src/workers/worker-error.ts) waits
60 seconds on a 420/429 and requeues the same message, and everything else
nacks into `killreport.dlx` for the 30-second round trip. The message is never
dropped, so nothing outside the broker has to remember it.

That is a reversal, and the reversal is the hazard. Before #234, `cdd4de02`
(2026-01-26) acked a rate-limited message away on purpose --- "will retry on
next cron cycle" --- which made the scheduled publisher the only retry there
was. A publisher written against that contract is correct to re-send blindly,
and stays silently wrong once the broker starts keeping the message: both
layers retry, and the queue fills with copies of one unit of work.

`services/user-killmail-cron.ts` is where this surfaced. It ticks every ten
minutes and its only guard was `users.last_killmail_sync_at`, a column written
in one place --- the worker, after a _successful_ ESI fetch. A worker that is
down or rate-limited never advances it, so every tick published another copy.
It reached 207 messages for a single user, all of them the same request, and
each 429 guaranteed the next one.

It now calls `getQueueStats()` first and holds off when the queue has messages
ready or no consumer at all. Two things make that cheap: `getQueueStats` reads
through its own monitoring channel, so a 404 cannot close the publishing
channel the way a bare `checkQueue` would, and it answers zeros when the broker
is unreachable --- which reads as "no consumer" and holds off. An unreadable
broker is not a reason to publish blindly.

It is not airtight, and the gap is worth knowing rather than discovering.
`messageCount` counts ready messages only, so a message a worker is holding
through its 60-second rate-limit wait is unacked and invisible. A tick landing
in that window still publishes one duplicate --- and the next tick, seeing it
ready, holds off. Bounded at one, where it used to be unbounded. Closing it
completely needs a per-user marker in the database, which was considered and
declined: it costs a migration and introduces a flag that stays set if a worker
dies mid-message.

The rule generalises past this one file. **Any scheduled publisher needs a
reason to believe its previous message is gone before it sends another.** For a
queue on the retry topology that reason is the broker's own count, not a
timestamp a consumer writes only when it succeeds.

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
3. Expand the message's **Headers**. `x-death` is an array of dead-letter
   events, most recently updated first — for a parked message that head
   entry is always the `killreport.wait` hop (`reason: "expired"`, from the
   30 s TTL), not the queue that originally failed it. The header that names
   the origin is a separate top-level one RabbitMQ maintains alongside
   `x-death`:
   - `x-first-death-queue` — the queue the message was in the **first** time
     RabbitMQ dead-lettered it. This is its origin, and it is where a replay
     has to go back to. **Do not read `x-death[0].queue` for this** — for the
     reason above it names `killreport.wait`, and publishing there is not a
     replay: 30 seconds later its TTL dead-letters the message to
     `killreport.retry` with routing key `killreport.wait`, for which that
     direct exchange has no binding, so it is dropped, unroutable and silent.
   - `x-death[].reason` — `rejected` for the origin-queue hop
     (`nack(msg, false, false)`), `expired` for the wait-queue hop.
   - `x-death[].count` — how many times that hop has happened. A message
     parks on its 5th delivery, but the header itself reads `MAX_ATTEMPTS - 1`
     (4) at that point: parking forwards the header unchanged rather than
     incrementing it, so "5th delivery" is correct and the raw header value
     is one less. Read via `deathCount()` in
     `backend/src/workers/worker-error.ts`, which is now the only
     `handleWorkerError` in the codebase — see "Retired: `esi_topology_dlq`"
     below.
   - `x-death[].time` — when that hop happened.

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

Parking is not a queue to drain automatically. A message that reached
`killreport.parking` will have failed `MAX_ATTEMPTS` times against whatever
queue's worker is named in its `x-first-death-queue` header — five attempts,
roughly two and a half minutes apart given the wait queue's 30 second TTL and
RabbitMQ's own redelivery. That is enough attempts to rule out a transient
blip. Replaying it without reading why it failed just runs the same five
attempts again and parks it a second time, and now there are two identical
messages competing for the same investigation.

Before replaying:

1. Read the message body and its `x-first-death-queue` header (above) to
   identify the origin queue and, from worker logs around the failure times,
   the actual error — a 404 that should never have nacked in the first place,
   a genuinely malformed payload, a bug in that worker, an ESI outage that
   has since ended.
2. Fix the cause if there is one to fix (a code bug, a bad row in the source
   table the queue script read from). Replaying into an unfixed bug just
   produces the same failure a sixth time.
3. Only then republish it to the queue named in `x-first-death-queue`, by
   hand, through the management UI:
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

---

## Sync mesajları artık kimlik bilgisi taşımıyor

`esi_user_killmails_queue` ve `esi_corporation_killmails_queue` mesajları
kullanıcının EVE SSO access ve refresh token'ını taşıyordu. Broker bunları
`persistent: true` ile diske yazıyordu ve `killreport.parking` bir kopyayı
süresiz saklıyordu, çünkü o kuyruğu hiçbir şey tüketmiyor. Mesaj artık yalnızca
`{ userId, fullSync?, queuedAt }`; token'ı worker `loadUserCredentials` ile
veritabanından okuyor.

**Yayına alma sırası tek yönlü: önce worker'lar, sonra publisher'lar.** Yeni
worker eski mesajı da işleyebilir — `userId` eski mesajda da var, fazla alanları
görmezden gelir. Tersi doğru değil: eski worker yeni mesajda `accessToken`
bulamaz ve kullanıcıyı ack'leyip atar. `pm2 reload all` sıralama üzerinde
kontrol vermez, yani bu geçiş anı gerçekten yaşanabilir. Character tarafında
bunun bedeli yok: atlanan senkronizasyon `services/user-killmail-cron.ts`'in on
dakikalık tick'iyle kendini onarıyor. Corporation kuyruğunun eşdeğer bir
cron'u yok — atlanan bir corporation senkronizasyonu kullanıcının bir sonraki
girişini ya da elle çalıştırılan `yarn queue:corporation-killmails`'i bekler.

Yayına aldıktan sonra, bir kez, elle, yalnızca iki sync kuyruğu için:

```bash
rabbitmqctl purge_queue esi_user_killmails_queue
rabbitmqctl purge_queue esi_corporation_killmails_queue
```

Bu iki kuyrukta duran her mesaj zaten bir "şu kullanıcıyı senkronize et"
isteği; kaybedilen tek şey bu istek, cron on dakika içinde yenisini
yayınlıyor. `yarn rabbitmq:purge` bu iş için **kullanılmaz** — o bütün
kuyrukları boşaltıyor.

**`killreport.parking`'i bu purge'e katma.** O kuyruk uygulamadaki her
worker'ın paylaştığı ortak terminal kuyruk: `worker-error.ts`'teki
`MAX_ATTEMPTS` denemesinden sonra her worker oraya publish ediyor ve mesajın
kökeni `x-death` header'ında taşınıyor — ay, yıldız, asteroid kuşağı ve diğer
bütün worker'ların kalıcı olarak başarısız mesajları da orada duruyor.
`doctor:topology` bu kuyruğun derinliğini raporluyor, çünkü nonzero bir
derinlik önce insan incelemesi gerektirir. Körlemesine purge etmek bu kanıtın
tamamını siler, yalnızca bu iki kuyruktan gelenleri değil. Önce "Inspecting
the parking queue" bölümünde anlatıldığı gibi mesajları oku,
`x-first-death-queue` header'ıyla kökenini teşhis et; yalnızca bu iki sync
kuyruğundan geldiği doğrulanan mesajları kaldır. Derinliğin tamamının zaten
sync mesajlarından ibaret olduğu biliniyorsa, purge etmek sorun değil.
