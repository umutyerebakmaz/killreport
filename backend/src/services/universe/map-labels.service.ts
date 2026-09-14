import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';
import {
  gatelessFilter,
  scopePredicate,
  type MapScope,
} from './universe-map.service';

export type MapLabelKind = 'REGION' | 'CONSTELLATION';

export interface MapLabel {
  id: number;
  name: string;
  kind: MapLabelKind;
  x: number;
  z: number;
}

/** Static universe data, same as the geometry it sits beside. */
export const LABELS_CACHE_TTL_SECONDS = 86400;

export function labelsCacheKey(scope: MapScope, kind: MapLabelKind): string {
  return `map:labels:${scope}:${kind}`;
}

interface LabelRow {
  id: number;
  name: string;
  x: number;
  z: number;
}

/**
 * The two tiers differ in one way that matters: a constellation already has a
 * position, and a region does not.
 *
 * Both queries go through the SAME scene predicate the geometry uses —
 * scopePredicate plus gatelessFilter — imported rather than copied. NEW_EDEN's
 * gateless filter drops 217 Jove systems; a label query that skipped it would
 * shift every region centroid and could list a constellation with no drawn
 * system under it.
 */
function labelQuery(scope: MapScope, kind: MapLabelKind): Prisma.Sql {
  const scene = scopePredicate(scope);
  const gateless = gatelessFilter(scope);

  if (kind === 'CONSTELLATION') {
    // Measured 2026-09-14: zero constellations have a null position, and a
    // constellation's own position sits within 0.23 ly of its members' centroid,
    // so it is used directly.
    return Prisma.sql`
      SELECT DISTINCT c.constellation_id AS id, c.name AS name,
             c.position_x AS x, c.position_z AS z
      FROM constellations c
      JOIN solar_systems s ON s.constellation_id = c.constellation_id
      WHERE ${scene}
        AND c.position_x IS NOT NULL AND c.position_z IS NOT NULL
        ${gateless}
      ORDER BY id
    `;
  }

  // A region has a name and nothing else. The centroid is the mean of the
  // systems this scene actually draws — the region's visual centre of mass.
  return Prisma.sql`
    SELECT r.region_id AS id, r.name AS name,
           AVG(s.position_x) AS x, AVG(s.position_z) AS z
    FROM regions r
    JOIN constellations c ON c.region_id = r.region_id
    JOIN solar_systems s ON s.constellation_id = c.constellation_id
    WHERE ${scene}
      AND s.position_x IS NOT NULL AND s.position_z IS NOT NULL
      ${gateless}
    GROUP BY r.region_id, r.name
    ORDER BY id
  `;
}

export async function getMapLabels(
  scope: MapScope,
  kind: MapLabelKind,
): Promise<MapLabel[]> {
  const key = labelsCacheKey(scope, kind);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as MapLabel[];

  const rows = await prisma.$queryRaw<LabelRow[]>(labelQuery(scope, kind));

  // The kind is stamped from the argument, not read from the row: it is the
  // thing the cache key was built on, and a row that carried its own could
  // disagree with the key it is stored under.
  const labels: MapLabel[] = rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    kind,
    x: Number(row.x),
    z: Number(row.z),
  }));

  // Cached even when empty: an empty scene is a fact, not a miss, and
  // re-querying it every request would be a slow way to learn nothing.
  await redis.setex(key, LABELS_CACHE_TTL_SECONDS, JSON.stringify(labels));
  return labels;
}
