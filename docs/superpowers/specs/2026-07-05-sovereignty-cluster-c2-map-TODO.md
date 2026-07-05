# Sovereignty Cluster C2 — Territory Map — Progress Tracker

Companion to `2026-07-05-sovereignty-cluster-c2-map-design.md`.
`[ ]` todo · `[~]` in progress · `[x]` done.

**Scope:** 2D alliance-colored territory scatter (ECharts) with region filter. No stargate lines
(no adjacency data), no migration.

---

## C2 — Territory map
- [ ] Backend: `SovMapPoint` type + `sovereigntyMapPoints(regionId)` query (`Sovereignty.graphql`)
- [ ] Backend: resolver — join map_current + solar_systems (coords), enrich alliance/region, normalize coords to light-years
- [ ] `cd backend && yarn codegen`
- [ ] Frontend: `SovereigntyMap.graphql` op + codegen
- [ ] Frontend: `components/Sovereignty/TerritoryMap.tsx` (ECharts scatter, top-N alliance coloring + Other, zoom/legend/tooltip) — use dataviz palette
- [ ] Frontend: page `app/sovereignty/map/page.tsx` (map + region filter)
- [ ] Nav: 5th dropdown item "Map" (desktop + mobile) + dashboard header link
- [ ] Verify (GraphQL + browser)

## Wrap-up
- [ ] `/code-review`
- [ ] Commit + push
