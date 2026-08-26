# Solar System Detail Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the solar system detail page from a page of raw identifiers into
a system profile with aggregate stats, an hourly activity chart and sovereignty
state, while fixing the URL-sync, pagination and duplication problems in the
existing page.

**Architecture:** One new cached backend aggregate query (`solarSystemStats`)
plus one new optional argument on an existing sovereignty query; everything else
consumes backend capabilities that already ship. The 572-line page component is
split into a shell plus two tab components, and the four-card leaderboard
sidebar duplicated across four pages is extracted once.

**Tech Stack:** TypeScript, Next.js 15 App Router (client components), Apollo
Client with GraphQL Codegen hooks, Tailwind, `echarts-for-react` via
`next/dynamic`, Node + Apollo Server, Prisma, PostgreSQL, Redis (ioredis).

**Spec:** `docs/superpowers/specs/2026-08-27-solar-systems-detail-improvements-design.md`

## Global Constraints

- **No test runner exists in this repository.** Neither workspace has Jest,
  Vitest, or any `*.test.*` / `*.spec.*` file. This plan does **not** introduce
  one — that is a separate decision. Every task's verification step is therefore
  a real command whose output must be read (`tsc --noEmit`, `eslint`,
  `next build`, `codegen`) plus a named manual check, never an assumed pass.
- **Codegen order is fixed.** `frontend/codegen.ts` reads
  `../backend/src/generated-schema.graphql`. Any backend schema change requires
  `yarn workspace backend codegen` **before** `yarn workspace frontend codegen`,
  or the frontend will generate against a stale schema.
- **Generated files are committed.** `backend/src/generated-schema.graphql`,
  `backend/src/generated-types.ts` and `frontend/src/generated/graphql.ts` are
  tracked; include them in the same commit as the `.graphql` change that caused
  them.
- **Language.** All code, comments, commit messages and documentation in
  English.
- **Commit style.** Conventional Commits (`feat:`, `fix:`, `refactor:`,
  `chore:`, `docs:`). No AI attribution or co-author trailers.
- **Import aliases.** Backend uses `@generated-types`, `@services/prisma`,
  `@services/redis`, `@generated/prisma/client`. Frontend uses `@/components/…`,
  `@/generated/graphql`, `@/utils/…`. Follow them; do not add relative paths.
- **Redis caching.** `redis.setex(key, ttlSeconds, JSON.stringify(value))`,
  matching `backend/src/resolvers/leaderboard/queries.ts`.
- **UI conventions.** Panels are `p-6 border bg-white/5 border-white/10`, links
  are `text-cyan-400 hover:text-cyan-300` with `prefetch={false}`, headings are
  `text-xl font-bold` with a Heroicons outline icon. No rounded corners — this
  codebase uses square edges throughout.

---

## File Structure

**Backend**

| File | Responsibility |
|------|----------------|
| `backend/src/schemas/SolarSystem.graphql` | Modify: add `SolarSystemStats` type and `solarSystemStats` query |
| `backend/src/schemas/Sovereignty.graphql` | Modify: add optional `systemId` to `sovereigntyActiveCampaigns` |
| `backend/src/resolvers/solar-system/queries.ts` | Modify: add the `solarSystemStats` resolver |
| `backend/src/resolvers/sovereignty/queries.ts` | Modify: filter active campaigns by system |
| `backend/prisma/schema/killmail.prisma` | Modify: composite index for the windowed aggregates |

**Frontend — GraphQL documents**

| File | Responsibility |
|------|----------------|
| `frontend/src/graphql/SolarSystem.graphql` | Create: detail query, moved out of the list document |
| `frontend/src/graphql/SolarSystems.graphql` | Modify: list query only |
| `frontend/src/graphql/SolarSystemStats.graphql` | Create: stats query |
| `frontend/src/graphql/SystemKillsHistory.graphql` | Create: hourly kill snapshots |
| `frontend/src/graphql/SolarSystemSovereignty.graphql` | Create: structures + active campaigns for one system |

**Frontend — components**

| File | Responsibility |
|------|----------------|
| `frontend/src/components/SolarSystemDetail/SystemStatsStrip.tsx` | Create: four headline stat tiles |
| `frontend/src/components/SystemActivityChart/SystemActivityChart.tsx` | Create: hourly ship/pod/NPC chart with a range toggle |
| `frontend/src/components/SolarSystemDetail/SolarSystemSovereigntyPanel.tsx` | Create: holder, ADM, timer, active campaign |
| `frontend/src/components/SolarSystemDetail/SystemTechnicalDetails.tsx` | Create: collapsed raw-identifier block |
| `frontend/src/components/SolarSystemDetail/OverviewTab.tsx` | Create: composes chart + sovereignty + technical details |
| `frontend/src/components/SolarSystemDetail/KillmailsTab.tsx` | Create: table + paginator + sidebar, lifted from the page |
| `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx` | Create: the four-card leaderboard sidebar, extracted once |
| `frontend/src/app/solar-systems/[id]/page.tsx` | Modify: shrink to a shell |
| `frontend/src/app/killmails/page.tsx` | Modify: adopt `TopEntitySidebar` |
| `frontend/src/app/alliances/[id]/page.tsx` | Modify: adopt `TopEntitySidebar` |
| `frontend/src/app/corporations/[id]/page.tsx` | Modify: adopt `TopEntitySidebar` |

---

### Task 1: Backend — `solarSystemStats` query

**Files:**
- Modify: `backend/src/schemas/SolarSystem.graphql`
- Modify: `backend/src/resolvers/solar-system/queries.ts`
- Modify: `backend/prisma/schema/killmail.prisma:19-24`
- Create: `backend/prisma/migrations/<timestamp>_add_killmails_system_time_index/migration.sql` (generated)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: GraphQL query `solarSystemStats(systemId: Int!): SolarSystemStats!`
  returning `{ systemId: Int!, totalKills: Int!, totalIskDestroyed: Float!,
  kills24h: Int!, kills7d: Int!, iskDestroyed7d: Float!, lastKillTime: String,
  busiestHourUtc: Int }`. Task 3 writes the frontend document against exactly
  these field names.

- [ ] **Step 1: Add the composite index to the Prisma schema**

`killmails` currently has single-column indexes only. The 24h/7d aggregates
filter on `solar_system_id` and `killmail_time` together. In
`backend/prisma/schema/killmail.prisma`, alongside the existing `@@index` lines:

```prisma
  @@index([solar_system_id, killmail_time])
```

- [ ] **Step 2: Generate and apply the migration**

