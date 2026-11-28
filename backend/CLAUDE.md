# backend/

Loaded when working under `backend/`. The root `CLAUDE.md` holds the rules
(every ESI request through `esiClient`, no rate limit of your own, no ESI from
a resolver); this file holds the mechanics behind them.

## ESI rate limiting

ESI publishes no single req/sec ceiling. It runs two limit systems, and both
speak through response headers:

- **Route-group token buckets** (`X-Ratelimit-Group` / `-Limit` / `-Remaining`).
  Below 20% remaining a group is spaced at its refill pace; with under two
  tokens left it waits for one to come back. A grouped 429 pauses only that
  group for `Retry-After`.
- **The legacy error limit** (`X-ESI-Error-Limit-Remain` / `-Reset`). Below 20
  remaining, or on any 420, every ESI caller brakes until the reset (60 s when
  the header is missing).

A 429 with no group header is the deeper server limiter: every ESI caller
brakes for `Retry-After` (15 s when it is missing, as it always has been so far)
and the shared dispatch rate drops by a quarter (floor 1 req/s, at most once per
10 s), then climbs +1 req/s per 10 s, counted only while requests are being granted:
a gap of 10 s or more without a grant freezes the rate earned so far, so a
learnt rate survives an idle period. The shared bucket holds 6 tokens
(the 5-token live reserve plus one), so bulk work does not burst when a brake ends. Brakes are capped at
15 minutes. The source of truth is the Lua scripts in
`backend/src/services/esi-limiter/` (`lib.lua`, `acquire.lua`, `observe.lua`);
`backend/src/services/rate-limiter.ts` and
`backend-rs/crates/esi/src/limiter.rs` are the local fallback used while Redis
is unreachable.

The budget is shared, not per process. The brake, the adaptive rate and the
group buckets live in Redis (`backend/src/services/esi-limiter/`, Lua scripts
shared with the Rust workers), so every Node and Rust process on this machine
spends one common budget. `ESI_MAX_RPS` (default 50) is the upper bound of that
**application-wide** rate. If Redis cannot be reached, each process drops to its
own local limiter (`rate-limiter.ts`, logged as `Redis unreachable`) and the
ceiling is per process again until Redis returns. Requests carry a class: the
API server and `worker-redisq-stream` call `setEsiPriority('live')` (the Rust
`worker-redisq` uses `EsiClient::live`; every other Rust client is bulk) and keep a
reserve of the budget; every other process is `bulk`. Two checkouts share a
budget only if they share a `REDIS_URL` database; different logical databases
mean separate budgets.

`ESI_PREFETCH` is a separate, per-worker knob: how many messages a worker holds
unacked. The API server and `worker-redisq-stream` call `setEsiMaxWait(10_000)`
(the Rust `worker-redisq`: `EsiClient::live(10 s)`),
so a brake longer than 10 s fails the request with `EsiThrottledError` instead
of hanging; workers wait the brake out.

Concurrency is `channel.prefetch(N)`. Three families of worker exist today:

- The info workers (`worker-info-*`, Node and Rust alike) and the universe
  workers compute it as `max(ESI_PREFETCH, ceil(ESI_MAX_RPS / 2))`, which is 25
  with the defaults. The Rust runner computes it in
  `backend-rs/crates/runner/src/prefetch.rs`. Each message is one ESI call and
  one short upsert, so the worker pool keeps up at that depth.
- The rest set a fixed `PREFETCH_COUNT` constant (1–10) and rely on the
  limiter for the real rate. The Node `worker-killmail-detail` is fixed at 10:
  its writes are heavy, and at 100 they hit the 10 s connection timeout of the
  2-connection pool workers had then. The Rust one runs on the runner's rule
  above; its pool is 10, and the messages past that wait for a connection.
- `worker-regions` and `worker-constellations` use `prefetch(1)` with a manual
  100 ms sleep, which is 10 req/sec serial. Slower, but simple and safe for
  workers whose write path is a large transaction. They no longer read the
  error-limit header themselves.

Workers share one failure path, `handleWorkerError`. On an `EsiThrottledError`
it requeues at once, without sleeping and without burning an attempt — the brake
lives in the limiter. A 420/429 that did not come from ESI (zKillboard) still
sleeps 60 s before the requeue. A 404 warns and skips.

## ESI endpoint shapes worth knowing

Checked against `https://esi.evetech.net/meta/openapi.json` on 2026-08-28.

Under `/universe/`, only `systems`, `regions`, `constellations`, `types`,
`categories`, `groups` and `graphics` have a **list** form. `stargates`, `stars`,
`planets`, `moons`, `asteroid_belts` and `stations` are by-ID only — so for those
the database is the only possible source of "what still needs fetching".

`POST /universe/names` resolves up to 1000 IDs per call, but only for `alliance`,
`character`, `constellation`, `corporation`, `inventory_type`, `region`,
`solar_system`, `station` and `faction`. Star, planet, moon, asteroid belt and
stargate IDs return 404.

`/universe/systems/{id}/` omits keys entirely rather than returning empty arrays:
`stargates`, `stations`, `security_class` and the per-planet `moons` /
`asteroid_belts` can all be absent. Read them with `?? []` / `?? null`.
