# Solar System Detail Page Improvements — Design

Date: 2026-08-27
Status: Draft — awaiting review
Scope: `frontend/src/app/solar-systems/[id]/page.tsx` and its supporting GraphQL layer

## 1. Context

The solar system detail page is the deepest node in the spatial hierarchy
(Region → Constellation → Solar System). It is reachable from the killmail
table, the sovereignty map, the systems list and every breadcrumb on the site,
which makes it one of the most-linked pages in the app. Today it renders two
tabs:

- **Attributes** — three cards: System Information (system ID, security status,
  star ID), Location Hierarchy (region → constellation → system links) and
  Position in Space (raw x/y/z coordinates in exponential notation).
- **Killmails** — a paginated `KillmailsTable` plus a four-card sidebar
  (`TopCharacterCard`, `TopCorporationCard`, `TopAllianceCard`, `TopShipsCard`),
  all scoped to the last 7 days for this system.

The page header shows the system name, a `SecurityBadge`, links to the parent
constellation and region, and a one-line `latestKills` summary (ship / pod / NPC
kills with a relative timestamp).

The whole page is a single 572-line client component.

## 2. Problems

**P1 — The default tab is the emptiest one.** `Attributes` is what a visitor
lands on, and it shows almost nothing actionable: `System ID` and `Star ID` are
raw ESI identifiers with no meaning to a player, and the x/y/z coordinates are
printed as `-1.2345e+17` metres, which no reader can use. The Location Hierarchy
card repeats links that already exist in the breadcrumb and the header.

**P2 — Data that already exists in the backend is not shown.** Two capabilities
are fully implemented server-side and never queried by the frontend:

- `systemKillsHistory(filter: { system_id, hours })` returns hourly ship / pod /
  NPC kill snapshots from the `system_kills` table
  (`backend/src/resolvers/system-kills/queries.ts:9`). The frontend only reads
  the single latest row via `latestKills`.
- `sovereigntyStructures(systemId:)` returns the holding alliance, the ADM
  proxy (`occupancyLevel`) and the vulnerability window for TCU/IHub structures
  in a system (`backend/src/schemas/Sovereignty.graphql:214`). Nothing on the
  system page mentions sovereignty at all, even though sovereignty is a
  first-class feature elsewhere in the app.

**P3 — No system-level aggregate stats.** The page can tell you what happened in
the last 7 days and what the last killmail was, but not the totals that make a
system page worth bookmarking: lifetime kills, ISK destroyed, activity in the
last 24 hours, or when the system is busiest.

**P4 — URL sync effect writes on every render.** The effect at
`frontend/src/app/solar-systems/[id]/page.tsx:128-137` depends on `router`,
which Next.js does not guarantee to be referentially stable, and calls
`router.push` unconditionally — including on first mount, which pushes a
redundant history entry before the user has interacted with anything. The same
pattern was just reverted from the killmails page; it should not be re-created
here.

**P5 — Tab switching does not reset pagination.** `activeTab` and `currentPage`
are independent state. Going to page 7 of Killmails, switching to Attributes and
back leaves `page=7` in the URL and in state, but the tab reads as freshly
opened.

**P6 — The four-card "top entities" sidebar is copy-pasted.** The same block —
four `Top*Card` components, each with a `Last 7 days` + `ROLLING` badge
subtitle, each mapping a leaderboard row into card props — appears in
`solar-systems/[id]/page.tsx`, `killmails/page.tsx`, `alliances/[id]/page.tsx`
and `corporations/[id]/page.tsx`, with the mapping logic duplicated each time.

**P7 — The detail query lives in the wrong file.** The `SolarSystem($id:)` query
is defined inside `frontend/src/graphql/SolarSystems.graphql`. Every other
entity in the repo splits these (`Alliance.graphql` / `Alliances.graphql`,
`Corporation.graphql` / `Corporations.graphql`, `Region.graphql` /
`Regions.graphql`).

## 3. Goals

1. Make the landing tab worth reading: aggregate stats, an activity chart, and
   sovereignty state, instead of raw identifiers.
2. Surface `systemKillsHistory` and `sovereigntyStructures`, which already
   exist, before building anything new.
