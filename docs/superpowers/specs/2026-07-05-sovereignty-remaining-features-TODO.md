# Sovereignty Remaining Features — Progress Tracker

Companion to `2026-07-05-sovereignty-remaining-features-design.md`.
Living checklist — updated as work proceeds. `[ ]` todo · `[~]` in progress · `[x]` done.

**Current status:** Cluster A implemented AND verified end-to-end against live local data
(browser screenshots + GraphQL). Backend + frontend typecheck clean (0 errors). Commit pending.

**Data-reality notes (not bugs — graceful empty states confirmed):**
- `campaign_participants` table is empty locally → participants expander simply doesn't appear.
- All structure `vulnerable_start_time` values are in the past (stale local worker data) →
  "Next 24h Timers" is empty; populates going forward with live workers.
- `campaigns_attacking` is 0 in the latest snapshot → "Most Aggressive" empty; "Most Defensive"
  and the rankings Defending column DO show data.
- Verified: WAR KILL badge renders, `?warRelated=true` filters to 7 kills, both query paths
  (plain-Prisma + materialized raw-SQL) apply the filter, filter-count badge shows 1.

---

## Cluster A — Data-ready quick wins

### Prep
- [x] Extract `AllianceLink` → `frontend/src/components/Sovereignty/AllianceLink.tsx`
- [x] Extract `ScoreBar` → `frontend/src/components/Sovereignty/ScoreBar.tsx`
- [x] Update `app/sovereignty/page.tsx` to import both from new location

### Feature 5 — Active Wars by Region
- [x] Backend: `RegionCampaignCount` type + `activeCampaignsByRegion` query (`Sovereignty.graphql`)
- [x] Backend: resolver + shared `resolveRegions()` helper (`queries.ts`)
- [x] `cd backend && yarn codegen`
- [x] Frontend: add to `SovereigntyDashboard` op + codegen
- [x] Frontend: "Hottest Regions" bar-list section on dashboard
- [x] Verify (GraphiQL + UI)

### Feature 2 — Alliance Rankings Enrichment
- [x] Backend: extend `AllianceTerritoryRank` (attacking/defending/gained/lost)
- [x] Backend: `AllianceActivityRank` + `mostAggressiveAlliances` / `mostDefensiveAlliances`
- [x] Backend: `latestTerritoryStats(allianceIds)` helper + merge into rankings resolver
- [x] `cd backend && yarn codegen`
- [x] Frontend: extend rankings op + 2 leaderboard sections + hottest-regions + codegen
- [x] Verify

### Feature 3 — Campaign Participants
- [x] Backend: `CampaignParticipant` type + `participants` field on `SovereigntyCampaign`
- [x] Backend: batch-fetch participants in `sovereigntyActiveCampaigns`
- [x] `cd backend && yarn codegen`
- [x] Frontend: expandable campaign row + nested participant list + codegen
- [x] Verify

### Feature 1 — Structure & Timer Dashboard
- [x] Backend: `SovereigntyStructureInfo` type + `sovereigntyStructures` + `sovereigntyUpcomingTimers`
- [x] Backend: `enrichStructures` (reuse `resolveRegions`) + type-name map (IHub/TCU)
- [x] `cd backend && yarn codegen`
- [x] Frontend: `SovereigntyStructures.graphql` op + codegen
- [x] Frontend: new route `app/sovereignty/structures/page.tsx` (Timers + All Structures)
- [x] Frontend: `TimerCountdown` component (setInterval + `formatRelativeTime`)
- [x] Frontend: convert `SOVEREIGNTY` nav to dropdown (Overview / Structures & Timers), desktop + mobile
- [x] Verify

### Feature 4 — Killmail War-Kill Surfacing (highest risk — last)
- [x] Decision: keep `warRelated` OUT of `hasKillmailFiltersCompatibleFilter` (cheaper plain path when sole filter); handled in both paths regardless
- [x] Backend: `isWarRelated` on `Killmail` type; `warRelated` on `KillmailFilter` input
- [x] Backend: wire both query paths (materialized raw-SQL + plain-Prisma) + single `killmail()` + subscription + safety field resolver
- [x] `cd backend && yarn codegen`
- [x] Frontend: `isWarRelated` in all 4 shared ops + `Killmail.graphql` + subscription op + codegen
- [x] Frontend: WAR KILL badge (`KillmailRow.tsx` + detail page)
- [x] Frontend: filter plumbing (`filterUrlHelpers`, `KillmailFilters`, `killmails/page.tsx`)
- [x] Verify (all 4 killmail tabs + filter + detail)

### Cluster A wrap-up
- [x] Full manual/runtime pass across all 5 features (browser + GraphQL)
- [x] `/code-review` on the diff (high, workflow-backed) — 5 findings, all fixed & verified:
  - [x] killmail materialized COUNT now includes date conditions (fixed pre-existing overcount)
  - [x] `killmailsDateCounts` now applies `warRelated` in both branches (was full-table scan)
  - [x] `TimerCountdown` is a real H:MM:SS second-by-second countdown
  - [x] `enrichStructures` runs systemInfo/allianceNames concurrently (Promise.all)
  - [x] aggressive/defensive resolvers collapsed into shared `activityLeaderboard` helper
- [x] Commit + push (15acd8a initial, + review-fixes commit)

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