```bash
yarn workspace backend prisma migrate dev --name add_killmails_system_time_index
```

Expected: a new directory under `backend/prisma/migrations/` containing a
`CREATE INDEX` statement, and the migration applied to the dev database.

- [ ] **Step 3: Add the schema type and query**

Append to `backend/src/schemas/SolarSystem.graphql`, above the existing
`extend type Query` block:

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
```

and inside the existing `extend type Query` block:

```graphql
  "Aggregate kill statistics for one solar system. Cached for 5 minutes."
  solarSystemStats(systemId: Int!): SolarSystemStats!
```

- [ ] **Step 4: Regenerate backend types**

```bash
yarn workspace backend codegen
```

Expected: `src/generated-schema.graphql` and `src/generated-types.ts` both gain
`SolarSystemStats`. `tsc` will now fail until the resolver exists — that is the
point of running codegen first.

- [ ] **Step 5: Implement the resolver**

In `backend/src/resolvers/solar-system/queries.ts`, extend the imports and add
the resolver as a new key on `solarSystemQueries`:

```ts
import { PageInfo, QueryResolvers } from '@generated-types';
import prisma from '@services/prisma';
import redis from '@services/redis';

/** Stats are recomputed at most once every 5 minutes per system. */
const STATS_CACHE_TTL_SECONDS = 300;

type LifetimeRow = {
  total_kills: bigint;
  total_isk: number | null;
  last_kill_time: Date | null;
};
type WindowRow = {
  kills_24h: bigint;
  kills_7d: bigint;
  isk_7d: number | null;
};
type BusiestHourRow = { hour: number; kill_count: bigint };
```

```ts
  solarSystemStats: async (_, { systemId }) => {
    const cacheKey = `solarSystemStats:${systemId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Lifetime totals. Served by the existing solar_system_id index.
    const lifetimeRows = await prisma.$queryRaw<LifetimeRow[]>`
      SELECT COUNT(*)::BIGINT               AS total_kills,
             COALESCE(SUM(total_value), 0)  AS total_isk,
             MAX(killmail_time)             AS last_kill_time
      FROM killmails
      WHERE solar_system_id = ${systemId}
    `;

    // Windowed counts. One scan of the last 7 days serves both windows.
    const windowRows = await prisma.$queryRaw<WindowRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE killmail_time >= NOW() - INTERVAL '24 hours')::BIGINT AS kills_24h,
        COUNT(*)::BIGINT AS kills_7d,
        COALESCE(SUM(total_value), 0) AS isk_7d
      FROM killmails
      WHERE solar_system_id = ${systemId}
        AND killmail_time >= NOW() - INTERVAL '7 days'
    `;

    const busiestHourRows = await prisma.$queryRaw<BusiestHourRow[]>`
      SELECT EXTRACT(HOUR FROM killmail_time)::INT AS hour,
             COUNT(*)::BIGINT                      AS kill_count
      FROM killmails
      WHERE solar_system_id = ${systemId}
        AND killmail_time >= NOW() - INTERVAL '7 days'
      GROUP BY 1
      ORDER BY kill_count DESC, hour ASC
      LIMIT 1
    `;

    const lifetime = lifetimeRows[0];
    const windows = windowRows[0];

    const result = {
      systemId,
      totalKills: Number(lifetime?.total_kills ?? 0),
      totalIskDestroyed: Number(lifetime?.total_isk ?? 0),
      kills24h: Number(windows?.kills_24h ?? 0),
      kills7d: Number(windows?.kills_7d ?? 0),
      iskDestroyed7d: Number(windows?.isk_7d ?? 0),
      lastKillTime: lifetime?.last_kill_time
        ? lifetime.last_kill_time.toISOString()
        : null,
      busiestHourUtc: busiestHourRows[0]?.hour ?? null,
    };

    await redis.setex(cacheKey, STATS_CACHE_TTL_SECONDS, JSON.stringify(result));
    return result;
  },
```

`COUNT(*)` returns `bigint`, which `JSON.stringify` cannot serialize — that is
why every count is wrapped in `Number()` before it reaches the cache or the
response.

- [ ] **Step 6: Verify the backend compiles**

```bash
yarn workspace backend build
```

Expected: PASS, no output. If `solarSystemStats` is reported as missing from
`QueryResolvers`, Step 4 did not run.

- [ ] **Step 7: Verify the query against a running backend**

Start the backend (`yarn workspace backend dev`) and run, against a system that
has killmails (30000142 = Jita):

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ solarSystemStats(systemId: 30000142) { totalKills totalIskDestroyed kills24h kills7d iskDestroyed7d lastKillTime busiestHourUtc } }"}'
```

Expected: non-zero `totalKills`, an ISO timestamp in `lastKillTime`, and
`busiestHourUtc` between 0 and 23. Run it a second time and confirm it returns
immediately from Redis.

- [ ] **Step 8: Confirm the index is used**

In `psql` against the dev database:

```sql
EXPLAIN ANALYZE
SELECT COUNT(*) FROM killmails
WHERE solar_system_id = 30000142
  AND killmail_time >= NOW() - INTERVAL '7 days';
```

Expected: an `Index Scan` or `Bitmap Index Scan` naming the new
`solar_system_id, killmail_time` index. A `Seq Scan` means the migration did not
apply.

- [ ] **Step 9: Commit**

```bash
git add backend/src/schemas/SolarSystem.graphql \
        backend/src/resolvers/solar-system/queries.ts \
        backend/src/generated-schema.graphql \
        backend/src/generated-types.ts \
        backend/prisma/schema/killmail.prisma \
        backend/prisma/migrations
git commit -m "feat(solar-system): add cached solarSystemStats aggregate query"
```

---

### Task 2: Backend — filter active sovereignty campaigns by system

**Files:**
- Modify: `backend/src/schemas/Sovereignty.graphql:204` (the `sovereigntyActiveCampaigns` line)
- Modify: `backend/src/resolvers/sovereignty/queries.ts:291-298`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `sovereigntyActiveCampaigns(limit: Int, systemId: Int): [SovereigntyCampaign!]!`.
  Task 3's `SolarSystemSovereignty` document passes `systemId`.

- [ ] **Step 1: Add the argument to the schema**

In `backend/src/schemas/Sovereignty.graphql`, replace the existing line:

```graphql
  "Currently active sovereignty campaigns, newest first."
  sovereigntyActiveCampaigns(limit: Int): [SovereigntyCampaign!]!
```

with:

```graphql
  "Currently active sovereignty campaigns, newest first. Optionally scoped to one system."
  sovereigntyActiveCampaigns(limit: Int, systemId: Int): [SovereigntyCampaign!]!
```

- [ ] **Step 2: Regenerate backend types**

```bash
yarn workspace backend codegen
```

- [ ] **Step 3: Apply the filter in the resolver**

In `backend/src/resolvers/sovereignty/queries.ts`, replace the
`sovereigntyActiveCampaigns` resolver with:

```ts
  sovereigntyActiveCampaigns: async (_, { limit, systemId }) => {
    const campaigns = await prisma.sovereigntyCampaign.findMany({
      where: {
        end_time: null,
        ...(systemId ? { solar_system_id: systemId } : {}),
      },
      orderBy: { start_time: 'desc' },
      take: limit ?? 100,
    });
    return enrichCampaigns(campaigns);
  },
```

The `solar_system_id, start_time` index on `sovereignty_campaigns` already
covers this filter.

- [ ] **Step 4: Verify the backend compiles**

```bash
yarn workspace backend build
```

Expected: PASS.

- [ ] **Step 5: Verify both call shapes still work**

```bash
curl -s http://localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ sovereigntyActiveCampaigns(limit: 3) { campaignId solarSystemId } }"}'
curl -s http://localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ sovereigntyActiveCampaigns(systemId: 30000142) { campaignId } }"}'
```

Expected: the first returns up to three campaigns; the second returns `[]` for
Jita, which holds no sovereignty. Confirm the unfiltered call is unchanged —
this argument must not alter existing behaviour on the sovereignty pages.

- [ ] **Step 6: Commit**

```bash
git add backend/src/schemas/Sovereignty.graphql \
        backend/src/resolvers/sovereignty/queries.ts \
        backend/src/generated-schema.graphql \
        backend/src/generated-types.ts
git commit -m "feat(sovereignty): allow scoping active campaigns to one system"
```

---

### Task 3: Frontend — GraphQL documents and codegen

**Files:**
- Create: `frontend/src/graphql/SolarSystem.graphql`
- Modify: `frontend/src/graphql/SolarSystems.graphql`
- Create: `frontend/src/graphql/SolarSystemStats.graphql`
- Create: `frontend/src/graphql/SystemKillsHistory.graphql`
- Create: `frontend/src/graphql/SolarSystemSovereignty.graphql`
- Modify: `frontend/src/generated/graphql.ts` (generated)

**Interfaces:**
- Consumes: `solarSystemStats` (Task 1), `sovereigntyActiveCampaigns(systemId:)`
  (Task 2).
- Produces: hooks `useSolarSystemQuery`, `useSolarSystemStatsQuery`,
  `useSystemKillsHistoryQuery`, `useSolarSystemSovereigntyQuery`, and the types
  `SolarSystemQuery`, `SolarSystemStatsQuery`, `SystemKillsHistoryQuery`,
  `SolarSystemSovereigntyQuery`. Tasks 4-7 import these by name.

- [ ] **Step 1: Move the detail query into its own document**

Create `frontend/src/graphql/SolarSystem.graphql` with the query as it exists
today, plus `security_class`:

```graphql
query SolarSystem($id: Int!) {
  solarSystem(id: $id) {
    id
    name
    securityStatus
    security_class
    star_id
    position {
      x
      y
      z
    }
    constellation {
      id
      name
      region {
        id
        name
      }
    }
    latestKills {
      ship_kills
      pod_kills
      npc_kills
      timestamp
    }
  }
}
```

- [ ] **Step 2: Delete the detail query from the list document**

In `frontend/src/graphql/SolarSystems.graphql`, remove the entire
`query SolarSystem($id: Int!) { … }` block. The file must contain only
`query SolarSystems($filter: SolarSystemFilter)`. Duplicating an operation name
across documents is a codegen error, so this deletion is required, not optional.

- [ ] **Step 3: Add the stats document**

Create `frontend/src/graphql/SolarSystemStats.graphql`:

```graphql
query SolarSystemStats($systemId: Int!) {
  solarSystemStats(systemId: $systemId) {
    systemId
    totalKills
    totalIskDestroyed
    kills24h
    kills7d
    iskDestroyed7d
    lastKillTime
    busiestHourUtc
  }
}
```

- [ ] **Step 4: Add the activity history document**

Create `frontend/src/graphql/SystemKillsHistory.graphql`:

```graphql
query SystemKillsHistory($filter: SystemKillsFilter!) {
  systemKillsHistory(filter: $filter) {
    ship_kills
    pod_kills
    npc_kills
    timestamp
  }
}
```

- [ ] **Step 5: Add the sovereignty document**

Create `frontend/src/graphql/SolarSystemSovereignty.graphql`. One document, so
the panel issues a single request:

```graphql
query SolarSystemSovereignty($systemId: Int!) {
  sovereigntyStructures(systemId: $systemId) {
    structureId
    structureTypeId
    structureTypeName
    allianceId
    allianceName
    allianceTicker
    occupancyLevel
    vulnerableStartTime
    vulnerableEndTime
    lastSeen
  }
  sovereigntyActiveCampaigns(systemId: $systemId) {
    campaignId
    eventType
    structureId
    defenderId
    defenderName
    defenderTicker
    defenderScore
    attackersScore
    startTime
  }
}
```

- [ ] **Step 6: Regenerate the frontend types**

```bash
yarn workspace frontend codegen
```

Expected: `frontend/src/generated/graphql.ts` gains
`useSolarSystemStatsQuery`, `useSystemKillsHistoryQuery` and
`useSolarSystemSovereigntyQuery`. If codegen reports an unknown field
`solarSystemStats`, Task 1's backend codegen was not committed and
`generated-schema.graphql` is stale.

- [ ] **Step 7: Verify nothing broke**

```bash
yarn workspace frontend lint && yarn workspace frontend build
```