3. Add exactly one new backend query, for the aggregate stats that cannot be
   derived from what already ships.
4. Fix P4–P7 as part of the work, not as a follow-up.

## Non-goals

- No new ESI ingestion. Stargates / adjacent systems, planets, moons, stations
  and NPC faction ownership are **not** in the database
  (`backend/prisma/schema/solarSystem.prisma` has id, name, constellation_id,
  security_status, security_class, star_id, position x/y/z and nothing else).
  Adding them means a new worker, a new table and a full backfill — a separate
  project.
- No redesign of `KillmailsTable`, `Paginator` or the `Top*Card` components
  themselves. This work reuses them.
- No change to the sovereignty ingestion workers.

## 4. Assumptions

These decisions were made without a requirements conversation. Each one is a
place to push back before implementation starts.

- **A1** — "Improvements" means content depth first, layout second, technical
  debt third. The plan is ordered that way and each phase ships independently.
- **A2** — The two-tab structure stays, but `Attributes` is replaced by
  `Overview`. Three tabs (Overview / Sovereignty / Killmails) would leave the
  sovereignty tab empty for every high-sec and low-sec system, which is most of
  New Eden.
- **A3** — Raw identifiers (`System ID`, `Star ID`, exponential coordinates)
  stay on the page but move into a collapsed "Technical details" block at the
  bottom of Overview. They are useful to developers and API users, and removing
  them outright is a loss for that audience.
- **A4** — "Busiest hour" is computed over the last 7 days in UTC, because EVE
  Online timers and the rest of the app are UTC-based.
- **A5** — ISK-destroyed totals are read from `killmails.total_value`. Killmails
  whose value has not been backfilled yet count as 0 rather than being excluded,
  matching how `KillmailOrderBy.ValueDesc` already behaves elsewhere.

## 5. Approaches considered

**Option A — Frontend-only.** Consume `systemKillsHistory` and
`sovereigntyStructures`, restructure the tabs, skip aggregate stats entirely.
Cheapest, ships in one pass, no migration. But P3 goes unaddressed, and the
totals are exactly what makes a system page linkable.

**Option B — Frontend + one new stats query (recommended).** Everything in
Option A, plus a single `solarSystemStats(systemId:)` query backed by a cached
raw SQL aggregate, and one optional `systemId` argument added to
`sovereigntyActiveCampaigns`. One new type, one new resolver, no schema
migration.

**Option C — Full system profile.** Option B plus a new `system_stats` rollup
table maintained by a worker, plus ESI ingestion for stargates so the page can
show adjacent systems and jump routes. This is the version that competes with
zKillboard's system page, but it is a multi-week project with a backfill,
a new worker in `ecosystem.config.js`, and its own operational risk.

**Chosen: Option B.** It closes every problem listed in section 2 at a cost
proportional to the payoff. Option C's distinguishing feature — the stargate
graph — is a coherent second project that this design deliberately leaves
standing on its own.

## 6. Design

### 6.1 Page structure

```
Breadcrumb (unchanged)
Header
  ├─ security-tinted icon, system name, SecurityBadge
  ├─ constellation / region links
  ├─ sovereignty holder chip           ← new, rendered only when sov-held
  └─ latestKills summary (unchanged)
Stats strip                            ← new: 4 tiles, always visible above the tabs
Tabs: [ Overview | Killmails ]
  Overview
    ├─ SystemActivityChart             ← new, full width
    ├─ SolarSystemSovereigntyPanel     ← new, only when the system is sov-held
    └─ Technical details (collapsed)   ← reworked from the old Attributes cards
  Killmails
    └─ unchanged: table + Paginator + TopEntitySidebar
```

The stats strip sits **above** the tab bar so the headline numbers survive tab
switching. Tiles: `Total kills`, `ISK destroyed`, `Kills (24h)`, `Busiest hour
(UTC)`.

### 6.2 Backend changes

**New query.** `backend/src/schemas/SolarSystem.graphql`:

