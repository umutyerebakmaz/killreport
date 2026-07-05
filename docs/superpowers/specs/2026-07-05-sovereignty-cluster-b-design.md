# Sovereignty Cluster B — Outcomes & Campaign History (Design)

**Date:** 2026-07-05
**Branch:** `feature/sov`
**Status:** Design — awaiting user review
**Parent:** `2026-07-05-sovereignty-remaining-features-design.md` (Cluster B)
**Depends on:** Cluster A (shipped, commits `15acd8a` + `3a485e4`)

---

## 1. Scope of this cycle

Cluster B in the parent spec was "new backend logic: campaign `outcome`, win rates,
historical analytics, per-alliance combat split." That is three loosely-coupled pieces of
differing effort, dependency, and data-readiness. This spec deliberately takes the two that
need **no migration** and have **reliable source data**, and defers the rest.

**In scope**

- **B1 — Campaign outcome + defender record.** Populate `SovereigntyCampaign.outcome` when a
  campaign ends; expose an outcome distribution and a defender win/loss record.
- **B3-lite — Campaign history archive.** A read query over ended campaigns + a
  `/sovereignty/history` page.

**Deferred (own spec later, with reason)**

- **B2 — Per-alliance / attacker-vs-defender combat split.** Needs a Prisma migration (new
  columns/table → the raw-SQL `DROP TABLE` gotcha), a correlate-worker rewrite, and reliable
  killmail attacker-alliance data. Heaviest, highest-risk. Not this cycle.
- **Attacker-side win rates.** Require knowing which alliances attacked each campaign. ESI
  omits the `participants` array for the current campaigns (the `campaign_participants` table
  is empty), so attacker attribution is blocked on the same data as B2. Only **defender-side**
  metrics are reliable now (`defender_id` is always present).
- **Multi-day historical views** — territory timeline chart, monthly gain/loss reports,
  per-system ownership history. The data exists (`SovereigntyMapSnapshot`,
  `AllianceTerritoryStats`) but only **one snapshot date** exists locally, so these can't be
  meaningfully built or verified yet. Add once several days of snapshots accrue.

**Data reality (local, 2026-07-05):** 1 ended campaign (with scores), 35 active, snapshots span
1 date, `territory_changes` empty. So the new features are correct-but-sparse locally and fill
in as the cron workers run — same pattern as Cluster A. No migration in this cycle.

---

## 2. B1 — Campaign outcome + defender record

### 2.1 Outcome inference (heuristic — flagged for tuning)

`worker-sovereignty-campaigns.ts` already sets `end_time = now` for campaigns that vanished
from ESI. Extend that step to also compute `outcome` from the campaign's **last-known scores**
(`defender_score` / `attackers_score`, each a 0..1 ESI progress value):

```
const EPS = 0.05;                              // "nobody really contested" threshold
const d = defender_score ?? 0, a = attackers_score ?? 0;
if (defender_score == null && attackers_score == null) outcome = 'abandoned';
else if (Math.max(d, a) < EPS)                        outcome = 'abandoned';
else if (d >= a)                                      outcome = 'defender_won';
else                                                   outcome = 'attacker_won';
```