Expected: PASS. `useSolarSystemQuery` is still generated — it moved documents
but kept its operation name, so the existing page still compiles.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/graphql frontend/src/generated/graphql.ts
git commit -m "feat(solar-system): add stats, activity and sovereignty documents"
```

---

### Task 4: Frontend — system stats strip

**Files:**
- Create: `frontend/src/components/SolarSystemDetail/SystemStatsStrip.tsx`
- Modify: `frontend/src/app/solar-systems/[id]/page.tsx`

**Interfaces:**
- Consumes: `useSolarSystemStatsQuery` (Task 3).
- Produces: `<SystemStatsStrip systemId={number} />` — a self-contained default
  export that runs its own query. Task 7's page shell renders it above the tab
  bar.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useSolarSystemStatsQuery } from "@/generated/graphql";
import { formatISK } from "@/utils/formatISK";
import {
  BoltIcon,
  ClockIcon,
  CurrencyDollarIcon,
  FireIcon,
} from "@heroicons/react/24/outline";

interface SystemStatsStripProps {
  systemId: number;
}

interface Tile {
  label: string;
  value: string;
  hint?: string;
  icon: typeof BoltIcon;
  iconColor: string;
}

/** Formats a UTC hour as a readable window, e.g. 18 -> "18:00 - 19:00 UTC". */
function formatHourWindow(hour: number): string {
  const next = (hour + 1) % 24;
  return `${String(hour).padStart(2, "0")}:00 - ${String(next).padStart(2, "0")}:00`;
}

export default function SystemStatsStrip({ systemId }: SystemStatsStripProps) {
  const { data, loading } = useSolarSystemStatsQuery({
    variables: { systemId },
  });

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 mt-8 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 border animate-pulse bg-white/5 border-white/10"
          />
        ))}
      </div>
    );
  }

  const stats = data?.solarSystemStats;
  if (!stats) return null;

  const tiles: Tile[] = [
    {
      label: "Total Kills",
      value: stats.totalKills.toLocaleString(),
      icon: FireIcon,
      iconColor: "text-orange-400",
    },
    {
      label: "ISK Destroyed",
      value: formatISK(stats.totalIskDestroyed),
      icon: CurrencyDollarIcon,
      iconColor: "text-green-400",
    },
    {
      label: "Kills (24h)",
      value: stats.kills24h.toLocaleString(),
      hint: `${stats.kills7d.toLocaleString()} in 7 days`,
      icon: BoltIcon,
      iconColor: "text-cyan-400",
    },
    {
      label: "Busiest Hour",
      value:
        stats.busiestHourUtc != null
          ? formatHourWindow(stats.busiestHourUtc)
          : "No data",
      hint: stats.busiestHourUtc != null ? "UTC, last 7 days" : undefined,
      icon: ClockIcon,
      iconColor: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 mt-8 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="p-4 border bg-white/5 border-white/10"
        >
          <div className="flex items-center gap-2 text-xs tracking-wide text-gray-400 uppercase">
            <tile.icon className={`w-4 h-4 ${tile.iconColor}`} />
            {tile.label}
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{tile.value}</div>
          {tile.hint && (
            <div className="mt-1 text-xs text-gray-500">{tile.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Confirm the ISK formatter's signature**

```bash
sed -n '1,30p' frontend/src/utils/formatISK.ts
```

Expected: a function taking a `number` and returning a `string`. If it is a
named export rather than the default, adjust the import in Step 1 to match — do
not change the utility.

- [ ] **Step 3: Render it on the page**

In `frontend/src/app/solar-systems/[id]/page.tsx`, import the component and
insert it between the header block and the `{/* Tabs */}` block:

```tsx
<SystemStatsStrip systemId={parseInt(id)} />
```

- [ ] **Step 4: Verify**

```bash
yarn workspace frontend lint && yarn workspace frontend build
```

Expected: PASS.

- [ ] **Step 5: Manual check**

With both workspaces running, open `/solar-systems/30000142` (Jita) and confirm
four tiles render with non-zero values, then open a quiet null-sec system and
confirm zeros render as `0` rather than an empty state or a crash.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SolarSystemDetail/SystemStatsStrip.tsx \
        frontend/src/app/solar-systems/\[id\]/page.tsx
git commit -m "feat(solar-system): add headline stats strip to the detail page"
```

---

### Task 5: Frontend — system activity chart

**Files:**
- Create: `frontend/src/components/SystemActivityChart/SystemActivityChart.tsx`
- Reference: `frontend/src/components/AllianceGrowthChart/AllianceGrowthChart.tsx` (the pattern to follow)

**Interfaces:**
- Consumes: `useSystemKillsHistoryQuery` (Task 3).
- Produces: `<SystemActivityChart systemId={number} />`. Task 7's `OverviewTab`
  renders it full width.

- [ ] **Step 1: Confirm the retention window of `system_kills`**

```bash
grep -rn "deleteMany\|retention\|older" backend/src/workers/worker-system-kills.ts
```

Read the result before writing the component. If the worker prunes rows to less
than 7 days, ship the 24h range only and delete the `7d` entry from
`RANGE_HOURS` in Step 2. Do not offer a range the data cannot fill.

- [ ] **Step 2: Create the component**

```tsx
"use client";

import { useSystemKillsHistoryQuery } from "@/generated/graphql";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type RangeType = "24h" | "7d";

const RANGE_HOURS: Record<RangeType, number> = {
  "24h": 24,
  "7d": 168,
};

const RANGE_LABELS: Record<RangeType, string> = {
  "24h": "24 Hours",
  "7d": "7 Days",
};

interface SystemActivityChartProps {
  systemId: number;
}

/** Formats an ISO timestamp as a short axis label, e.g. "14 Mar 18:00". */
function formatAxisLabel(timestamp: string, range: RangeType): string {
  const d = new Date(timestamp);
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:00`;
  if (range === "24h") return time;
  const day = d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${day} ${time}`;
}

export default function SystemActivityChart({
  systemId,
}: SystemActivityChartProps) {
  const [range, setRange] = useState<RangeType>("24h");

  const { data, loading } = useSystemKillsHistoryQuery({
    variables: { filter: { system_id: systemId, hours: RANGE_HOURS[range] } },
  });

  const chartData = useMemo(() => {
    const rows = [...(data?.systemKillsHistory ?? [])].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    return {
      labels: rows.map((r) => formatAxisLabel(r.timestamp, range)),
      shipKills: rows.map((r) => r.ship_kills),
      podKills: rows.map((r) => r.pod_kills),
      npcKills: rows.map((r) => r.npc_kills),
      isEmpty: rows.length === 0,
    };
  }, [data, range]);

  const option = useMemo(
    () => ({
      grid: { left: 48, right: 24, top: 40, bottom: 32 },
      tooltip: { trigger: "axis" },
      legend: {
        data: ["Ship Kills", "Pod Kills", "NPC Kills"],
        textStyle: { color: "#9ca3af" },
        top: 0,
      },
      xAxis: {
        type: "category",
        data: chartData.labels,
        axisLabel: { color: "#9ca3af" },
        axisLine: { lineStyle: { color: "#374151" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#9ca3af" },
        splitLine: { lineStyle: { color: "#1f2937" } },
      },
      series: [
        {
          name: "Ship Kills",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: chartData.shipKills,
          itemStyle: { color: "#22d3ee" },
        },
        {
          name: "Pod Kills",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: chartData.podKills,
          itemStyle: { color: "#f97316" },
        },
        {
          name: "NPC Kills",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: chartData.npcKills,
          itemStyle: { color: "#a78bfa" },
        },
      ],
    }),
    [chartData],
  );

  return (
    <div className="p-6 border bg-white/5 border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold">Kill Activity</h2>
        <div className="flex gap-2">
          {(Object.keys(RANGE_LABELS) as RangeType[]).map((key) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`px-3 py-1 text-xs font-semibold transition-colors cursor-pointer border ${
                range === key
                  ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
                  : "border-white/10 text-gray-400 hover:text-gray-200"
              }`}
            >
              {RANGE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse bg-white/5" />
      ) : chartData.isEmpty ? (
        <div className="flex items-center justify-center h-64 text-sm text-gray-500">
          No kill activity recorded in this window
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: 256 }} />
      )}
    </div>
  );
}
```

