# Sovereignty — Worker Flow & How to Run

Operational guide for the sovereignty module. **If you came back after a while and forgot how to
run it, jump to [§4 How to run locally](#4-how-to-run-locally).**

---

## 1. How the module works (data flow)

The sovereignty module is **read-from-DB**. The GraphQL API and the frontend never call EVE ESI —
they only read Postgres. **The cron workers are the only thing that pulls data.** If the workers
don't run, the data goes stale and nothing on the sov pages updates.

```
                 ┌──────────── EVE ESI (/sovereignty/*) ────────────┐
                 │                                                   │
     worker:sov:campaigns   worker:sov:map   worker:sov:structures   │  (pull, on cron)
                 │                │                │                  │
                 ▼                ▼                ▼                  │
        ┌───────────────────── Postgres ─────────────────────┐      │
        │  campaigns, participants, map_current, structures,  │      │
        │  territory_changes, snapshots, combat_stats, ...     │      │
        └──────────────┬───────────────────────┬──────────────┘      │
                       │                        │                     │
     worker:sov:snapshot (daily agg)   worker:sov:correlate (killmail↔campaign)
                       │                        ▲                     │
                       ▼                        │                     │
                  (DB tables)          killmails table ◀── worker:redisq (realtime feed)
                       │
        ┌──────────────▼───────────────┐        Live SSE alerts:
        │  GraphQL API (Yoga, :4000)   │        campaigns/map workers publish → pubsub (Redis)
        │  reads DB only, never ESI    │────────────────────────────▶ browser toast + bell
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  Frontend (Next.js, :3000)   │  /sovereignty  · /structures · /history
        │  Apollo → GraphQL + SSE      │  /hotspots · /map  + notification bell
        └──────────────────────────────┘
```

---

## 2. The workers — who pulls what, and when

| yarn script | Pulls from | Cron (prod) | Writes / does |
|---|---|---|---|
| `worker:sov:campaigns` | ESI `/sovereignty/campaigns` | every **5 min** | campaigns + participants; sets `outcome` when a campaign ends; **publishes campaign_started / campaign_ended alerts** |
| `worker:sov:map` | ESI `/sovereignty/map` | every **30 min** | system ownership (`map_current`) + `territory_changes`; **publishes territory_change alerts** |
| `worker:sov:structures` | ESI `/sovereignty/structures` | every **30 min** (offset 15) | IHub/TCU inventory + vulnerability windows; marks destroyed |
| `worker:sov:snapshot` | Postgres (aggregates) | **daily 01:00 UTC** | daily map snapshot + per-alliance territory stats |
| `worker:sov:correlate` | Postgres (killmails × campaigns) | every **10 min** | tags war kills (`is_war_related`) + rolls up combat stats incl. attacker/defender ISK split |
| `worker:redisq` | RedisQ / R2Z2 stream | **continuous** | ingests killmails in real time (feeds correlate + war-kill stats) |

Each `worker:sov:*` is a **one-shot process**: it runs once, does its job, exits. In production
PM2's `cron_restart` re-launches it on schedule. `worker:redisq` runs continuously.

**Ordering note:** `campaigns`/`map`/`structures` fill the base tables first; `correlate` needs
both killmails (from `redisq`) and campaigns; `snapshot` aggregates what the others wrote.

---

## 3. Prerequisites (must be running)

- **Postgres** on `:5432` with the `killreport` DB and migrations applied.
- **Redis** on `:6379` (used for caching AND the SSE alert pubsub — `USE_REDIS_PUBSUB=true`).
- `backend/.env` `DATABASE_URL` pointing at the **local** DB for local dev.

Quick check they're up:
```bash
pg_isready -h localhost -p 5432 && redis-cli ping
```

---

## 4. How to run locally

### 4a. Start the app (two terminals or backgrounded)
```bash
# from repo root
yarn dev:backend     # GraphQL API on http://localhost:4000/graphql
yarn dev:frontend    # site on http://localhost:3000
```

### 4b. Pull fresh sovereignty data (run once each; repeat when you want fresh data)
```bash
cd backend
yarn worker:sov:campaigns    # fresh campaigns (+ fires new-campaign alerts if the site is open)
yarn worker:sov:map          # ownership + territory changes (+ territory-change alerts)
yarn worker:sov:structures   # structures + live vulnerability timers
yarn worker:sov:correlate    # link killmails ↔ campaigns, war-kill + ISK-split stats
yarn worker:sov:snapshot     # (optional) daily aggregates — needed for multi-day history
```
After running these, refresh the sov pages: the map/rankings/hotspots update, structure timers
become forward-looking, and combat stats populate.

### 4c. (Optional) real-time killmails
```bash
cd backend
yarn worker:redisq           # continuous; leave it running to ingest live kills
```

### 4d. Keep it fresh automatically (local scheduler)
The workers don't self-schedule. To mimic production locally, either run them under PM2 with the
repo's `ecosystem.config.js`, or add a plain crontab, e.g.:
```cron
*/5  * * * *  cd /root/killreport/backend && yarn worker:sov:campaigns
*/30 * * * *  cd /root/killreport/backend && yarn worker:sov:map
15,45 * * * * cd /root/killreport/backend && yarn worker:sov:structures
*/10 * * * *  cd /root/killreport/backend && yarn worker:sov:correlate
0    1 * * *  cd /root/killreport/backend && yarn worker:sov:snapshot
```

---

## 5. Production

```bash
pm2 start ecosystem.config.js      # runs API + workers on their cron schedules
pm2 logs worker-sov-campaigns      # tail a worker
```
The sov worker PM2 entries use `autorestart: false` + `cron_restart` (one-shot on schedule) and
set `USE_REDIS_PUBSUB: 'true'` so their alert publishes reach the API-server subscribers.

---

## 6. Troubleshooting — "the data looks stale / nothing updates"

- **Sov pages show old numbers** → the workers haven't run. Run §4b (or check PM2/cron).
- **Structure "Next 24h Timers" is empty** → `worker:sov:structures` hasn't run recently, so all
  vulnerability windows are in the past. Re-run it.
- **War kills / ISK all zero** → run `worker:sov:redisq` (to have kills) then `worker:sov:correlate`.
- **No live alert toast/bell** → alerts only fire when a worker **detects a change** while a browser
  is open. If nothing changed on ESI this run, nothing fires. Verify Redis is up and
  `USE_REDIS_PUBSUB=true` (else pubsub falls back to in-memory and worker→API delivery breaks).
- **History / timeline sparse** → those need several days of `worker:sov:snapshot` runs to accumulate.
- **`P1001` DB connection error** → `DATABASE_URL` is pointing at the remote prod DB; point it at
  the local `killreport` DB for local dev.