```graphql
"""
Aggregate kill statistics for a single solar system.
"""
type SolarSystemStats {
  systemId: Int!
  "All killmails ever recorded in this system."
  totalKills: Int!
  "Sum of killmails.total_value over all recorded kills; unvalued kills count as 0."
  totalIskDestroyed: Float!
  kills24h: Int!
  kills7d: Int!
  iskDestroyed7d: Float!
  "Timestamp of the most recent killmail, or null if the system has none."
  lastKillTime: String
  "UTC hour (0-23) with the most kills over the last 7 days; null when there are none."
  busiestHourUtc: Int
}

extend type Query {
  solarSystemStats(systemId: Int!): SolarSystemStats!
}
```

Resolver: `backend/src/resolvers/solar-system/queries.ts`, following the
`topLast7DaysPilots` pattern at `backend/src/resolvers/leaderboard/queries.ts:140`
— `prisma.$queryRaw` against `killmails`, Redis-cached under
`solarSystemStats:{systemId}` with a 300-second TTL. Two statements: one
lifetime aggregate, one 7-day aggregate grouped by
`EXTRACT(HOUR FROM killmail_time)`.

`killmail_filters` is deliberately **not** used here: it carries no
`total_value` column (see
`backend/prisma/migrations/20260215010000_add_killmail_filters_materialized_view/migration.sql`),
so the ISK sums have to come from `killmails` directly.

**Index.** `killmails` today has single-column indexes on `solar_system_id`
and `killmail_time` (`backend/prisma/schema/killmail.prisma:19-20`) but no
composite. The lifetime aggregate is served fine by `solar_system_id` alone; the
7-day and 24-hour aggregates filter on both columns and will need
`@@index([solar_system_id, killmail_time])` plus a migration. Confirm with
`EXPLAIN ANALYZE` against production-shaped data before merging — on a system
like Jita the difference is a bitmap heap scan over hundreds of thousands of
rows versus an index range scan.

**One argument added.** `sovereigntyActiveCampaigns(limit: Int)` gains an
optional `systemId: Int`, filtering on `solarSystemId` in the existing
resolver's where clause. No new type.

### 6.3 New frontend components

| File | Responsibility |
|------|----------------|
| `components/SystemActivityChart/SystemActivityChart.tsx` | ECharts line chart of hourly ship / pod / NPC kills, with a 24h / 7d range toggle. Mirrors `AllianceGrowthChart` exactly: `next/dynamic` import of `echarts-for-react` with `ssr: false`, range state, `useMemo` series derivation. |
| `components/SolarSystemDetail/SystemStatsStrip.tsx` | Four presentational stat tiles. Takes a `SolarSystemStatsQuery` result plus `loading`; renders skeletons while loading. |
| `components/SolarSystemDetail/SolarSystemSovereigntyPanel.tsx` | Holding alliance (linked), structure type, ADM (`occupancyLevel`), vulnerability window, and any active campaign in this system. Renders nothing when the system holds no sovereignty structures. |
| `components/SolarSystemDetail/SystemTechnicalDetails.tsx` | Collapsed `<details>` block: system ID, star ID, `security_class`, exact security status, and x/y/z shown both in exponential metres and converted to AU. |
| `components/TopEntitySidebar/TopEntitySidebar.tsx` | The four-card leaderboard sidebar, extracted once. Props: a location filter (`{ systemId }` / `{ regionId }` / `{ constellationId }` / none), and it runs the four `topLast7Days*` queries itself. |

### 6.4 Refactors

- **P4** — Replace the URL-sync effect with explicit handlers. State changes and
  the corresponding `router.replace` happen in the same callback
  (`handleTabChange`, `goToPage`, `handlePageSizeChange`); no effect writes to
  the URL. `replace` rather than `push`, so tab switching does not fill the back
  button with intermediate states.
- **P5** — `handleTabChange` resets `currentPage` to 1.
- **P6** — All four call sites adopt `TopEntitySidebar`. This is where most of
  the net line reduction comes from.
- **P7** — Move the `SolarSystem($id:)` document into a new
  `frontend/src/graphql/SolarSystem.graphql`, leaving the list query in
  `SolarSystems.graphql`. Add `security_class` to the detail query's selection
  set; it is already on the type and already ingested.
