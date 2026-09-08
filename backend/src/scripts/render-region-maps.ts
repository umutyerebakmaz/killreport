/**
 * Generates a map SVG for each region and writes it to the frontend's static
 * directory.
 *
 * Run by hand, not a PM2 process: once after an SDE update.
 * See backend/docs/ops/region-map-images.md
 */

import { mkdir, writeFile } from 'node:fs/promises';
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

  console.log(
    `${files.length} regions written to ${OUT_DIR}\n` +
      `  ${dots} systems, ${edges} internal jumps, ${stubs} outbound gates` +
      (orphaned > 0
        ? `\n  ${orphaned} gates skipped: endpoint missing or unpositioned`
        : ''),
  );

  await prismaWorker.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prismaWorker.$disconnect();
  process.exit(1);
});
