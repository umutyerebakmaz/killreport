# Sovereignty Cluster B — Progress Tracker

Companion to `2026-07-05-sovereignty-cluster-b-design.md`.
`[ ]` todo · `[~]` in progress · `[x]` done.

**Scope this cycle:** B1 (outcome + defender record) · B2 (attacker-vs-defender split) · B3-lite
(campaign history archive). Deferred: per-alliance combat table, attacker-side win rates,
multi-day historical views.

---

## B2 — Attacker-vs-defender combat split (migration first)
- [ ] Schema: 4 additive columns on `CampaignCombatStats` (defender/attacker isk_lost, ships_lost)
- [ ] Hand-written migration `ALTER TABLE ... ADD COLUMN` (no DROPs) + `prisma:migrate:deploy` + `prisma:generate`
- [ ] Verify raw-SQL stats tables untouched
- [ ] Correlate worker: split aggregate on `victim.alliance_id == defender_id`; fold into upsert
- [ ] Re-run correlate worker to populate the split
- [ ] GraphQL: split fields on `SovereigntyCampaign`
- [ ] Frontend: "ISK War" two-color bar on active-campaigns expandable row
- [ ] Verify

## B1 — Campaign outcome + defender record
- [ ] Campaigns worker: compute `outcome` from final scores when marking ended (EPS=0.05, defender wins ties)
- [ ] Backfill the existing ended campaign(s)
- [ ] Query `sovereigntyOutcomeStats` (defenderWon/attackerWon/abandoned/totalResolved)
- [ ] Query `topDefenders(limit)` (defensesWon/Total, successRate)
- [ ] Verify

## B3-lite — Campaign history archive
- [ ] Query `sovereigntyCampaignHistory(limit, offset)` (ended campaigns, enriched, + split + outcome)
- [ ] Frontend `SovereigntyHistory.graphql` op + codegen
- [ ] Page `app/sovereignty/history/page.tsx` (outcome dist + top defenders + archive table)
- [ ] Nav: third dropdown item "History" (desktop + mobile)
- [ ] Verify

## Wrap-up
- [ ] Full runtime pass (GraphQL + browser)
- [ ] `/code-review`
- [ ] Commit + push