An axis with no series reads as a broken chart, which is why the empty case
replaces the chart entirely rather than rendering empty axes.

- [ ] **Step 3: Verify**

```bash
yarn workspace frontend lint && yarn workspace frontend build
```

Expected: PASS.

- [ ] **Step 4: Manual check**

Temporarily render `<SystemActivityChart systemId={30000142} />` inside the
Attributes tab, load the page, and confirm: three legend entries, a populated
line chart, and that switching 24h ↔ 7d refetches and redraws. Then confirm a
system with no snapshots shows the empty message rather than bare axes. Remove
the temporary render before committing — Task 7 wires it in properly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SystemActivityChart/SystemActivityChart.tsx
git commit -m "feat(solar-system): add hourly kill activity chart"
```

---

### Task 6: Frontend — sovereignty panel

**Files:**
- Create: `frontend/src/components/SolarSystemDetail/SolarSystemSovereigntyPanel.tsx`

**Interfaces:**
- Consumes: `useSolarSystemSovereigntyQuery` (Task 3).
- Produces: `<SolarSystemSovereigntyPanel systemId={number} />`, which renders
  `null` when the system has no sovereignty structures. Task 7's `OverviewTab`
  renders it directly, without its own conditional.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useSolarSystemSovereigntyQuery } from "@/generated/graphql";
import { formatKillmailDateTime } from "@/utils/date";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

interface SolarSystemSovereigntyPanelProps {
  systemId: number;
}

export default function SolarSystemSovereigntyPanel({
  systemId,
}: SolarSystemSovereigntyPanelProps) {
  const { data, loading } = useSolarSystemSovereigntyQuery({
    variables: { systemId },
  });

  if (loading) {
    return <div className="h-48 border animate-pulse bg-white/5 border-white/10" />;
  }

  const structures = data?.sovereigntyStructures ?? [];
  const campaigns = data?.sovereigntyActiveCampaigns ?? [];

  // High-sec and low-sec systems hold no sovereignty; an empty card there is noise.
  if (structures.length === 0) return null;

  return (
    <div className="p-6 border bg-white/5 border-white/10">
      <h2 className="flex items-center gap-2 mb-4 text-xl font-bold">
        <ShieldCheckIcon className="w-5 h-5 text-amber-400" />
        Sovereignty
      </h2>

      <div className="space-y-3">
        {structures.map((structure) => (
          <div
            key={structure.structureId}
            className="flex flex-wrap items-center justify-between gap-3 p-3 border bg-white/5 border-white/10"
          >
            <div>
              <div className="text-xs text-gray-500 uppercase">
                {structure.structureTypeName}
              </div>
              {structure.allianceId ? (
                <Link
                  href={`/alliances/${structure.allianceId}`}
                  prefetch={false}
                  className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                >
                  {structure.allianceName ?? `Alliance ${structure.allianceId}`}
                  {structure.allianceTicker && ` [${structure.allianceTicker}]`}
                </Link>
              ) : (
                <span className="font-medium text-gray-300">Unclaimed</span>
              )}
            </div>

            <div className="text-right">
              {structure.occupancyLevel != null && (
                <div className="text-sm text-gray-200">
                  ADM {structure.occupancyLevel.toFixed(1)}
                </div>
              )}
              {structure.vulnerableStartTime && (
                <div className="text-xs text-gray-500">
                  Vulnerable {formatKillmailDateTime(structure.vulnerableStartTime)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {campaigns.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs tracking-wide text-gray-400 uppercase">
            Active Campaigns
          </div>
          <div className="space-y-2">
            {campaigns.map((campaign) => (
              <div
                key={campaign.campaignId}
                className="flex flex-wrap items-center justify-between gap-3 p-3 border bg-red-500/5 border-red-500/30"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {campaign.eventType}
                  </div>
                  <div className="text-xs text-gray-400">
                    Defender:{" "}
                    {campaign.defenderName ?? "Unknown"}
                    {campaign.defenderTicker && ` [${campaign.defenderTicker}]`}
                  </div>
                </div>
                <div className="text-xs text-right text-gray-400">
                  <div>
                    Defender {((campaign.defenderScore ?? 0) * 100).toFixed(0)}% ·
                    Attackers {((campaign.attackersScore ?? 0) * 100).toFixed(0)}%
                  </div>
                  <div>Started {formatKillmailDateTime(campaign.startTime)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirm the date helper's name**

```bash
grep -n "export" frontend/src/utils/date.ts
```

Expected: `formatKillmailDateTime` is exported. If it is not, use whichever
datetime formatter that file exports and adjust both call sites in Step 1.

- [ ] **Step 3: Verify**

```bash
yarn workspace frontend lint && yarn workspace frontend build
```

Expected: PASS.

- [ ] **Step 4: Manual check**

Find a sov-held system:

```bash
curl -s http://localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ sovereigntyStructures(limit: 3) { solarSystemId solarSystemName allianceName } }"}'
```

Temporarily render the panel for one of those system IDs and confirm the holder,
ADM and timer appear. Then render it for 30000142 (Jita) and confirm the panel
renders nothing at all — no empty card, no heading. Remove the temporary render
before committing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SolarSystemDetail/SolarSystemSovereigntyPanel.tsx
git commit -m "feat(solar-system): add sovereignty panel to the detail page"
```

---

### Task 7: Frontend — page restructure, URL sync and pagination fixes

