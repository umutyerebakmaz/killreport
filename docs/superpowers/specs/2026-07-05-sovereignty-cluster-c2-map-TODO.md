# Sovereignty Cluster C2 — Territory Map — Progress Tracker

Companion to `2026-07-05-sovereignty-cluster-c2-map-design.md`.
`[ ]` todo · `[~]` in progress · `[x]` done.

**Scope:** 2D alliance-colored territory scatter (ECharts) with region filter. No stargate lines
(no adjacency data), no migration.

---

## C2 — Territory map
- [x] Backend: `SovMapPoint` type + `sovereigntyMapPoints(regionId)` query (`Sovereignty.graphql`)
- [x] Backend: resolver — join map_current + solar_systems (coords), enrich alliance/region, normalize coords to light-years
- [x] `cd backend && yarn codegen`
- [x] Frontend: `SovereigntyMap.graphql` op + codegen
- [x] Frontend: `components/Sovereignty/TerritoryMap.tsx` (ECharts scatter, top-N alliance coloring + Other, zoom/legend/tooltip) — use dataviz palette
- [x] Frontend: page `app/sovereignty/map/page.tsx` (map + region filter)
- [x] Nav: 5th dropdown item "Map" (desktop + mobile) + dashboard header link
- [x] Verify (GraphQL + browser)

## Wrap-up
- [ ] `/code-review`
- [ ] Commit + push