- The page component shrinks to a shell: parse params, run the detail query,
  own tab state, render header + stats strip + the active tab. Target under 200
  lines, with `OverviewTab` and `KillmailsTab` as siblings under
  `components/SolarSystemDetail/`.

### 6.5 New GraphQL documents

- `frontend/src/graphql/SolarSystem.graphql` — detail query (moved, extended).
- `frontend/src/graphql/SolarSystemStats.graphql` — new stats query.
- `frontend/src/graphql/SystemKillsHistory.graphql` — new, for the chart.
- `frontend/src/graphql/SolarSystemSovereignty.graphql` — `sovereigntyStructures(systemId:)`
  and `sovereigntyActiveCampaigns(systemId:)` in one document, so the panel
  issues a single request.

Both workspaces run `yarn codegen` after every `.graphql` change; the generated
`frontend/src/generated/graphql.ts` is committed as it is today.

## 7. Data flow

```
page.tsx
  ├─ useSolarSystemQuery({ id })                    → header, technical details
  ├─ useSolarSystemStatsQuery({ systemId })         → stats strip
  └─ Overview tab (mounted)
       ├─ useSystemKillsHistoryQuery({ system_id, hours })  → activity chart
       └─ useSolarSystemSovereigntyQuery({ systemId })      → sovereignty panel
  └─ Killmails tab (mounted)
       ├─ useKillmailsQuery({ systemId, page, limit })
       ├─ useKillmailsDateCountsQuery({ systemId })
       └─ TopEntitySidebar → four topLast7Days* queries
```

Per-tab queries keep their `skip: activeTab !== "..."` guards, which the page
already does correctly. The stats strip is not skipped, because it renders above
the tabs.

## 8. Loading, empty and error states

- **Stats strip** — skeleton tiles while loading. A system with no killmails
  shows zeros, not an empty state; zero kills is a real, meaningful answer.
- **Activity chart** — reuses the existing chart loading treatment. When
  `systemKillsHistory` returns an empty array, the chart is replaced by
  "No kill activity recorded in this window", because an axis with no series
  reads as broken.
- **Sovereignty panel** — renders nothing at all when the system holds no sov
  structures. High-sec systems must not show an empty sovereignty card.
- **Errors** — the top-level system query keeps the existing full-page error.
  A failure in the stats, chart or sovereignty query degrades that section only;
  the rest of the page still renders. These are supplementary panels, and one
  failing Redis lookup should not blank out the killmail table.

## 9. Verification

The repository has no test runner and no test files in either workspace. This
design does not introduce one; that is its own decision and its own piece of
work. Verification is therefore:

- `yarn workspace backend build` — `tsc --noEmit`, must pass.
- `yarn workspace frontend lint` and `yarn workspace frontend build`, must pass.
- `yarn workspace backend codegen` / `yarn workspace frontend codegen` produce a
  clean tree with no unexpected diff.
- Manual checks against a running stack, on four systems chosen to cover the
  branches: a sov-held null-sec system with an active campaign, a null-sec
  system with no campaign, Jita (high volume, no sovereignty), and a system with
  zero recorded killmails.
- `EXPLAIN ANALYZE` on the two stats statements against the production-shaped
  database, confirming index use before merge.

## 10. Risks

- **R1 — Stats query cost on high-volume systems.** Mitigated by the 300-second
  Redis cache and the index check. If a lifetime aggregate over Jita is still
  slow after indexing, the fallback is to drop `totalKills` / `totalIskDestroyed`
  to a rollup table, which promotes this piece to Option C's design.
- **R2 — `system_kills` coverage.** The chart is only as good as
  `worker:system-kills`. If snapshots are sparse or have gaps, the chart will
  show them. Confirm the retention window and cadence of the `system_kills`
  table before choosing the 7-day range; if retention is shorter, the range
  toggle ships as 24h only.
- **R3 — `TopEntitySidebar` extraction touches four pages.** The mappings are
  near-identical but not identical across call sites. Extraction happens in its
  own phase, after the solar-system work is verified, so a regression there
  cannot be confused with a regression in the new panels.

## 11. Out of scope

Adjacent systems and jump routes, planets / moons / stations, NPC faction
ownership, a system-level realtime killmail subscription, and any rollup table
for system statistics.