**Files:**
- Create: `frontend/src/components/SolarSystemDetail/SystemTechnicalDetails.tsx`
- Create: `frontend/src/components/SolarSystemDetail/OverviewTab.tsx`
- Create: `frontend/src/components/SolarSystemDetail/KillmailsTab.tsx`
- Modify: `frontend/src/app/solar-systems/[id]/page.tsx` (rewrite as a shell)

**Interfaces:**
- Consumes: `SystemStatsStrip` (Task 4), `SystemActivityChart` (Task 5),
  `SolarSystemSovereigntyPanel` (Task 6), `useSolarSystemQuery` (Task 3).
- Produces: `<OverviewTab system={SolarSystemQuery["solarSystem"]} />` and
  `<KillmailsTab systemId={number} />`. Task 9 modifies `KillmailsTab`'s
  sidebar.

- [ ] **Step 1: Create the technical details block**

```tsx
"use client";

import type { SolarSystemQuery } from "@/generated/graphql";

/** One astronomical unit in metres, for converting raw ESI coordinates. */
const METRES_PER_AU = 149_597_870_700;

interface SystemTechnicalDetailsProps {
  system: NonNullable<SolarSystemQuery["solarSystem"]>;
}

export default function SystemTechnicalDetails({
  system,
}: SystemTechnicalDetailsProps) {
  return (
    <details className="p-6 border bg-white/5 border-white/10">
      <summary className="text-sm font-semibold text-gray-300 cursor-pointer">
        Technical details
      </summary>

      <dl className="grid gap-3 mt-4 sm:grid-cols-2">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-400">System ID</dt>
          <dd className="text-gray-200">{system.id}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-400">Security Status</dt>
          <dd className="text-gray-200">
            {system.securityStatus != null
              ? system.securityStatus.toFixed(5)
              : "N/A"}
          </dd>
        </div>
        {system.security_class && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400">Security Class</dt>
            <dd className="text-gray-200">{system.security_class}</dd>
          </div>
        )}
        {system.star_id && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400">Star ID</dt>
            <dd className="text-gray-200">{system.star_id}</dd>
          </div>
        )}
        {system.position && (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-400">X</dt>
              <dd className="text-gray-200">
                {(system.position.x / METRES_PER_AU).toFixed(2)} AU
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-400">Y</dt>
              <dd className="text-gray-200">
                {(system.position.y / METRES_PER_AU).toFixed(2)} AU
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-400">Z</dt>
              <dd className="text-gray-200">
                {(system.position.z / METRES_PER_AU).toFixed(2)} AU
              </dd>
            </div>
          </>
        )}
      </dl>
    </details>
  );
}
```

The Location Hierarchy card from the old Attributes tab is deliberately not
carried over: the breadcrumb and the page header already link region and
constellation twice.

- [ ] **Step 2: Create the overview tab**

```tsx
"use client";

import SolarSystemSovereigntyPanel from "@/components/SolarSystemDetail/SolarSystemSovereigntyPanel";
import SystemTechnicalDetails from "@/components/SolarSystemDetail/SystemTechnicalDetails";
import SystemActivityChart from "@/components/SystemActivityChart/SystemActivityChart";
import type { SolarSystemQuery } from "@/generated/graphql";

interface OverviewTabProps {
  system: NonNullable<SolarSystemQuery["solarSystem"]>;
}

export default function OverviewTab({ system }: OverviewTabProps) {
  return (
    <div className="mt-6 space-y-6">
      <SystemActivityChart systemId={system.id} />
      <SolarSystemSovereigntyPanel systemId={system.id} />
      <SystemTechnicalDetails system={system} />
    </div>
  );
}
```

- [ ] **Step 3: Create the killmails tab**

Move the entire `activeTab === "killmails"` block out of the page, together with
the five hooks that feed it (`useKillmailsQuery`,
`useKillmailsDateCountsQuery`, and the three `useTopLast7Days*` hooks plus
`useTopLast7DaysShipsQuery`), the `killmails` and `dateCountsMap` memos, and the
paginator handlers. The component owns its own page state, so the parent no
longer holds `currentPage` or `pageSize`:

```tsx
"use client";

import KillmailsTable from "@/components/KillmailsTable";
import Paginator from "@/components/Paginator/Paginator";
import TopAllianceCard from "@/components/TopAllianceCard/TopAllianceCard";
import TopCharacterCard from "@/components/TopCharacterCard/TopCharacterCard";
import TopCorporationCard from "@/components/TopCorporationCard/TopCorporationCard";
import TopShipsCard from "@/components/TopShipsCard/TopShipsCard";
import {
  KillmailOrderBy,
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
  useTopLast7DaysAlliancesQuery,
  useTopLast7DaysCorporationsQuery,
  useTopLast7DaysPilotsQuery,
  useTopLast7DaysShipsQuery,
} from "@/generated/graphql";
import { useCallback, useMemo } from "react";

interface KillmailsTabProps {
  systemId: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function KillmailsTab({
  systemId,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: KillmailsTabProps) {
  // …the four leaderboard hooks and the two killmail hooks, moved verbatim from
  // the old page with `skip` removed (this component only mounts on the tab)…
}
```

Copy the four `Top*Card` blocks and their `.map` prop adapters across unchanged;
Task 9 replaces all four with a single component, and doing both at once would
make a regression impossible to attribute.

- [ ] **Step 4: Rewrite the page as a shell**

