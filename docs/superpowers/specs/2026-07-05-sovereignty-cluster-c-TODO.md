# Sovereignty Cluster C — Progress Tracker

Companion to `2026-07-05-sovereignty-cluster-c-design.md`.
`[ ]` todo · `[~]` in progress · `[x]` done.

**Scope this cycle:** C1 (conflict hot-zones). Deferred: C2 (interactive map), C3 (notifications).

---

## C1 — Conflict hot-zones
- [x] Backend: `ConflictHotspot` type + `conflictHotspots(limit)` query (`Sovereignty.graphql`)
- [x] Backend: resolver — aggregate active campaigns + combat stats by region, intensityScore
- [x] `cd backend && yarn codegen`
- [x] Frontend: `ConflictHotspots.graphql` op + codegen
- [x] Frontend: `components/Sovereignty/ConflictTreemap.tsx` (ECharts, next/dynamic ssr:false)
- [x] Frontend: page `app/sovereignty/hotspots/page.tsx` (treemap + ranked table)
- [x] Nav: 4th dropdown item "Hot Zones" (desktop + mobile) + dashboard header link
- [x] Verify (GraphQL + browser)

## Wrap-up
- [ ] `/code-review`
- [ ] Commit + push
