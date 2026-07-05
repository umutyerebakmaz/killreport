# Sovereignty Cluster C — Conflict Hot-Zones (Design)

**Date:** 2026-07-05
**Branch:** `feature/sov`
**Status:** Design — awaiting user review
**Parent:** `2026-07-05-sovereignty-remaining-features-design.md` (Cluster C)
**Depends on:** Clusters A + B (shipped)

---

## 1. Scope of this cycle

Cluster C in the parent spec is "big new subsystems: interactive territory map, hot-zone
heatmap, notification/alert pipeline." Those are three independent subsystems with very
different risk. An infra scan settled the scoping:

| Piece | Infra reality | This cycle |
|---|---|---|
| **C1 — Conflict hot-zones** | Data ready (campaigns + correlated war kills). ECharts already installed. No new dep, no auth, no migration. | **In scope** |
| **C2 — Interactive territory map** | Coordinates (`position_x/y/z`) + `SovereigntyMapCurrent` ownership already in GraphQL; ECharts can render it. But 8000+ systems = real rendering/perf/UX work (projection, zoom, filtering). | Deferred → own spec |
| **C3 — War alerts/notifications** | EVE SSO + `User` model exist; real-time PubSub (SSE) + Redis queue reusable. But per-user watchlist table, **outbound delivery (email/Discord/webhook) is entirely net-new**, and `User.email` is nullable/unverified. | Deferred → own spec |

**This cycle = C1 only.** It is the buildable, low-risk, high-value slice: it turns the
existing "Hottest Regions" bar (Cluster A) into a real conflict-intensity analysis, on data
that already exists, using the ECharts library already in the app.

**Data reality (local, 2026-07-05):** 35 active campaigns across 12 constellations; correlated
war kills/ISK present; `system_kills` table empty and `territory_changes` empty locally. So C1
rests on the three populated signals — **active campaigns, war kills, ISK destroyed per
region** — which are verifiable now. `system_kills` (live PvP intensity) and territory-change
volatility are noted as future score inputs once those workers populate.

---

## 2. C1 — Conflict Hot-Zones

### 2.1 Backend

One query, aggregating active sovereignty campaigns + their combat stats up to the region level
(region derived via system → constellation → region, reusing `resolveRegions`).

```graphql
type ConflictHotspot {
  regionId: Int!
  regionName: String
  activeCampaigns: Int!
  warKills: Int!
  iskDestroyed: Float!
  "Composite conflict-intensity score (heuristic, tunable)."
  intensityScore: Float!
}

extend type Query {
  "Regions ranked by sovereignty conflict intensity, hottest first."
  conflictHotspots(limit: Int): [ConflictHotspot!]!
}
```

Resolver (`resolvers/sovereignty/queries.ts`): fetch active campaigns (id, solar_system_id),
`resolveRegions`, fetch `campaignCombatStats` for those campaigns, then aggregate per region:
`activeCampaigns` (count), `warKills` (sum), `iskDestroyed` (sum). Compute
`intensityScore = activeCampaigns * 3 + warKills` (documented heuristic; ISK is shown but kept
out of the score because its range would dominate). Sort by `intensityScore` desc, take `limit`.
No migration, no Redis cache (consistent with the other sov resolvers).

### 2.2 Frontend — `/sovereignty/hotspots`

New route `app/sovereignty/hotspots/page.tsx` (same `"use client"` + Suspense + Loader shape),
new op `ConflictHotspots.graphql` → `useConflictHotspotsQuery`. Two views:

1. **Treemap (ECharts)** — regions as rectangles sized by `intensityScore`, tooltip showing all
   metrics. Built with `echarts` + `echarts-for-react` via `next/dynamic({ ssr: false })`, the
   exact pattern of `AllianceGrowthChart`/`CorporationGrowthChart`. Wrap in a new
   `components/Sovereignty/ConflictTreemap.tsx`. Dark-theme option object matching the app.
2. **Ranked table** — Region (link to `/regions/{id}`), Active Campaigns, War Kills,
   ISK Destroyed, Intensity. Reuses the standard `.table` / `.th-cell` classes.

**Nav:** add a 4th SOVEREIGNTY dropdown item "Hot Zones" (desktop + mobile) and a header link on
the dashboard, alongside Structures & Timers / History.

### 2.3 Verification

GraphQL: `conflictHotspots` returns regions ranked by intensity (locally: Kalevala Expanse
highest, etc.). Browser: treemap renders region rectangles + the table matches. Sparse-but-
correct locally (war kills small); shape/correctness verified, not volume.

---

## 3. Conventions & build sequence

Follows the Cluster A conventions reference (parent spec §5). Build order: (1) `conflictHotspots`
query + schema + `yarn codegen`; (2) `ConflictHotspots.graphql` + `yarn codegen`;
(3) `ConflictTreemap` component (ECharts) + `/sovereignty/hotspots` page + nav; (4) verify
(GraphQL + browser) + `/code-review`. **No migration.**

## 4. Decisions made (user was away — flagged for review, adjust anytime)

1. **Cluster C scoped to C1 (conflict hot-zones) this cycle**; C2 (interactive map) and C3
   (notifications) deferred to their own specs, for the infra reasons in §1.
2. **Intensity heuristic:** `activeCampaigns * 3 + warKills` — a transparent, tunable starting
   score; ISK shown in the table but excluded from the score (range dominance).
3. **Visualization:** ECharts **treemap** (already-installed lib, no new dep) + a ranked table,
   on a dedicated `/sovereignty/hotspots` page with a 4th nav item.
4. **Score inputs limited to populated signals** (campaigns + war kills); `system_kills` live-PvP
   intensity and territory-change volatility deferred until those tables populate.

If any of these is wrong, say so and I'll adjust — they're isolated.