This is an explicit heuristic (last-poll scores, not a ground-truth resolution event ESI
doesn't give us). The design surfaces it as tunable; `EPS` and the tie rule can change without
touching consumers. Only campaigns transitioning active→ended get an outcome written; already
-ended rows keep theirs (idempotent).

**Worker change shape:** before the current bulk `updateMany({ end_time: now })` for departed
campaigns, fetch those rows (id + scores), compute outcome per row, and update each with
`{ end_time: now, outcome }`. Small N per run (campaigns ending in one 5-min window), so a
per-row update loop is fine and mirrors the existing participant-upsert loop style.

### 2.2 Backend queries

- `sovereigntyOutcomeStats: SovereigntyOutcomeStats!` — counts over ended campaigns:
  `{ defenderWon, attackerWon, abandoned, totalResolved }`. Single `groupBy(['outcome'])`.
- `topDefenders(limit: Int): [AllianceDefenseRecord!]!` — alliances ranked by successful
  defenses. Group ended campaigns by `defender_id`, count `defender_won` vs total, compute
  `defenseSuccessRate`. Type: `{ rank, allianceId, allianceName, allianceTicker,
  defensesWon, defensesTotal, defenseSuccessRate }`. Enriched via existing `allianceNames`.

No migration; both are read-only aggregations over `sovereignty_campaigns`.

---

## 3. B3-lite — Campaign history archive

### 3.1 Backend

- `sovereigntyCampaignHistory(limit: Int, offset: Int): SovereigntyCampaignHistoryPage!` —
  ended campaigns (`end_time != null`), newest-ended first, paginated. Reuses the enrichment
  from `sovereigntyActiveCampaigns` (system/region/defender names, `resolveRegions`,
  `combatStats`). Return type carries `items` + a simple `totalCount`.
  Item fields: campaignId, eventType, solarSystem{Id,Name}, regionName, defender{Id,Name,Ticker},
  defenderScore, attackersScore, outcome, startTime, endTime, durationHours (computed),
  warKills, iskDestroyed.

### 3.2 Frontend — `/sovereignty/history`

New route `app/sovereignty/history/page.tsx` (same `"use client"` + Suspense + Loader shape as
the other sov pages), with:

1. **Outcome distribution** — a small stat row (Defender wins / Attacker wins / Abandoned /
   Total resolved) from `sovereigntyOutcomeStats`, plus a single stacked bar (reuse the
   `ScoreBar`-style inline bar idiom, no chart lib).
2. **Top Defenders** — a compact table from `topDefenders` (alliance, defenses won/total,
   success %). Gracefully empty until campaigns resolve.
3. **Campaign Archive** — paginated table from `sovereigntyCampaignHistory`: System, Region,
   Type, Defender, Outcome (color-coded: defender_won=cyan, attacker_won=red,
   abandoned=gray), Final score bar, Duration, Kills, ISK. Reuses `AllianceLink` / `ScoreBar`.

**Nav:** add a third item to the SOVEREIGNTY dropdown (Overview / Structures & Timers /
**History**), desktop + mobile.

One new frontend `.graphql` op (`SovereigntyHistory`) batching the three queries;
`useSovereigntyHistoryPageQuery`.

---

## 4. Conventions & build sequence

Follows the Cluster A conventions reference verbatim (see the parent spec §5): schema type +
`extend type Query` → `cd backend && yarn codegen` → resolver in `resolvers/sovereignty/
queries.ts` (DateTime→String, BigInt→String, `allianceNames`/`systemInfo`/`resolveRegions`
helpers, no Redis) → frontend `.graphql` → `cd frontend && yarn codegen` → page → manual verify.

**Build order:** (1) worker outcome logic + a one-off backfill of the existing ended
campaign(s); (2) `sovereigntyOutcomeStats` + `topDefenders`; (3) `sovereigntyCampaignHistory`;
(4) `/sovereignty/history` page + nav; (5) verify in browser + GraphQL.

**No migration.** `outcome` already exists on the model. Everything else is read-only.

## 5. Testing & verification

Same as Cluster A: GraphQL queries against local data + browser screenshots (`npx playwright
screenshot`; MCP browsers broken in this WSL env). Specifically verify: the worker writes a
plausible `outcome` for the 1 existing ended campaign (backfill), `sovereigntyOutcomeStats`
sums correctly, and the history page renders the archived campaign with its outcome + final
scores. Sparse data expected — verify shape/correctness, not volume.

## 6. Open decisions for the user

1. Confirm the deferrals: **B2, attacker-side rates, and multi-day historical views** pushed to
   a later spec — OK? (This cycle = outcome + defender record + campaign archive, migration-free.)
2. Outcome heuristic: `EPS = 0.05` and "defender wins ties" — acceptable starting rule?
3. History UI: a **separate `/sovereignty/history` page** (recommended) vs. folding the archive
   into the existing dashboard. OK to add the third nav item?
