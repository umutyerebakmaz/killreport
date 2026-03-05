---
description: "Add a new ID-based filter to KillmailFilters (e.g. regionId, constellationId, systemId). Follows the established full-stack pattern across GraphQL queries, URL helpers, and the React filter component."
agent: "agent"
argument-hint: "Filter name to add, e.g. regionId"
---

Add a new ID-based location filter to the KillmailFilters system, following the exact same pattern as `constellationId` and `systemId`.

## Context files to read first

- [frontend/src/components/Filters/KillmailFilters.tsx](../../frontend/src/components/Filters/KillmailFilters.tsx) — main filter component
- [frontend/src/utils/filterUrlHelpers.ts](../../frontend/src/utils/filterUrlHelpers.ts) — URL parse/serialize
- [frontend/src/graphql/SearchConstellations.graphql](../../frontend/src/graphql/SearchConstellations.graphql) — search-by-text query template
- [frontend/src/graphql/SearchConstellation.graphql](../../frontend/src/graphql/SearchConstellation.graphql) — fetch-by-id query template
- [backend/src/schemas/KillmailFilter.graphql](../../backend/src/schemas/KillmailFilter.graphql) — GQL input type
- [backend/src/resolvers/killmail/filters-materialized.ts](../../backend/src/resolvers/killmail/filters-materialized.ts) — materialized filter SQL builder
- [backend/src/resolvers/killmail/queries.ts](../../backend/src/resolvers/killmail/queries.ts) — resolver guard check

## Task: Add `regionId` filter

The filter name is **regionId**. The corresponding entity is `Region` (backend type defined in `Region.graphql`).

### Layer 1 — Frontend GraphQL queries

Create two new `.graphql` files in `frontend/src/graphql/`:

**`SearchRegions.graphql`** — search by text (mirrors `SearchConstellations.graphql`):
```graphql
query SearchRegions($search: String!, $limit: Int = 40) {
  regions(filter: { search: $search, limit: $limit }) {
    items {
      id
      name
      solarSystemCount
      constellationCount
      securityStats {
        highSec
        lowSec
        nullSec
        wormhole
        avgSecurity
      }
    }
  }
}
```

**`SearchRegion.graphql`** — fetch by ID (mirrors `SearchConstellation.graphql`):
```graphql
query SearchRegion($id: Int!) {
  region(id: $id) {
    id
    name
  }
}
```

After creating the files, run codegen to regenerate the typed hooks:
```bash
cd frontend && npm run codegen
```

### Layer 2 — `filterUrlHelpers.ts`

The `KillmailFilters` interface already has `regionId?: number`. Two functions need updating:

**`parseKillmailFiltersFromUrl`** — add parse for `regionId` alongside `constellationIdFromUrl` and `systemIdFromUrl`:
```ts
const regionIdFromUrl = searchParams.get("regionId")
    ? Number(searchParams.get("regionId"))
    : undefined;
```
Then include it in the returned `filters` object: `regionId: regionIdFromUrl`.

**`buildKillmailFiltersUrl`** — add serialize for `regionId` alongside the `constellationId` block:
```ts
if (filters.regionId) {
    params.set("regionId", filters.regionId.toString());
}
```

### Layer 3 — `KillmailFilters.tsx`

Follow every step that `constellationId` does, verbatim, substituting `constellation` → `region`:

1. **Props interface** — add `initialRegionId?: number` next to `initialConstellationId`.
2. **FilterData interface** — add `regionId?: number` next to `constellationId`.
3. **Destructure prop** — add `initialRegionId` in the function parameter destructuring.
4. **Import hooks** — import `useSearchRegionQuery` and `useSearchRegionsQuery` from the generated hooks (same import location as Constellation hooks).
5. **State** — add region search state block next to the constellation block:
   ```ts
   const [regionSearch, setRegionSearch] = useState("");
   const [regionId, setRegionId] = useState<number | undefined>(initialRegionId);
   const [regionName, setRegionName] = useState("");
   const [showRegionDropdown, setShowRegionDropdown] = useState(false);
   const regionDropdownRef = useRef<HTMLDivElement>(null);
   ```
6. **Debounce** — `const debouncedRegionSearch = useDebounce(regionSearch, 500);`
7. **Initial name fetch** — fetch `region.name` when `initialRegionId` is set (mirrors `initialConstellationData`):
   ```ts
   const { data: initialRegionData } = useSearchRegionQuery({
     variables: { id: initialRegionId! },
     skip: !initialRegionId,
   });
   ```
8. **Populate name effect** — set `regionName` from `initialRegionData` (mirrors constellation equivalent).
9. **Sync effect** — reset `regionId` and clear name when `initialRegionId` changes (mirrors `useEffect` for `initialConstellationId`).
10. **Live search query** — `useSearchRegionsQuery` driven by `debouncedRegionSearch` (mirrors `useSearchConstellationsQuery`).
11. **Outside-click handler** — add `regionDropdownRef` to the existing outside-click `useEffect` (same pattern as `constellationDropdownRef`).
12. **`applyFilters`** — include `regionId` in the `filterData` object passed to `onFilterChange`.
13. **`clearFilters`** — reset `setRegionSearch("")`, `setRegionId(undefined)`, `setRegionName("")`.
14. **JSX** — add a Region search section inside the filter form, immediately above the Constellation section, following the exact same dropdown pattern:
    - Label: "Region"
    - Text input bound to `regionSearch` / `regionName`
    - Dropdown list rendered from `regionsData?.regions?.items`
    - Each item shows `region.name`
    - On select: set `regionId`, `regionName`, close dropdown
    - Clear button when `regionId` is set

### Layer 4 — Backend (verify only)

These are already implemented — confirm they exist, do not modify:
- `backend/src/schemas/KillmailFilter.graphql`: `regionId: Int` ✅
- `backend/src/resolvers/killmail/filters-materialized.ts`: `region_id = $N` condition ✅
- `backend/src/resolvers/killmail/queries.ts`: `args.filter?.regionId` in `hasKillmailFiltersCompatibleFilter` ✅

### Validation

After all changes:
1. Run `cd frontend && npm run codegen` (if not done yet).
2. Run `cd frontend && npm run build` and confirm no TypeScript errors.
3. Manually verify: navigate to a killmails page, open filters, type a region name, select it, and confirm the URL gets `?regionId=<id>` and the filter is applied.