```tsx
"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import { Loader } from "@/components/Loader/Loader";
import SecurityBadge from "@/components/SecurityStatus/SecurityStatus";
import KillmailsTab from "@/components/SolarSystemDetail/KillmailsTab";
import OverviewTab from "@/components/SolarSystemDetail/OverviewTab";
import SystemStatsStrip from "@/components/SolarSystemDetail/SystemStatsStrip";
import { useSolarSystemQuery } from "@/generated/graphql";
import { formatTimeAgo } from "@/utils/date";
import { getSecurityColor } from "@/utils/security";
import { GlobeAltIcon, MapIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useState } from "react";

type TabType = "overview" | "killmails";

interface SolarSystemDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function SolarSystemDetailPage({
  params,
}: SolarSystemDetailPageProps) {
  const { id } = use(params);
  const systemId = parseInt(id);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get("tab") as TabType) || "overview",
  );
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get("page")) || 1,
  );
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get("pageSize")) || 25,
  );

  const { data, loading, error } = useSolarSystemQuery({
    variables: { id: systemId },
  });

  // The URL is written from the handlers that change state, never from an
  // effect: an effect fires on mount too, pushing a history entry before the
  // user has touched anything.
  const syncUrl = useCallback(
    (tab: TabType, page: number, size: number) => {
      const next = new URLSearchParams();
      next.set("tab", tab);
      if (tab === "killmails") {
        next.set("page", String(page));
        next.set("pageSize", String(size));
      }
      router.replace(`/solar-systems/${id}?${next.toString()}`, {
        scroll: false,
      });
    },
    [router, id],
  );

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      // A tab reads as freshly opened, so it must not inherit page 7.
      setCurrentPage(1);
      syncUrl(tab, 1, pageSize);
    },
    [pageSize, syncUrl],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      syncUrl(activeTab, page, pageSize);
    },
    [activeTab, pageSize, syncUrl],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
      syncUrl(activeTab, 1, size);
    },
    [activeTab, syncUrl],
  );

  // …loading / error / not-found guards, unchanged from the current page…
  // …header block, unchanged from the current page…

  return (
    <div>
      {/* Breadcrumb and header, carried over unchanged */}

      <SystemStatsStrip systemId={systemId} />

      {/* Tab bar, carried over unchanged except onClick={() => handleTabChange(tab.id)} */}

      {activeTab === "overview" && <OverviewTab system={system} />}
      {activeTab === "killmails" && (
        <KillmailsTab
          systemId={systemId}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
```

Rename the tab in the `tabs` array from `attributes` / `Attributes` to
`overview` / `Overview`. There is no `useEffect` anywhere in the finished file.

- [ ] **Step 5: Verify**

```bash
yarn workspace frontend lint && yarn workspace frontend build
```

Expected: PASS, with no `react-hooks/exhaustive-deps` warnings.

- [ ] **Step 6: Confirm the page shrank**

```bash
wc -l frontend/src/app/solar-systems/\[id\]/page.tsx
```

Expected: under 200 lines, down from 572.

- [ ] **Step 7: Manual check of the fixed behaviours**

1. Load `/solar-systems/30000142` with no query string. Confirm the URL becomes
   `?tab=overview` **without** adding a history entry — pressing Back once must
   leave the page, not cycle through tab states.
2. Switch to Killmails, page to 7, switch to Overview, switch back. Confirm the
   table is on page 1 and the URL reads `page=1`.
3. Confirm Overview shows the stats strip, the chart, and — on a sov-held
   system — the sovereignty panel, with technical details collapsed.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/SolarSystemDetail frontend/src/app/solar-systems/\[id\]/page.tsx
git commit -m "refactor(solar-system): split the detail page and fix URL and page state"
```

---

### Task 8: Frontend — sovereignty holder chip in the header

**Files:**
- Modify: `frontend/src/app/solar-systems/[id]/page.tsx`

**Interfaces:**
- Consumes: `useSolarSystemSovereigntyQuery` (Task 3). Apollo's normalized cache
  serves this from the request the panel already made, so the chip costs no
  extra round trip.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Query the holder in the page shell**

Add to the shell, below the existing `useSolarSystemQuery` call:

```tsx
  const { data: sovData } = useSolarSystemSovereigntyQuery({
    variables: { systemId },
  });
  const sovHolder = sovData?.sovereigntyStructures?.[0];
```

- [ ] **Step 2: Render the chip**

Inside the header's flex row that already holds the constellation and region
links, after the region link:

```tsx
{sovHolder?.allianceId && (
  <div className="flex items-center gap-2 text-gray-400">
    <ShieldCheckIcon className="w-4 h-4 text-amber-400" />
    <span>Sovereignty:</span>
    <Link
      href={`/alliances/${sovHolder.allianceId}`}
      prefetch={false}
      className="transition-colors text-cyan-400 hover:text-cyan-300"
    >
      {sovHolder.allianceName ?? `Alliance ${sovHolder.allianceId}`}
      {sovHolder.allianceTicker && ` [${sovHolder.allianceTicker}]`}
    </Link>
  </div>
)}
```

Add `ShieldCheckIcon` to the existing `@heroicons/react/24/outline` import.

- [ ] **Step 3: Verify**

```bash
yarn workspace frontend lint && yarn workspace frontend build
```

Expected: PASS.

- [ ] **Step 4: Manual check**

On a sov-held system, confirm the chip appears in the header and that the
network tab shows **one** `SolarSystemSovereignty` request, not two — if there
are two, the panel and the chip are passing different variables. On Jita,
confirm no chip renders.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/solar-systems/\[id\]/page.tsx
git commit -m "feat(solar-system): show the sovereignty holder in the page header"
```

---

### Task 9: Frontend — extract the shared top-entity sidebar

**Files:**
- Create: `frontend/src/components/TopEntitySidebar/TopEntitySidebar.tsx`
- Modify: `frontend/src/components/SolarSystemDetail/KillmailsTab.tsx`
- Modify: `frontend/src/app/killmails/page.tsx`
- Modify: `frontend/src/app/alliances/[id]/page.tsx`
- Modify: `frontend/src/app/corporations/[id]/page.tsx`

**Interfaces:**
- Consumes: the four `useTopLast7Days*Query` hooks, already generated.
- Produces: `<TopEntitySidebar location={{ systemId?: number; constellationId?: number; regionId?: number }} variant="detail" | "default" />`.

- [ ] **Step 1: Read all four call sites before writing anything**

```bash
grep -n "TopCharacterCard" -A 40 frontend/src/app/alliances/\[id\]/page.tsx
grep -n "TopCharacterCard" -A 40 frontend/src/app/corporations/\[id\]/page.tsx
grep -n "TopCharacterCard" -A 40 frontend/src/app/killmails/page.tsx
```

The four blocks are near-identical but not identical — filter variables and
`variant` differ, and the alliance and corporation pages may pass an entity
filter rather than a location filter. If a call site turns out to need props
this interface does not carry, leave that call site alone, note it in the commit
message, and convert only the ones that fit. A shared component with four
escape hatches is worse than three conversions.

- [ ] **Step 2: Create the component**

