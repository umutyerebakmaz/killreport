import { Prisma } from '@generated/prisma/client';
import prisma from '@services/prisma';
import redis from '@services/redis';
import {
  gatelessFilter,
  scopePredicate,
  type MapScope,
} from './universe-map.service';

export type MapLabelKind = 'REGION' | 'CONSTELLATION';

export interface MapLabelBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MapLabel {
  id: number;
  name: string;
  kind: MapLabelKind;
  x: number;
  z: number;
  /** REGION only: the medoid the name is anchored to. Null on a constellation. */
  systemId: number | null;
  /** REGION only: the extent of the region's drawn systems. Null otherwise. */
  bounds: MapLabelBounds | null;
}

/** Static universe data, same as the geometry it sits beside. */
export const LABELS_CACHE_TTL_SECONDS = 86400;

/**
 * `v2` because the region row grew a medoid and an extent. Without the bump a
 * deploy would keep serving yesterday's shape — no bounds, no systemId — for up
 * to LABELS_CACHE_TTL_SECONDS, and the client would hide every region name
 * because none of them would pass the fit rule.
 */
export function labelsCacheKey(scope: MapScope, kind: MapLabelKind): string {
  return `map:labels:v2:${scope}:${kind}`;
}

interface LabelRow {
  id: number;
  name: string;
  x: number;
  z: number;
  system_id?: number | null;
  min_x?: number | null;
  max_x?: number | null;
  min_z?: number | null;
  max_z?: number | null;
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

  // A region has a name and nothing else, so both the anchor and the extent are
  // derived from the systems this scene actually draws.
  //
  // The anchor is the MEDOID — the region's own system whose total distance to
  // the others is smallest — not the mean position. A mean can land outside a
  // concave region: measured 2026-09-15 across all 114 regions in the database,
  // 12 of them had the star nearest their centroid belonging to a DIFFERENT
  // region, Delve and The Citadel among them. A medoid is by definition one of
  // the region's own stars, so that failure stops being possible rather than
  // merely rare.
  //
  // The 191 ms measured then is likewise the whole-database figure. One call
  // here covers a single scope — 67 regions for NEW_EDEN, fewer elsewhere — and
  // it is paid once per LABELS_CACHE_TTL_SECONDS either way.
  //
  // LEFT JOIN, not JOIN: three regions hold exactly one system, and an inner
  // join would produce no pair for them and drop their names off the map
  // entirely. COALESCE gives the lone system a total distance of 0, which makes
  // it its own medoid.
  //
  // `a.system_id` last in the ORDER BY is not decoration. For a two-system
  // region the tie is guaranteed: power(a.x - b.x, 2) and power(b.x - a.x, 2)
  // are bit-identical, so both systems sum to the same single term and
  // DISTINCT ON would keep whichever the plan emitted first — a name that
  // jumps between two stars on each 24-hour rebuild with nothing in the code
  // to explain why.
  return Prisma.sql`
    WITH scene AS (
      SELECT r.region_id, r.name, s.system_id,
             s.position_x AS x, s.position_z AS z
      FROM regions r
      JOIN constellations c ON c.region_id = r.region_id
      JOIN solar_systems s ON s.constellation_id = c.constellation_id
      WHERE ${scene}
        AND s.position_x IS NOT NULL AND s.position_z IS NOT NULL
        ${gateless}
    ),
    extent AS (
      SELECT region_id, name,
             MIN(x) AS min_x, MAX(x) AS max_x,
             MIN(z) AS min_z, MAX(z) AS max_z
      FROM scene
      GROUP BY region_id, name
    ),
    medoid AS (
      SELECT DISTINCT ON (a.region_id)
             a.region_id, a.system_id, a.x, a.z
      FROM scene a
      LEFT JOIN scene b
        ON b.region_id = a.region_id AND b.system_id <> a.system_id
      GROUP BY a.region_id, a.system_id, a.x, a.z
      ORDER BY a.region_id,
               COALESCE(SUM(sqrt(power(a.x - b.x, 2) + power(a.z - b.z, 2))), 0),
               a.system_id
    )
    SELECT e.region_id AS id, e.name, m.system_id, m.x, m.z,
           e.min_x, e.max_x, e.min_z, e.max_z
    FROM extent e
    JOIN medoid m ON m.region_id = e.region_id
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
    // Null rather than undefined: this object is what JSON.stringify writes into
    // Redis, and an undefined field would simply vanish from the cached row.
    systemId: row.system_id == null ? null : Number(row.system_id),
    bounds:
      row.min_x == null
        ? null
        : {
            minX: Number(row.min_x),
            maxX: Number(row.max_x),
            minZ: Number(row.min_z),
            maxZ: Number(row.max_z),
          },
  }));

  // Cached even when empty: an empty scene is a fact, not a miss, and
  // re-querying it every request would be a slow way to learn nothing.
  await redis.setex(key, LABELS_CACHE_TTL_SECONDS, JSON.stringify(labels));
  return labels;
}
