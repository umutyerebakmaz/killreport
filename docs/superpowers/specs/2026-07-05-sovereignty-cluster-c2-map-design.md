# Sovereignty Cluster C2 — Interactive Territory Map (Design)

**Date:** 2026-07-05
**Branch:** `feature/sov`
**Status:** Design — awaiting user review
**Parent:** `2026-07-05-sovereignty-remaining-features-design.md` (Cluster C)
**Depends on:** Clusters A + B + C1 (shipped)

---

## 1. What this is

A 2D territory map of null-sec sovereignty: every sov-held solar system plotted at its real
galactic position and colored by the alliance that controls it — the color-coded "who owns what"
view from the parent roadmap (Cluster C, C2).

### Data reality (verified locally, 2026-07-05)

- `SovereigntyMapCurrent`: **5383 owned systems**, **5330 have coordinates** (`position_x/z` on
  `SolarSystem`), **2712 have an `alliance_id`** (the rest are corp/faction-held), **76 distinct
  owning alliances**.
- Coordinates are galactic meters (~±8e18); a 2D map projects **(x, z)** and normalizes to
  light-years for sane numbers. The y-axis (galactic height) is dropped.
- **No stargate / jump / adjacency data exists** in the schema — so the map is a **colored
  point scatter**, NOT a stargate-linked starmap. Connection lines are out of scope (no data).
- Coordinates + ownership are already exposed/available; **no migration** is needed.

---

## 2. Approach

**Chosen: ECharts scatter over projected coordinates, colored by alliance.** ECharts (already
installed, used by C1's treemap and the growth charts) renders 5k points comfortably with
`large: true`, and gives pan/zoom (`dataZoom`), a clickable legend, and hover tooltips for free —
no new dependency, no canvas/WebGL hand-rolling.

Rejected alternatives: a hand-built SVG/canvas starmap (more code, worse perf, no free
zoom/legend), and a geographic map lib like leaflet/mapbox (wrong domain — EVE space isn't
lat/long, and it'd be a new dependency).

### Coloring

76 alliances is too many for distinct colors. Compute the **top N (~15) alliances by systems
controlled**, assign each a palette color, and bucket everything else into **"Other"** (a muted
gray). A legend lists the top N with their colors; alliance-less owned systems (corp/faction)
render as a dim neutral background layer for context. (Palette: reuse the app's chart colors;
follow the `dataviz` skill's guidance when picking the categorical set.)

---

## 3. Backend

One query returning the plottable points (optionally scoped to a region for a zoomed view).

```graphql
type SovMapPoint {
  systemId: Int!
  systemName: String
  x: Float!          # normalized (light-years), projected galactic x
  y: Float!          # normalized projected galactic z (2D vertical)
  allianceId: Int
  allianceName: String
  allianceTicker: String
  regionName: String
}

extend type Query {
  "Sov-held systems with coordinates, for the territory map. Optional region filter."
  sovereigntyMapPoints(regionId: Int): [SovMapPoint!]!
}
```

Resolver (`resolvers/sovereignty/queries.ts`): join `SovereigntyMapCurrent` → `SolarSystem`
(coords, constellation) for owned systems with non-null coords; enrich alliance names
(`allianceNames`) and region names (`resolveRegionsForSystems`). Normalize coords by dividing by
one light-year (9.4607e15). Optional `regionId` filters to one region. No Redis cache (consistent
with the other sov resolvers); payload is ~5k small objects (a few hundred KB) — acceptable, and
the region filter keeps zoomed views small.

## 4. Frontend — `/sovereignty/map`

New route `app/sovereignty/map/page.tsx` (`"use client"` + Suspense + Loader), op
`SovereigntyMap.graphql` → `useSovereigntyMapQuery`, and a `components/Sovereignty/
TerritoryMap.tsx` ECharts scatter (`next/dynamic`, `ssr:false`).

- **Series:** one scatter series per legend bucket (top-N alliances + "Other" + a dim
  "unclaimed-by-alliance" layer), so the legend toggles alliances on/off. Small symbols
  (`symbolSize ~4`), `large: true`, hidden axes/grid (a starmap has no meaningful axes),
  dark background.
- **Interaction:** `dataZoom` (inside) for pan/zoom, tooltip on hover showing system / region /
  alliance, legend click to isolate an alliance's territory.
- **Region filter:** a `<select>` of regions (derived from the points or a small regions query)
  that refetches `sovereigntyMapPoints(regionId)` for a focused view; default = whole map.
- **Nav:** 5th SOVEREIGNTY dropdown item "Map" (desktop + mobile) + a dashboard header link.

## 5. Verification

GraphQL: `sovereigntyMapPoints` returns ~5330 points (locally) with coords + alliance/region
names, and far fewer when `regionId` is set. Browser (`npx playwright screenshot`): the map
renders as a recognizable galaxy scatter with distinct alliance color clusters, a working legend,
and tooltips; the region filter narrows it. Verify shape/interaction, not pixel-perfection.

## 6. Conventions & build order

Follows the Cluster A conventions reference. Order: (1) `sovereigntyMapPoints` query + schema +
`yarn codegen`; (2) `SovereigntyMap.graphql` + `yarn codegen`; (3) `TerritoryMap` ECharts
component; (4) `/sovereignty/map` page + region filter + nav; (5) verify + `/code-review`.
**No migration.**

## 7. Decisions made (user chose C2; sub-decisions on best judgment — flag for review)

1. **Point scatter, not a linked starmap** — forced by the absence of stargate/adjacency data.
2. **ECharts scatter** (installed, no new dep) with built-in zoom/legend/tooltip.
3. **Coloring:** top ~15 alliances by systems held get distinct colors; the rest = "Other"
   (gray); corp/faction-only systems = dim background layer.
4. **Scope:** whole-map default + optional per-region filter for a zoomed view. Stargate lines,
   ownership-over-time animation (Cluster B multi-day), and drill-to-system are out of scope.
5. **No migration** — coordinates + ownership already exist.

If any of these is wrong (e.g. you want region-only, or a different color strategy), say so and
I'll adjust before/after implementing.
