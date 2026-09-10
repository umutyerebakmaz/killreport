/**
 * Generates an orbital diagram SVG for each solar system and writes it to the
 * frontend's static directory.
 *
 * Run by hand, not a PM2 process: once after an SDE update.
 * See backend/docs/ops/star-map-images.md
 */

import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prismaWorker from '@services/prisma-worker';
import { MapPlanet, renderSolarSystemMap } from './solar-system-map-svg';

// backend is CommonJS (no "type": "module"), so __dirname is the way here —
// import.meta.url is not available. From src/scripts that is three levels up.
const OUT_DIR = join(
  __dirname,
  '../../../frontend/public/images/solar-systems',
);

interface PlanetRow {
  solar_system_id: number;
  planet_id: number;
  position_x: number;
  position_z: number;
  type_id: number | null;
}

interface StarRow {
  solar_system_id: number;
  spectral_class: string | null;
}

async function main(): Promise<void> {
  // Ordered by orbit_index so a diff between two runs is stable. The drawing
  // sorts its own rings, but the planet dots come out in query order.
  const planets = await prismaWorker.$queryRaw<PlanetRow[]>`
    SELECT solar_system_id, planet_id, position_x, position_z, type_id
    FROM planets
    WHERE position_x IS NOT NULL AND position_z IS NOT NULL
    ORDER BY solar_system_id, orbit_index, planet_id`;

  const stars = await prismaWorker.$queryRaw<StarRow[]>`
    SELECT solar_system_id, spectral_class FROM stars`;

  const planetsOf = new Map<number, MapPlanet[]>();
  for (const row of planets) {
    const list = planetsOf.get(row.solar_system_id) ?? [];
    list.push({
      id: row.planet_id,
      x: row.position_x,
      z: row.position_z,
      typeId: row.type_id,
    });
    planetsOf.set(row.solar_system_id, list);
  }

  const starOf = new Map<number, { spectralClass: string | null }>();
  for (const row of stars) {
    starOf.set(row.solar_system_id, { spectralClass: row.spectral_class });
  }

  // The set of systems worth drawing is the union of the two: everything with
  // a star, everything with a planet. A system with neither — 200 abyssal,
  // 200 void and GPMS-01 — gets no file at all rather than an empty SVG;
  // SolarSystemMap removes itself when the file is missing.
  const systemIds = [...new Set([...starOf.keys(), ...planetsOf.keys()])].sort(
    (a, b) => a - b,
  );

  await mkdir(OUT_DIR, { recursive: true });

  // All maps are generated in memory first: an interrupted run should not
  // leave a partial set on disk.
  const files = systemIds.map((systemId) => ({
    path: join(OUT_DIR, `${systemId}.svg`),
    svg: renderSolarSystemMap({
      star: starOf.get(systemId) ?? null,
      planets: planetsOf.get(systemId) ?? [],
    }),
  }));

  await Promise.all(
    files.map((file) => writeFile(file.path, file.svg, 'utf8')),
  );

  const occurrences = (svg: string, needle: string) =>
    svg.split(needle).length - 1;
  const planetDots = files.reduce(
    (sum, f) => sum + occurrences(f.svg, 'r="1.6"'),
    0,
  );
  const starDots = files.reduce(
    (sum, f) => sum + occurrences(f.svg, 'r="2.6"'),
    0,
  );

  // Reconcile the directory: a system retired (or renumbered) since the last
  // run leaves a stale file that this pass did not write. A system id is only
  // ever reused for a different system, never revived for the same one, so a
  // stale file is not just outdated — it can silently show the wrong system's
  // map. Only ever remove `<digits>.svg` in this one directory; anything else
  // is left alone.
  const renderedIds = new Set(systemIds);
  const existing = await readdir(OUT_DIR);
  const removable = existing.filter((name) => {
    const match = /^(\d+)\.svg$/.exec(name);
    return match !== null && !renderedIds.has(Number(match[1]));
  });

  // Guard against a botched query silently emptying the set. With 8,089
  // committed files this matters more than it does for 1,184 constellations or
  // 114 regions: a broken WHERE clause would report deleting most of the set
  // as a success line. A real SDE update retires one or two at a time, never a
  // large share. This only skips the deletion step; the files rendered above
  // are still written either way.
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
          `query, not retired systems. Check the database before re-running.`
        : '\n  0 stale files removed';
  } else {
    await Promise.all(removable.map((name) => unlink(join(OUT_DIR, name))));
    reconciliationLine =
      removable.length > 0
        ? `\n  ${removable.length} stale files removed: ${removable.join(', ')}`
        : '\n  0 stale files removed';
  }

  const total = await prismaWorker.solarSystem.count();
  const skipped = total - files.length;

  console.log(
    `${files.length} solar systems written to ${OUT_DIR}\n` +
      `  ${planetDots} planets, ${starDots} stars` +
      (skipped > 0
        ? `\n  ${skipped} systems skipped: no star and no planet`
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