```tsx
"use client";

import TopAllianceCard from "@/components/TopAllianceCard/TopAllianceCard";
import TopCharacterCard from "@/components/TopCharacterCard/TopCharacterCard";
import TopCorporationCard from "@/components/TopCorporationCard/TopCorporationCard";
import TopShipsCard from "@/components/TopShipsCard/TopShipsCard";
import {
  useTopLast7DaysAlliancesQuery,
  useTopLast7DaysCorporationsQuery,
  useTopLast7DaysPilotsQuery,
  useTopLast7DaysShipsQuery,
} from "@/generated/graphql";

export interface TopEntityLocation {
  systemId?: number;
  constellationId?: number;
  regionId?: number;
}

interface TopEntitySidebarProps {
  location?: TopEntityLocation;
  variant?: "default" | "detail";
  limit?: number;
}

const ROLLING_SUBTITLE = (
  <>
    Last 7 days{" "}
    <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
      ROLLING
    </span>
  </>
);

export default function TopEntitySidebar({
  location,
  variant = "detail",
  limit = 10,
}: TopEntitySidebarProps) {
  const filter = { limit, ...location };

  const { data: pilots, loading: pilotsLoading } = useTopLast7DaysPilotsQuery({
    variables: { filter },
  });
  const { data: corps, loading: corpsLoading } =
    useTopLast7DaysCorporationsQuery({ variables: { filter } });
  const { data: alliances, loading: alliancesLoading } =
    useTopLast7DaysAlliancesQuery({ variables: { filter } });
  const { data: ships, loading: shipsLoading } = useTopLast7DaysShipsQuery({
    variables: { filter },
  });

  return (
    <div className="space-y-6">
      <TopCharacterCard
        title="Top Characters"
        subtitle={ROLLING_SUBTITLE}
        characters={
          pilots?.topLast7DaysPilots?.map((pilot) => ({
            id: pilot.character?.id || 0,
            name: pilot.character?.name || "Unknown",
            killCount: pilot.killCount,
            securityStatus: pilot.character?.securityStatus,
            corporation: pilot.character?.corporation
              ? {
                  id: pilot.character.corporation.id,
                  name: pilot.character.corporation.name,
                }
              : null,
            alliance: pilot.character?.alliance
              ? {
                  id: pilot.character.alliance.id,
                  name: pilot.character.alliance.name,
                }
              : null,
          })) || []
        }
        loading={pilotsLoading}
        emptyText="No character activity in the last 7 days"
        variant={variant}
      />
      <TopCorporationCard
        title="Top Corporations"
        subtitle={ROLLING_SUBTITLE}
        corporations={
          corps?.topLast7DaysCorporations?.map((corp) => ({
            id: corp.corporation?.id || 0,
            name: corp.corporation?.name || "Unknown",
            ticker: corp.corporation?.ticker,
            killCount: corp.killCount,
          })) || []
        }
        loading={corpsLoading}
        emptyText="No corporation activity in the last 7 days"
        variant={variant}
      />
      <TopAllianceCard
        title="Top Alliances"
        subtitle={ROLLING_SUBTITLE}
        alliances={
          alliances?.topLast7DaysAlliances?.map((alliance) => ({
            id: alliance.alliance?.id || 0,
            name: alliance.alliance?.name || "Unknown",
            ticker: alliance.alliance?.ticker,
            killCount: alliance.killCount,
          })) || []
        }
        loading={alliancesLoading}
        emptyText="No alliance activity in the last 7 days"
        variant={variant}
      />
      <TopShipsCard
        title="Top Ships"
        subtitle={ROLLING_SUBTITLE}
        ships={
          ships?.topLast7DaysShips?.map((ship) => ({
            id: ship.shipType?.id || 0,
            name: ship.shipType?.name || "Unknown",
            killCount: ship.killCount,
            dogmaAttributes: ship.shipType?.dogmaAttributes,
          })) || []
        }
        loading={shipsLoading}
        emptyText="No ship activity in the last 7 days"
        variant={variant}
      />
    </div>
  );
}
```

- [ ] **Step 3: Convert the solar system tab first**

In `KillmailsTab.tsx`, delete the four `Top*Card` blocks, the four
`useTopLast7Days*` hooks and their imports, and replace the sidebar with:

```tsx
<div className="lg:col-span-1 lg:mt-9">
  <TopEntitySidebar location={{ systemId }} variant="detail" />
</div>
```

- [ ] **Step 4: Verify and check the page visually**

```bash
yarn workspace frontend lint && yarn workspace frontend build
```

Then load `/solar-systems/30000142?tab=killmails` and confirm all four cards
render identically to before the change — same order, same subtitles, same
counts.

- [ ] **Step 5: Commit the first conversion on its own**

```bash
git add frontend/src/components/TopEntitySidebar frontend/src/components/SolarSystemDetail/KillmailsTab.tsx
git commit -m "refactor(components): extract the shared top-entity sidebar"
```

- [ ] **Step 6: Convert the remaining call sites one at a time**

For each of `killmails/page.tsx`, `alliances/[id]/page.tsx` and
`corporations/[id]/page.tsx` that Step 1 confirmed is compatible: replace the
block, run `yarn workspace frontend lint && yarn workspace frontend build`,
load that page, confirm the cards are unchanged, and commit that page alone:

```bash
git add frontend/src/app/killmails/page.tsx
git commit -m "refactor(killmails): use the shared top-entity sidebar"
```

One commit per page, so a regression can be bisected to the page that caused it.

---

## Self-Review

**Spec coverage.** P1 → Tasks 4, 5, 6, 7 (Overview replaces Attributes).
P2 → Tasks 5 and 6 (`systemKillsHistory`, `sovereigntyStructures`).
P3 → Task 1 (`solarSystemStats`) surfaced in Task 4. P4 and P5 → Task 7.
P6 → Task 9. P7 → Task 3. Section 6.2's index work is Task 1 Steps 1-2 and 8;
the `systemId` argument is Task 2. Section 8's empty and error states are
covered by Task 4 Step 1 (skeletons, zeros), Task 5 Step 2 (empty chart
message), Task 6 Step 1 (null render). Section 9's verification commands appear
as real steps in every task.

**Assumption A3 check.** The spec keeps raw identifiers in a collapsed block;
Task 7 Step 1 implements exactly that, and additionally converts the coordinates
to AU, which is the readable form the spec's P1 asked for.

**Known gap.** The spec's Risk R2 (`system_kills` retention) is resolved inside
Task 5 Step 1 rather than up front. If retention turns out to be under 7 days,
the range toggle ships as 24h-only and the spec's chart description is
correspondingly narrower. That is a deliberate branch, not an unplanned one.

**Type consistency.** `solarSystemStats` field names are identical in the schema
(Task 1 Step 3), the frontend document (Task 3 Step 3) and the component
(Task 4 Step 1). `systemId` is the argument name on both new/changed backend
queries and on every component prop. `SolarSystemQuery["solarSystem"]` is the
type used by both `OverviewTab` and `SystemTechnicalDetails`.
