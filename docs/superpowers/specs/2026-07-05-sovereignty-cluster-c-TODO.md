# Sovereignty Cluster C — Progress Tracker

Companion to `2026-07-05-sovereignty-cluster-c-design.md`.
`[ ]` todo · `[~]` in progress · `[x]` done.

**Scope this cycle:** C1 (conflict hot-zones). Deferred: C2 (interactive map), C3 (notifications).

---

## C1 — Conflict hot-zones
- [ ] Backend: `ConflictHotspot` type + `conflictHotspots(limit)` query (`Sovereignty.graphql`)
- [ ] Backend: resolver — aggregate active campaigns + combat stats by region, intensityScore
- [ ] `cd backend && yarn codegen`
- [ ] Frontend: `ConflictHotspots.graphql` op + codegen
- [ ] Frontend: `components/Sovereignty/ConflictTreemap.tsx` (ECharts, next/dynamic ssr:false)
- [ ] Frontend: page `app/sovereignty/hotspots/page.tsx` (treemap + ranked table)
- [ ] Nav: 4th dropdown item "Hot Zones" (desktop + mobile) + dashboard header link
- [ ] Verify (GraphQL + browser)

## Wrap-up
- [ ] `/code-review`
- [ ] Commit + push
