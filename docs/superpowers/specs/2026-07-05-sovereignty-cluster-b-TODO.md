# Sovereignty Cluster B — Progress Tracker

Companion to `2026-07-05-sovereignty-cluster-b-design.md`.
`[ ]` todo · `[~]` in progress · `[x]` done.

**Scope this cycle:** B1 (outcome + defender record) · B2 (attacker-vs-defender split) · B3-lite
(campaign history archive). Deferred: per-alliance combat table, attacker-side win rates,
multi-day historical views.

---

## B2 — Attacker-vs-defender combat split (migration first)
- [x] Schema: 4 additive columns on `CampaignCombatStats` (defender/attacker isk_lost, ships_lost)
- [x] Hand-written migration `ALTER TABLE ... ADD COLUMN` (no DROPs) + `prisma:migrate:deploy` + `prisma:generate`
- [x] Verify raw-SQL stats tables untouched
- [x] Correlate worker: split aggregate on `victim.alliance_id == defender_id`; fold into upsert
- [x] Re-run correlate worker to populate the split
- [x] GraphQL: split fields on `SovereigntyCampaign`
- [x] Frontend: "ISK War" two-color bar on active-campaigns expandable row
- [x] Verify

## B1 — Campaign outcome + defender record
- [x] Campaigns worker: compute `outcome` from final scores when marking ended (EPS=0.05, defender wins ties)
- [x] Backfill the existing ended campaign(s)
- [x] Query `sovereigntyOutcomeStats` (defenderWon/attackerWon/abandoned/totalResolved)
- [x] Query `topDefenders(limit)` (defensesWon/Total, successRate)
- [x] Verify

## B3-lite — Campaign history archive
- [x] Query `sovereigntyCampaignHistory(limit, offset)` (ended campaigns, enriched, + split + outcome)
- [x] Frontend `SovereigntyHistory.graphql` op + codegen
- [x] Page `app/sovereignty/history/page.tsx` (outcome dist + top defenders + archive table)
- [x] Nav: third dropdown item "History" (desktop + mobile)
- [x] Verify

## Wrap-up
- [x] Full runtime pass (GraphQL + browser)
- [x] `/code-review` (high, workflow-backed) — fixed: ending-loop atomicity (per-row try/catch),
  empty-ESI end-marking guard, reappearance clears `outcome`, topDefenders excludes null-outcome,
  outcome backfill migration. Documented/skipped with rationale: defender_id-null split (correct by
  definition), same-system concurrent-campaign tagging (pre-existing Phase 3 model), post-deploy
  split self-heal, heuristic score-lag, N+1 aggregate.
- [x] Commit + push
