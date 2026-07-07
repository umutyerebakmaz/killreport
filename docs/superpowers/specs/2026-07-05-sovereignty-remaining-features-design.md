# Sovereignty — Remaining Features Design

**Date:** 2026-07-05
**Branch:** `feature/sov`
**Status:** Design — awaiting user review
**Source of truth for scope:** `backend/docs/features/SOVEREIGNTY_FEATURES_TR.md` (6-phase roadmap)

---

## 1. Context & problem

Phase 1 (data pipeline) and most of Phases 2–3 (GraphQL API + dashboard + killmail↔campaign
correlation) are already built and verified on `feature/sov`. An inventory pass (three
exploration agents cross-referenced against the roadmap doc) found that a large amount of
data is **already collected and stored** but never surfaced through the API or UI, plus
several genuinely-missing subsystems.

"Implement all remaining features" is **too large for a single spec** — the gaps span 5–6
independent subsystems (a map renderer, a notification pipeline, ML prediction, historical
analytics, a monetization layer). This document decomposes the remaining work into four
clusters and specifies **Cluster A** (the first implementation slice) in full. Clusters B/C/D
are sketched here and get their own spec → plan → implementation cycle later.

### What already exists (do not rebuild)

- 8 Prisma models populated by 5 cron workers (campaigns, map, structures, snapshot, correlate).
- 4 GraphQL queries: `sovereigntyOverview`, `sovereigntyActiveCampaigns`,
  `allianceTerritoryRankings`, `recentTerritoryChanges`.
- 1 dashboard page `/sovereignty` (overview cards, rankings, active campaigns, territory changes).
- `Killmail.is_war_related` / `related_campaign_id` set by the correlate worker.

### Data that is collected but NOT surfaced (the Cluster A opportunity)

| Data (already in DB) | Populated by | Not exposed in |
|---|---|---|
| `SovereigntyStructure` (owner, type, occupancy, vuln window) | `worker-sovereignty-structures` | API + UI (only a count) |
| `CampaignParticipant` (alliance + score per campaign) | `worker-sovereignty-campaigns` | API + UI |
| `AllianceTerritoryStats` (campaigns_attacking/defending, systems_gained/lost) | `worker-sovereignty-snapshot` | API + UI |
| `Killmail.is_war_related` | `worker-sovereignty-correlate` | killmail UI (badge/filter) |

---

## 2. Scope decomposition

| Cluster | Theme | Effort | This spec |
|---|---|---|---|
| **A** | Data-ready quick wins (API + UI only, ~no new DB writes) | Low | **Fully specified below** |
| **B** | New backend logic: campaign `outcome`, win rates, historical analytics, per-alliance combat split | Medium | Sketched → own spec later |
| **C** | Big new subsystems: interactive territory map, hot-zone heatmap, notification/alert pipeline | High | Sketched → own spec later |
| **D** | Product/business layer: premium tiers, payments, mobile app, Discord bot, public API | High | Out of scope for now |

**Execution order:** A → B → C. D deferred. Each cluster is approved before it starts.

---

## 3. Cluster A — detailed design (first implementation slice)

Five features. All follow existing conventions exactly (see §5). No new DB migrations for
1/2/3/5; Feature 4 adds two schema fields but **no** table/column changes (the columns already
exist and are indexed).

### Prep step (do first)

Extract the inline `AllianceLink` and `ScoreBar` helpers from
`frontend/src/app/sovereignty/page.tsx` into shared files under
`frontend/src/components/Sovereignty/` (`AllianceLink.tsx`, `ScoreBar.tsx`), and update the
existing page to import them. Features 1 and 3 both reuse these.

### Feature 1 — Structure & Timer Dashboard

New route `/sovereignty/structures` with two sections: "Next 24h Timers" (sorted by upcoming
`vulnerable_start_time`, live countdown) and "All Structures" (owner, system/region, type
badge IHub/TCU, occupancy %, vuln window).

- **Backend:** new type `SovereigntyStructureInfo`; queries
  `sovereigntyStructures(allianceId, systemId, limit)` and
  `sovereigntyUpcomingTimers(hoursAhead, limit)` in `Sovereignty.graphql` + `queries.ts`.
  Batch-enrich system/region/alliance names via the existing helper pattern; add a shared
  `regionForSystems(systemIds)` helper (also reused by Feature 5).
  Structure type map: `32458 → IHub`, `32226 → TCU`.
- **Frontend:** new `SovereigntyStructures.graphql` op; new page
  `app/sovereignty/structures/page.tsx`; `TimerCountdown` component using
  `setInterval(1000)` + `formatRelativeTime(target, true)` (future-aware helper already exists
  in `utils/date.ts`); convert the `SOVEREIGNTY` nav entry into a dropdown (Overview /
  Structures & Timers) matching the `UNIVERSE` pattern in `Header.tsx`.
- **Gotchas:** `structure_id` is BigInt → `.toString()`; guard null `vulnerable_start_time`
  (render "—"); alliance-name lookup may miss → fall back to `#${id}`.

### Feature 2 — Alliance Rankings Enrichment

Surface the daily-snapshot activity fields and add two leaderboards.

