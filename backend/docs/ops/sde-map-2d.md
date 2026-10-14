# Importing the Schematic Map Layout from the SDE

Runbook for filling `solar_systems.position_2d_x` / `position_2d_y`, the layout
`/map` opens on.

Static universe data is scheduled by neither PM2 nor the crontab. It is run by
hand and left alone — so this is the procedure. The script is
[`../../src/scripts/import-sde-map-2d.ts`](../../src/scripts/import-sde-map-2d.ts);
the design is in
[`../../../docs/superpowers/specs/2026-10-14-universe-map-schematic-design.md`](../../../docs/superpowers/specs/2026-10-14-universe-map-schematic-design.md).

Every command runs from the repo root unless it says otherwise.

---

## What the data is

The SCHEMATIC projection is CCP's own 2D map — the layout of the in-game 2D map,
not the systems' real positions seen from above. It exists only in CCP's Static
Data Export, as `position2D {x, y}` in `mapSolarSystems.jsonl`. ESI does not
serve it, so no worker can fetch it.

`yarn workspace backend sde:map-2d` downloads the latest JSONL archive from
`developers.eveonline.com`, pipes `mapSolarSystems.jsonl` into the script, and
the script writes the two columns:

- Only rows already in `solar_systems` are updated. The import never inserts a
  system; ESI's root scan does that.
- Only rows whose value changes are written, so a re-run writes just the new and
  moved systems and logs how many.
- Systems with no `position2D` — every wormhole, Abyssal and Proving system — are
  skipped. WORMHOLE scenes are always GALACTIC for that reason.

`worker-solar-systems` writes only ESI fields, so a fresh ESI scan never clears
the two columns.

---

## Deploy order

The order is not a preference.

```bash
# 1. The columns. migrate deploy applies pending migrations and drops nothing.
cd backend && npx prisma migrate deploy && cd ..

# 2. The data.
yarn workspace backend sde:map-2d

# 3. Only now: deploy the backend and the frontend.
```

Before step 2 every system's schematic position is `NULL`, so the SCHEMATIC
scene comes back empty — and SCHEMATIC is the layout `/map` opens on. Deploying
the code first opens the map on an empty scene for everyone until the import
runs. Step 1 has to come before step 2 because the import writes columns the
migration adds.

---

## Caches after an import

Two caches hold the map, and the import clears only one of them.

**Service keys — cleared by the import.** After writing, the script deletes by
name every key the map services can have written: `map:geometry:<scope>:<projection>`
and `map:labels:v3:<scope>:<kind>:<projection>`, for every scope, kind and
projection (`backend/src/services/universe/map-cache-keys.ts`). No pattern scan.

**GraphQL response cache — not cleared.** `MapGeometry` and `MapLabels` are
public queries whose `Query.mapGeometry` / `Query.mapLabels` coordinates are
cached for `CACHE_TTL.STATIC_GAME_DATA` — **365 days**
(`backend/src/config/cache.ts`). On a first deploy nothing is in it yet, so the
order above is enough. But an import that changed rows on a deployment that has
already served the map leaves the old responses in place for up to a year.

The response cache's own `invalidate` hook in
`backend/src/plugins/response-cache.plugin.ts` cannot help: it looks for keys
containing `<typename>:<id>`, and the response-cache keys are bare SHA-256
hashes of the document, variables and session, which contain neither. Nor can
the keys be recomputed by hand, because they hash the exact document text the
client sent.

What does identify an entry is its body: every cached map response starts with
`{"data":{"mapGeometry":` or `{"data":{"mapLabels":`. So walk the keyspace with
`SCAN` — cursor-based, never blocking the server the way `KEYS` does — and delete
only the hash-named keys whose body starts that way. Nothing belonging to another
application, or to another query of this one, is touched. From `backend/`:

```bash
REDIS_URL=$(grep -m1 '^REDIS_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")

redis-cli -u "$REDIS_URL" --scan | grep -E '^[0-9a-f]{64}$' | while read -r k; do
  case "$(redis-cli -u "$REDIS_URL" getrange "$k" 0 22)" in
    '{"data":{"mapGeometry":'* | '{"data":{"mapLabels":'*)
      redis-cli -u "$REDIS_URL" del "$k" ;;
  esac
done
```

Replace `del "$k"` with `echo "$k"` first to see what it would remove; locally
on 2026-10-14 that listed eight keys, all of them map responses. The URL carries
the logical database (`redis://…/1`), so the walk stays inside this checkout's
database.

Browsers need nothing: Apollo's `cache-and-network` refetches on the next visit.

---

## When to run it again

- **After an ESI root scan that added systems.** `yarn queue:solar-systems` and
  its worker insert new rows with no schematic position, and a system with no
  position is left out of the SCHEMATIC scene. Re-run the import after the scan
  (see [`universe-topology-run.md`](./universe-topology-run.md)), then clear the
  response cache as above.
- **After a new SDE build moves or adds systems.** Same two steps.

Never on a schedule: this is static data.

---

## Checking it

```bash
cd backend
DB=$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | tr -d "'")

psql "$DB" -c "SELECT
  COUNT(*)                                        AS systems,
  COUNT(*) FILTER (WHERE position_2d_x IS NULL)   AS without_2d
FROM solar_systems;"
```

`without_2d` should equal the number of wormhole, Abyssal and Proving systems
and nothing more. A New Eden or Pochven system in that count is one ESI added
after the last import — run it again.
