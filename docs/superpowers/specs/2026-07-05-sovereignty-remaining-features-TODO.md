# Sovereignty Remaining Features — Progress Tracker

Companion to `2026-07-05-sovereignty-remaining-features-design.md`.
Living checklist — updated as work proceeds. `[ ]` todo · `[~]` in progress · `[x]` done.

**Current status:** Design written, awaiting user review. No code written yet.

---

## Cluster A — Data-ready quick wins

### Prep
- [ ] Extract `AllianceLink` → `frontend/src/components/Sovereignty/AllianceLink.tsx`
- [ ] Extract `ScoreBar` → `frontend/src/components/Sovereignty/ScoreBar.tsx`
- [ ] Update `app/sovereignty/page.tsx` to import both from new location

### Feature 5 — Active Wars by Region
- [ ] Backend: `RegionCampaignCount` type + `activeCampaignsByRegion` query (`Sovereignty.graphql`)
- [ ] Backend: resolver + shared `regionForSystems(systemIds)` helper (`queries.ts`)
- [ ] `cd backend && yarn codegen`
- [ ] Frontend: add to `SovereigntyDashboard` op + codegen
- [ ] Frontend: "Hottest Regions" bar-list section on dashboard
- [ ] Verify (GraphiQL + UI)

### Feature 2 — Alliance Rankings Enrichment
- [ ] Backend: extend `AllianceTerritoryRank` (attacking/defending/gained/lost)
- [ ] Backend: `AllianceActivityRank` + `mostAggressiveAlliances` / `mostDefensiveAlliances`
- [ ] Backend: `latestTerritoryStats(allianceIds)` helper + merge into rankings resolver
- [ ] `cd backend && yarn codegen`
- [ ] Frontend: extend rankings op + 2 leaderboard sections (reuse `TopAllianceCard`) + codegen
- [ ] Verify

### Feature 3 — Campaign Participants
- [ ] Backend: `CampaignParticipant` type + `participants` field on `SovereigntyCampaign`
- [ ] Backend: batch-fetch participants in `sovereigntyActiveCampaigns`
- [ ] `cd backend && yarn codegen`
- [ ] Frontend: expandable campaign row + nested participant list + codegen
- [ ] Verify

### Feature 1 — Structure & Timer Dashboard
- [ ] Backend: `SovereigntyStructureInfo` type + `sovereigntyStructures` + `sovereigntyUpcomingTimers`
- [ ] Backend: `enrichStructures` (reuse `regionForSystems`) + type-name map (IHub/TCU)
- [ ] `cd backend && yarn codegen`
- [ ] Frontend: `SovereigntyStructures.graphql` op + codegen
- [ ] Frontend: new route `app/sovereignty/structures/page.tsx` (Timers + All Structures)
- [ ] Frontend: `TimerCountdown` component (setInterval + `formatRelativeTime`)
- [ ] Frontend: convert `SOVEREIGNTY` nav to dropdown (Overview / Structures & Timers)
- [ ] Verify

### Feature 4 — Killmail War-Kill Surfacing (highest risk — last)
- [ ] Investigate `hasKillmailFiltersCompatibleFilter` condition list decision
- [ ] Backend: `isWarRelated` on `Killmail` type; `warRelated` on `KillmailFilter` input
- [ ] Backend: wire both query paths (materialized raw-SQL + plain-Prisma) + single `killmail()`
- [ ] `cd backend && yarn codegen`
- [ ] Frontend: `isWarRelated` in all 4 shared ops + `Killmail.graphql` + codegen
- [ ] Frontend: WAR KILL badge (`KillmailRow.tsx` + detail page)
- [ ] Frontend: filter plumbing (`filterUrlHelpers`, `KillmailFilters`, `killmails/page.tsx`)
- [ ] Verify (all 4 killmail tabs + filter + detail)

### Cluster A wrap-up
- [ ] Full manual pass across all 5 features
- [ ] `/code-review` on the diff
- [ ] Commit + push

---

## Cluster B — Backend analytics (own spec, not started)
- [ ] Spec: campaign `outcome` population + win rates
- [ ] Spec: per-alliance / attacker-vs-defender combat split
- [ ] Spec: historical analytics queries (archive, system history, monthly reports)

## Cluster C — Map & notifications (own spec, not started)
- [ ] Spec: interactive territory map (renderer decision needed)
- [ ] Spec: hot-zone heatmap
- [ ] Spec: notification/alert pipeline (worker + queue + delivery + prefs)

## Cluster D — Product/business (deferred)
- Premium tiers, payments, mobile, Discord bot, public API