- **Backend:** extend `AllianceTerritoryRank` with `campaignsAttacking/Defending`,
  `systemsGained/Lost` (from the latest `AllianceTerritoryStats` date row, default 0). Add
  `AllianceActivityRank` type + queries `mostAggressiveAlliances(limit)` /
  `mostDefensiveAlliances(limit)`. Helper `latestTerritoryStats(allianceIds)` using
  `aggregate(_max: date)` then `findMany`.
- **Frontend:** extend the rankings query + table (2 extra columns to avoid over-width); two
  leaderboard sections reusing existing `TopAllianceCard` (map campaign counts into its
  `killCount` prop).
- **Gotchas:** two different "alliance universes" (live map vs daily snapshot) — always default
  missing stats to `0` (fields are `Int!`); guard empty snapshot table → return `[]`.

### Feature 3 — Campaign Participants

Expose per-campaign participant alliances + scores in the active-campaigns UI.

- **Backend:** add `participants: [CampaignParticipant!]!` onto `SovereigntyCampaign`; batch-fetch
  in `sovereigntyActiveCampaigns` (same eager style as the existing `combatStats` join),
  ordered by score desc.
- **Frontend:** expandable campaign row (chevron + `expandedCampaignId` state) rendering a
  nested participant list (AllianceLink + ScoreBar). Cap rendering at >8 with "show more".
- **Gotchas:** minor over-fetch (participants loaded for all campaigns) — acceptable, matches
  existing `combatStats` pattern.

### Feature 4 — Killmail War-Kill Surfacing (highest risk — do last)

"WAR KILL" badge on war-related killmails + an optional filter. **No DB changes** —
`is_war_related` is already a column with `@@index`.

- **Backend:** add `isWarRelated: Boolean!` to `Killmail` type; add `warRelated: Boolean` to
  `KillmailFilter` input. Wire through **both** code paths in
  `resolvers/killmail/queries.ts` (materialized raw-SQL path AND plain-Prisma path) plus the
  single-kill `killmail()` query. Treat `warRelated` like `minValue`/`maxValue` (a direct
  `killmails`-table condition — do **not** touch `filters-materialized.ts`; that table has no
  such column).
- **Frontend:** add `isWarRelated` to **all four** shared killmail ops
  (`Killmails`, `CharacterKillmails`, `CorporationKillmails`, `AllianceKillmails`) plus
  `Killmail.graphql`, or the `KillmailsTable/types.ts` union goes incoherent. Badge in
  `KillmailRow.tsx` (styled like NPC/SOLO pills) + detail page. Filter control mirrors
  `securitySpace` plumbing through `filterUrlHelpers.ts`, `KillmailFilters.tsx`,
  `killmails/page.tsx` (including the subscription-skip `useEffect` checks).
- **Why risky:** dual query-building paths must be edited in lockstep; shared type fans out to
  4 operations; Redis-cached killmail lists may show stale war-status until TTL (flag to QA).
- **Investigate before coding:** whether `warRelated` should join
  `hasKillmailFiltersCompatibleFilter`'s condition list (design leaves it out → cheaper
  plain-Prisma path when it's the only filter).

### Feature 5 — Active Wars by Region

"Hottest Regions Right Now" section: active campaigns grouped by region.

- **Backend:** type `RegionCampaignCount`; query `activeCampaignsByRegion(limit)`. Groups in
  app code (region derived via system→constellation→region, no direct FK) using the shared
  `regionForSystems` helper from Feature 1.
- **Frontend:** add to `SovereigntyDashboard` query; horizontal bar list on the dashboard
  (plain divs like `ScoreBar`, no chart lib), each region linking to `/regions/{id}`.
- **Gotchas:** app-code grouping is fine at current volumes (dozens); revisit as raw SQL
  `GROUP BY` only if campaign counts grow large.

### Cluster A build sequence

1. Prep (extract `AllianceLink`/`ScoreBar`)
2. Feature 5 (validates the region-resolution helper)
3. Feature 2 (extends existing type, no new page)
4. Feature 3 (relational field + expandable UI)
5. Feature 1 (new page + nav dropdown + countdown)
6. Feature 4 (highest risk, shared killmail infra) — last

Per feature: backend `.graphql` → resolver → `cd backend && yarn codegen` → frontend `.graphql`
→ `cd frontend && yarn codegen` → UI → manual verify in dev.

---

## 4. Clusters B / C / D — roadmap sketch (future specs)

### Cluster B — new backend logic (own spec later)
- **Campaign `outcome` population:** a worker (or logic in the campaigns worker) that, when a
  campaign ends (`end_time` set), infers `defender_won` / `attacker_won` / `abandoned` from the
  final scores. Unlocks win rates, defense/attack success rates, and historical analytics.
- **Per-alliance combat split:** extend `CampaignCombatStats` (currently a flat per-campaign
  rollup) or a new model to attribute kills/ISK to attacker vs defender / per participant.
  Requires the correlate worker to join killmail attacker/victim alliance against
  `CampaignParticipant`.
