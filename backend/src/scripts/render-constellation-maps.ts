/**
 * Generates a map SVG for each constellation and writes it to the frontend's
 * static directory.
 *
 * Run by hand, not a PM2 process: once after an SDE update.
 * See backend/docs/ops/star-map-images.md
 */

import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prismaWorker from '@services/prisma-worker';
import {
  CONSTELLATION_PALETTE,
  MapGate,
  MapJump,
  MapSystem,
  renderStarMap,
} from './star-map-svg';

// backend is CommonJS (no "type": "module"), so __dirname is the way here —
// import.meta.url is not available. From src/scripts that is three levels up.
const OUT_DIR = join(
  __dirname,
  '../../../frontend/public/images/constellations',
);

interface SystemRow {
  constellation_id: number;
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
  // No join to constellations here: solar_systems carries constellation_id
  // directly, which is one level shallower than the region script needs.
  const systems = await prismaWorker.$queryRaw<SystemRow[]>`
    SELECT s.constellation_id, s.system_id, s.position_x, s.position_z, s.security_status
    FROM solar_systems s
    WHERE s.position_x IS NOT NULL AND s.position_z IS NOT NULL
      AND s.constellation_id IS NOT NULL`;

  const gates = await prismaWorker.$queryRaw<GateRow[]>`
    SELECT solar_system_id, destination_system_id
    FROM stargates
    WHERE destination_system_id IS NOT NULL`;

  const constellationOf = new Map<number, number>();
  const coordOf = new Map<number, { x: number; z: number }>();
  const byConstellation = new Map<number, MapSystem[]>();

  for (const row of systems) {
    constellationOf.set(row.system_id, row.constellation_id);
    coordOf.set(row.system_id, { x: row.position_x, z: row.position_z });
    const list = byConstellation.get(row.constellation_id) ?? [];
    list.push({
      id: row.system_id,
      x: row.position_x,
      z: row.position_z,
      security: row.security_status,
    });
    byConstellation.set(row.constellation_id, list);
  }

  const jumpsOf = new Map<number, MapJump[]>();
  const gatesOf = new Map<number, MapGate[]>();
  let orphaned = 0;

  for (const gate of gates) {
    const from = constellationOf.get(gate.solar_system_id);
    const to = constellationOf.get(gate.destination_system_id);
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
  const files = [...byConstellation.entries()].map(
    ([constellationId, constellationSystems]) => ({
      path: join(OUT_DIR, `${constellationId}.svg`),
      svg: renderStarMap(
        {
          systems: constellationSystems,
          jumps: jumpsOf.get(constellationId) ?? [],
          gates: gatesOf.get(constellationId) ?? [],
        },
        CONSTELLATION_PALETTE,
      ),
    }),
  );

  await Promise.all(
    files.map((file) => writeFile(file.path, file.svg, 'utf8')),
  );

  // Counted off the palette rather than a literal, so a palette change cannot
  // silently turn these totals into zero.
  const occurrences = (svg: string, needle: string) =>
    svg.split(needle).length - 1;
  const dots = files.reduce((sum, f) => sum + occurrences(f.svg, '<circle'), 0);
  const edges = files.reduce(
    (sum, f) => sum + occurrences(f.svg, CONSTELLATION_PALETTE.jump),
    0,
  );
  const stubs = files.reduce(
    (sum, f) => sum + occurrences(f.svg, CONSTELLATION_PALETTE.gate),
    0,
  );

  // Reconcile the directory: a constellation retired (or renumbered) since the
  // last run leaves a stale file that this pass did not write. A constellation
  // id is only ever reused for a different constellation, never revived for the
  // same one, so a stale file is not just outdated — it can silently show the
  // wrong constellation's map. Only ever remove `<digits>.svg` in this one
  // directory; anything else is left alone.
  const renderedIds = new Set(byConstellation.keys());
  const existing = await readdir(OUT_DIR);
  const removable = existing.filter((name) => {
    const match = /^(\d+)\.svg$/.exec(name);
    return match !== null && !renderedIds.has(Number(match[1]));
  });

  // Guard against a botched query silently emptying the constellation set.
  // With 1,184 committed files this matters more than it does for 114 regions:
  // a broken WHERE clause would report deleting most of the set as a success
  // line. A real SDE update retires one or two at a time, never a large share.
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
          `query, not retired constellations. Check the database before re-running.`
        : '\n  0 stale files removed';
  } else {
    await Promise.all(removable.map((name) => unlink(join(OUT_DIR, name))));
    reconciliationLine =
      removable.length > 0
        ? `\n  ${removable.length} stale files removed: ${removable.join(', ')}`
        : '\n  0 stale files removed';
  }

  console.log(
    `${files.length} constellations written to ${OUT_DIR}\n` +
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
