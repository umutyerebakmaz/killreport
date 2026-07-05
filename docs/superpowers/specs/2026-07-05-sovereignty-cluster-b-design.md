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
- **B2 — Attacker-vs-defender combat split.** Decompose each campaign's war-kill total into
  defender-side vs attacker-side ISK/ships lost, computed from `victim.alliance_id` relative to
  `campaign.defender_id`. Answers "which side is winning the ISK war?" Requires one small
  additive migration + a correlate-worker change.
- **B3-lite — Campaign history archive.** A read query over ended campaigns + a
  `/sovereignty/history` page.

**B2 feasibility (verified against local data):** `Victim.alliance_id` and `Attacker.alliance_id`
both exist and are indexed. Of the 7 war kills, 6 carry a victim alliance. The attacker-vs-
defender split needs only `victim.alliance_id == campaign.defender_id` — **it does NOT need the
empty `campaign_participants` table.** (Locally, 0 war kills have the defender as victim → the
defenders are currently winning the ISK war, exactly the insight this surfaces.)

**Deferred (own spec later, with reason)**

- **Per-alliance combat table (`CampaignAllianceCombat`).** A finer per-(campaign, alliance)
  breakdown. Attacker "kills dealt" attribution (final-blow) is fuzzy and it needs a new table;
  the two-sided split above delivers the headline value reliably first. Refinement, not now.
- **Attacker-side win rates.** Require knowing which alliances attacked each campaign. ESI
  omits the `participants` array for the current campaigns (the `campaign_participants` table
  is empty), so attacker win-rate attribution is blocked. Only **defender-side** win/loss
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

## 3. B2 — Attacker-vs-defender combat split

### 3.1 Schema (one small additive migration)

Extend the existing flat `CampaignCombatStats` with four split columns (the existing
`isk_destroyed` / `war_kills` remain as totals; the split decomposes them):

```prisma
model CampaignCombatStats {
  // ... existing: campaign_id, war_kills, isk_destroyed, ships_destroyed, last_correlated
  defender_isk_lost   Float @default(0)  // ISK of ships whose victim alliance == defender_id
  attacker_isk_lost   Float @default(0)  // ISK of ships whose victim alliance != defender_id
  defender_ships_lost Int   @default(0)
  attacker_ships_lost Int   @default(0)
}
```

**Migration procedure (the gotcha applies — additive, hand-written, no `migrate dev`):**
Because `prisma migrate dev` wants to DROP the raw-SQL-managed stats tables, hand-author the
migration: create `prisma/migrations/<timestamp>_add_campaign_combat_split/migration.sql`
containing only `ALTER TABLE "campaign_combat_stats" ADD COLUMN ...` (four columns, defaults 0),
then `yarn prisma:migrate:deploy` + `yarn prisma:generate`. No `DROP TABLE` anywhere. Verify the
five raw-SQL tables (`character_kill_stats`, etc.) are untouched afterward.

### 3.2 Correlate worker

`worker-sovereignty-correlate.ts` already tags kills and rolls up the flat totals. Add, per
active campaign, a grouped aggregate over the tagged kills joined to `victims`, split on
`victim.alliance_id == defender_id`:

```
-- for related_campaign_id = C, is_war_related = true:
SELECT (v.alliance_id = $defenderId) AS is_defender_loss,
       COUNT(*) AS ships, COALESCE(SUM(k.total_value),0) AS isk
FROM killmails k JOIN victims v ON v.killmail_id = k.killmail_id
WHERE k.related_campaign_id = $C
GROUP BY (v.alliance_id = $defenderId);
```

Map the two buckets into `defender_*` (is_defender_loss = true) and `attacker_*` (false; also
NULL victim alliance → treated as attacker/third-party loss). Fold into the existing
`campaignCombatStats.upsert`. If `defender_id` is null (rare), everything counts as attacker-side.

### 3.3 GraphQL + frontend

- Add to the `SovereigntyCampaign` type: `defenderIskLost`, `attackerIskLost`,
  `defenderShipsLost`, `attackerShipsLost` (all non-null, from `combatStats`, default 0).
- Frontend: in the active-campaigns expandable row (Cluster A) add an **"ISK War" bar** —
  a two-color bar (defender-bled vs attacker-bled ISK) with `formatISK` labels, showing which
  side is losing more. Reuse the `ScoreBar` two-segment idiom. Also show the split in the
  campaign history archive row (§4).

## 4. B3-lite — Campaign history archive

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

**Build order:** (1) B2 migration (hand-written ALTER TABLE ADD COLUMN) + `prisma:generate`;
(2) correlate-worker split logic + re-run to populate; (3) worker outcome logic + backfill the
existing ended campaign(s); (4) queries — `sovereigntyOutcomeStats`, `topDefenders`,
`sovereigntyCampaignHistory`, and the `SovereigntyCampaign` split fields; (5) `/sovereignty/
history` page + the ISK-war bar on active campaigns + nav; (6) verify in browser + GraphQL +
`/code-review`.

**One migration** (B2's four additive columns, hand-written, no DROPs). B1 (`outcome`) and
B3-lite are otherwise read-only.

## 5. Testing & verification

Same as Cluster A: GraphQL queries against local data + browser screenshots (`npx playwright
screenshot`; MCP browsers broken in this WSL env). Specifically verify: the worker writes a
plausible `outcome` for the 1 existing ended campaign (backfill), `sovereigntyOutcomeStats`
sums correctly, and the history page renders the archived campaign with its outcome + final
scores. Sparse data expected — verify shape/correctness, not volume.

## 6. Decisions made (user was away — flagged for review, adjust anytime)

1. **B2 included** at the user's request, scoped to the **attacker-vs-defender two-sided split**
   (the reliable, high-value core). The finer per-alliance table and fuzzy attacker kill-attribution
   are deferred within B2. Multi-day historical views remain deferred (single snapshot date locally).
2. **Outcome heuristic:** `EPS = 0.05`, "defender wins ties" — starting rule, tunable in one place.
3. **History UI:** a separate `/sovereignty/history` page + a third nav item (Overview /
   Structures & Timers / History).
4. **B2 combat split** shown as an "ISK War" two-color bar on the active-campaigns expandable row
   and in the history archive.

If any of these is wrong, say so and I'll adjust — they're isolated.
