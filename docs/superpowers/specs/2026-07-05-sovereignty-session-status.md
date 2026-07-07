# Sovereignty Work — Session Status & Handoff (2026-07-05)

Branch: `feature/sov` · 17 commits this session (`a1668da` … `a29f1f4`), all pushed.
Every feature was type-checked (frontend 0 errors; backend only 3 pre-existing unrelated errors),
verified against live local data in-browser, and passed a high-effort multi-agent `/code-review`
whose findings were fixed & re-verified.

Per-cluster design + progress trackers live in `docs/superpowers/specs/2026-07-05-*`.

---

## DONE ✅

### Warm-up — future-aware campaign timers (`a1668da`)
`formatRelativeTime` (both directions) so future vulnerability-window timers show "in 3h", not
"just now". Column renamed to "Timer".

### Cluster A — data-ready quick wins (`15acd8a`, review `3a485e4`)
Surfaced data the workers already collect but nothing displayed:
- **Structure & timer dashboard** — `/sovereignty/structures` (IHub/TCU badges, occupancy, vuln
  window, live H:MM:SS countdown).
- **Alliance rankings enrichment** — Attacking/Defending columns + Most Aggressive/Defensive.
- **Campaign participants** — expandable active-campaign row.
- **Killmail war-kill surfacing** — `isWarRelated` field + "WAR KILL" badge + `warRelated` filter
  (wired through both killmail query paths + date-counts).
- **Active wars by region** — "Hottest Regions" bars.
- Nav → dropdown; shared `AllianceLink`/`ScoreBar`.

### Cluster B — outcomes, ISK-war split, history (`3706158`, review `82d8da9`)
- **B1 outcome** — campaigns worker infers `outcome` (defender_won/attacker_won/abandoned) when a
  campaign ends; `sovereigntyOutcomeStats` + `topDefenders`; backfill migration.
- **B2 attacker-vs-defender split** — 4 additive columns on `campaign_combat_stats` (hand-written
  migration, no DROPs); correlate worker splits by `victim.alliance_id == defender_id`; "ISK War"
  bar on the expandable row.
- **B3-lite history** — `/sovereignty/history` (outcome distribution, top defenders, paginated
  campaign archive).

### Cluster C — hotspots, map, alerts (all done)
- **C1 conflict hot-zones** (`ec86ebd`, review `ca02744`) — `conflictHotspots` query;
  `/sovereignty/hotspots` **ECharts treemap** (intensity = campaigns×3 + war kills) + ranked table.
- **C2 interactive territory map** (`25fe4a1`, review `74008f7`) — `sovereigntyMapPoints`;
  `/sovereignty/map` **ECharts scatter** of 5,330 sov systems at real galactic (x,z), colored by
  top-15 alliances + Other + dim Unclaimed; zoom/pan/legend/tooltip; client-side region filter;
  square-window fix for undistorted aspect.
- **C3 in-app war alerts over SSE** (`4a04440`, review `a29f1f4`) — sov workers publish
  campaign_started/ended/territory_change via the Redis-backed pubsub; `sovereigntyAlert`
  subscription; global provider → color-coded toasts + header `NotificationBell` (recent list +
  unread, localStorage). Enrichment done once at publish time (`alert-builder.ts`); frontend uses
  Apollo `onData` so bursts aren't dropped.

**Tech notes for continuation:** SolarSystem Prisma PK field is `id` (DB col `system_id`);
PrismaClient type imports from `../generated/prisma/client` (not `@prisma/client`); every
`migrate diff` still wants to DROP the raw-SQL stats tables — hand-write additive migrations.

---

## NOT DONE ❌ (deferred, with reasons)

### Within Cluster B
- **Per-alliance combat table** (`CampaignAllianceCombat`) — finer than the two-sided split;
  attacker "kills dealt" attribution is fuzzy; needs a new table. Two-sided split shipped instead.
- **Attacker-side win rates** — needs to know which alliances attacked each campaign, but ESI
  omits participants (the `campaign_participants` table is empty), so only defender-side records
  are reliable.

### Within Cluster C
- **Multi-day historical views** — territory-timeline chart, monthly gain/loss reports, per-system
  ownership history. Data model supports them, but only **one snapshot date** exists locally, so
  they can't be meaningfully built/verified yet — they accrue as the daily snapshot worker runs.
- **C3 favorite-alliance filter** — designed as client-side (localStorage) but needs a small
  management UI to be useful; deferred to keep the alert MVP clean.
- **C3 hardening** — server-side per-user watchlists (needs a table + auth-scoped filtering),
  persisted notification inbox (cross-device history), and **email / Discord / web-push** delivery
  (no outbound infra exists — all net-new). Transient-ESI false `campaign_ended` alert is a known
  edge case tied to the pre-existing "end on disappear" lifecycle (would need a debounce/migration).
- **Structure-vulnerability-timer alerts** — timer-based, not a discrete worker-detected event.

### Cluster D — monetization (DROPPED, not part of this project)
The original roadmap doc (`SOVEREIGNTY_FEATURES_TR.md`) proposed premium tiers / payments / paid
API. **This is explicitly NOT wanted for this project** — there is no monetization plan, and CCP's
EVE third-party developer license restricts commercializing tools built on EVE IP. Do NOT propose
premium/payment/paid features again. (A free Discord bot or free public API would be fine on their
own merits, but not as a paid tier.)

---

## Data reality (local) — why some things read as sparse
36→35 active campaigns; **1 ended campaign**; `campaign_participants` empty (ESI omits it);
structure vuln windows all in the past (stale worker data); `system_kills`, `territory_changes`,
and multi-day snapshots empty/single-date locally. All features handle empty gracefully and fill
in as the cron workers run in production.

## Suggested next steps (technical, in-scope)
1. **B2 per-alliance combat table** — the only remaining "unique analytics" piece with data ready.
2. **Multi-day historical views** — once several snapshot days accrue.
3. **C3 favorites UI** — small, makes the alert filter real.