- **Historical analytics queries:** campaign history archive, per-system ownership history
  (from `SovereigntyMapSnapshot`), monthly gain/loss reports. Data largely exists; needs
  query + UI surface (charts).

### Cluster C — big subsystems (own spec later)
- **Interactive territory map:** color-coded by alliance. New frontend dependency (map/render
  lib) — needs a design decision (SVG starmap vs library). Data in `SovereigntyMapCurrent`.
- **Hot-zone heatmap:** conflict density by region/constellation, joining campaigns + killmails.
- **Notification/alert pipeline:** new-campaign / vulnerability / favorite-alliance /
  outcome / territory-change alerts. Needs a worker + queue + delivery (in-app, email,
  Discord webhook) + user preferences. Largest net-new subsystem.

### Cluster D — product/business (deferred, likely out of session scope)
Premium tiers, payments, mobile app, Discord bot, public API productization.

---

## 5. Conventions reference (applies to all clusters)

Distilled from tracing the actual codebase.

### Backend GraphQL query
1. Add type + `extend type Query { ... }` (with `"""` descriptions) to the domain
   `src/schemas/*.graphql`. **No custom scalars** — `DateTime`/`BigInt` fields are typed
   `String` in the schema.
2. `cd backend && yarn codegen` → regenerates `generated-types.ts` + `generated-schema.graphql`
   (never hand-edit). nodemon does NOT watch `.graphql` — restart dev or touch a `.ts`.
3. Implement in `resolvers/<domain>/queries.ts` on the exported `QueryResolvers` object. Use
   `@services/prisma` (NOT `prisma-worker`). Serialize `DateTime → .toISOString()`,
   `BigInt → .toString()`. Batch-enrich names with the `allianceNames()` / `systemInfo()`
   Map-pattern helpers (dedupe ids → single `findMany` → `Map` lookup); no DataLoaders in
   sovereignty resolvers. No Redis caching in sovereignty resolvers (keep it that way).
4. Registration: adding a query to an existing domain needs no `resolvers/index.ts` change.

### Backend cron worker
- File `src/workers/worker-sovereignty-<name>.ts`: shebang + header JSDoc, imports
  `@services/logger` + `@services/prisma-worker` (+ service), one `async function do…()` in
  try/catch with duration log, bottom self-invoke with explicit `process.exit(0/1)` +
  `$disconnect()` in both branches. Diff-against-current + chunked batch upsert pattern.
- Register: `worker:sov:<name>` script in `backend/package.json`; PM2 entry in
  `ecosystem.config.js` with `autorestart: false` + `cron_restart: '<expr>'`.

### Frontend data + page
- One `.graphql` op per page in `frontend/src/graphql/` → `cd frontend && yarn codegen`
  (backend codegen must run first; frontend reads `../backend/src/generated-schema.graphql`).
  `query Foo` → `useFooQuery`.
- Page: `"use client"`; a `…Content()` using the hook (`{data, loading, error}`, early
  Loader/error returns, null-guard every field) wrapped by a default page in `<Suspense>`.
- One-off presentational helpers live inline above the page; reused ones go in
  `components/`. Table classes: `.table` / `.th-cell` (in `app/tables.css`), row
  `transition-colors bg-neutral-950 hover:bg-neutral-900`, cells `px-4 py-3 whitespace-nowrap`.
  Entity links use `prefetch={false}`.
- Nav: add to `components/Header/Header.tsx` in BOTH desktop and mobile lists (unsynced).
  Multi-page sections use the `Popover`/`Disclosure` dropdown pattern (see `UNIVERSE`).
- New route: `app/<segment>/page.tsx`; dynamic `app/<segment>/[id]/page.tsx` with
  `params: Promise<{id: string}>` (Next 16 async params).

### Migration gotcha (only if a schema change is needed — Cluster A does not need one)
`prisma migrate dev` wants to DROP the raw-SQL-managed stats tables
(`character_kill_stats`, `alliance_kill_stats`, `corporation_kill_stats`, `killmail_filters`,
`refresh_log`) because they aren't modelled in Prisma. Safe sequence: edit `prisma/schema/*.prisma`
→ `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema --script > diff.sql`
→ **manually strip every `DROP TABLE` for those tables** → hand-place a migration folder with the
cleaned SQL → `yarn prisma:migrate:deploy` → `yarn prisma:generate`. Never run
`yarn prisma:migrate` against a DB holding those tables.

---

## 6. Testing & verification

No test suite exists for sovereignty resolvers today; the project convention is manual
verification via GraphiQL + the frontend in dev (`yarn dev` both workspaces). For each feature,
verify the query in GraphiQL against local data, then the rendered UI. Playwright screenshot
(`npx playwright screenshot`) is the working browser-verification path in this WSL env (MCP
browsers are broken here). Cluster A adds no migration, so no DB risk.

---

## 7. Open decisions for the user

1. Confirm cluster order **A → B → C**, D deferred.
2. Feature 1 nav: convert `SOVEREIGNTY` to a dropdown (Overview / Structures & Timers) — OK?
3. Feature 4: expose `related_campaign_id` too (link a war-kill badge to its campaign), or
   keep backend-only for now? (Design recommends backend-only for the quick win.)
