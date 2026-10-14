/**
 * The map's Redis keys, in a module with no Prisma import.
 *
 * The SDE import script deletes these by name after it writes, and it runs on
 * the worker client: importing them from the services would construct the
 * API's Prisma client in a worker process.
 */
import type { MapLabelKind } from './map-labels.service';
import type { MapProjection, MapScope } from './universe-map.service';

export function geometryCacheKey(
  scope: MapScope,
  projection: MapProjection,
): string {
  return `map:geometry:${scope}:${projection}`;
}

/**
 * `v3` because the key grew a projection. Without the bump a deploy would keep
 * serving yesterday's `v2` rows, which are galactic, under a schematic request
 * for up to a day.
 */
export function labelsCacheKey(
  scope: MapScope,
  kind: MapLabelKind,
  projection: MapProjection,
): string {
  return `map:labels:v3:${scope}:${kind}:${projection}`;
}
