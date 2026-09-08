/**
 * Generates a map SVG for each region and writes it to the frontend's static
 * directory.
 *
 * Run by hand, not a PM2 process: once after an SDE update.
 * See backend/docs/ops/region-map-images.md
 */

import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prismaWorker from '@services/prisma-worker';
import { MapGate, MapJump, MapSystem, renderRegionMap } from './region-map-svg';

// backend is CommonJS (no "type": "module"), so __dirname is the way here —
// import.meta.url is not available. From src/scripts that is three levels up.
const OUT_DIR = join(__dirname, '../../../frontend/public/images/regions');

interface SystemRow {
  region_id: number;
  system_id: number;
  position_x: number;
  position_z: number;
  security_status: number | null;
}

interface GateRow {
  solar_system_id: number;
  destination_system_id: number;
}

async function main(): Promise<void> {
  const systems = await prismaWorker.$queryRaw<SystemRow[]>`
    SELECT c.region_id, s.system_id, s.position_x, s.position_z, s.security_status
    FROM solar_systems s
    JOIN constellations c ON c.constellation_id = s.constellation_id
    WHERE s.position_x IS NOT NULL AND s.position_z IS NOT NULL
      AND c.region_id IS NOT NULL`;

  const gates = await prismaWorker.$queryRaw<GateRow[]>`
    SELECT solar_system_id, destination_system_id
    FROM stargates
    WHERE destination_system_id IS NOT NULL`;

  const regionOf = new Map<number, number>();
  const coordOf = new Map<number, { x: number; z: number }>();
  const byRegion = new Map<number, MapSystem[]>();

  for (const row of systems) {
    regionOf.set(row.system_id, row.region_id);
    coordOf.set(row.system_id, { x: row.position_x, z: row.position_z });
    const list = byRegion.get(row.region_id) ?? [];
    list.push({
      id: row.system_id,
      x: row.position_x,
      z: row.position_z,
      security: row.security_status,
    });
    byRegion.set(row.region_id, list);
  }

  const jumpsOf = new Map<number, MapJump[]>();
  const gatesOf = new Map<number, MapGate[]>();
  let orphaned = 0;

  for (const gate of gates) {
    const from = regionOf.get(gate.solar_system_id);
    const to = regionOf.get(gate.destination_system_id);
    const destination = coordOf.get(gate.destination_system_id);
    if (from === undefined || to === undefined || !destination) {
      orphaned += 1;
      continue;
    }
    if (from === to) {
      const list = jumpsOf.get(from) ?? [];
      list.push({
        fromId: gate.solar_system_id,
        toId: gate.destination_system_id,
      });
      jumpsOf.set(from, list);
    } else {
      const list = gatesOf.get(from) ?? [];
      list.push({
        fromId: gate.solar_system_id,
        toX: destination.x,
        toZ: destination.z,
      });
      gatesOf.set(from, list);
    }
  }

  await mkdir(OUT_DIR, { recursive: true });

  // All maps are generated in memory first: an interrupted run should not leave a partial set on disk.
  const files = [...byRegion.entries()].map(([regionId, regionSystems]) => ({
    path: join(OUT_DIR, `${regionId}.svg`),
    svg: renderRegionMap({
      systems: regionSystems,
      jumps: jumpsOf.get(regionId) ?? [],
      gates: gatesOf.get(regionId) ?? [],
    }),
  }));

  await Promise.all(
    files.map((file) => writeFile(file.path, file.svg, 'utf8')),
  );

  const dots = files.reduce(
    (sum, f) => sum + (f.svg.match(/<circle/g) ?? []).length,
    0,
  );
  const edges = files.reduce(
    (sum, f) => sum + (f.svg.match(/#94a3b8/g) ?? []).length,
    0,
  );
  const stubs = files.reduce(
    (sum, f) => sum + (f.svg.match(/#4CC94C/g) ?? []).length,
    0,
  );

  // Reconcile the directory: a region retired (or renumbered) since the last
  // run leaves a stale file that this pass did not write. A region id is only
  // ever reused for a different region, never revived for the same one, so a
  // stale file is not just outdated — it can silently show the wrong region's
  // map. Only ever remove `<digits>.svg` in this one directory; anything else
  // (a dotfile, a directory, a name that doesn't parse as a region id) is left
  // alone.
  const renderedIds = new Set(byRegion.keys());
  const existing = await readdir(OUT_DIR);
  const removable = existing.filter((name) => {
    const match = /^(\d+)\.svg$/.exec(name);
    return match !== null && !renderedIds.has(Number(match[1]));
  });

  // Guard against a botched query silently emptying the region set. If the
  // systems query returns zero rows, or far fewer than it should (wrong
  // database, an empty table after a bad restore, a broken WHERE clause),
  // `byRegion` ends up empty or tiny, `renderedIds` follows it, and the
  // reconciliation above would then delete most or all of the 114 committed
  // SVGs — reporting that deletion as a success line. A real SDE update
  // retires a region or two at a time, never a large share of the committed
  // set, so refuse to delete when nothing was rendered at all, or when what
  // we are about to remove is a large fraction of what is already on disk.
  // This only skips the deletion step; the files rendered above are still
  // written either way.
  const MAX_REMOVAL_FRACTION = 0.25;
  const reconciliationLooksUnsafe =
    files.length === 0 ||
    (existing.length > 0 &&
      removable.length / existing.length > MAX_REMOVAL_FRACTION);

  let reconciliationLine: string;
  if (reconciliationLooksUnsafe) {
    reconciliationLine =
      removable.length > 0
        ? `\n  reconciliation skipped: would remove ${removable.length} of ` +
          `${existing.length} files on disk — this looks like an incomplete ` +
          `query, not retired regions. Check the database before re-running.`
        : '\n  0 stale files removed';
  } else {
    await Promise.all(removable.map((name) => unlink(join(OUT_DIR, name))));
    reconciliationLine =
      removable.length > 0
        ? `\n  ${removable.length} stale files removed: ${removable.join(', ')}`
        : '\n  0 stale files removed';
  }

  console.log(
    `${files.length} regions written to ${OUT_DIR}\n` +
      `  ${dots} systems, ${edges} internal jumps, ${stubs} outbound gates` +
      (orphaned > 0
        ? `\n  ${orphaned} gates skipped: endpoint missing or unpositioned`
        : '') +
      reconciliationLine,
  );

  await prismaWorker.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prismaWorker.$disconnect();
  process.exit(1);
});
