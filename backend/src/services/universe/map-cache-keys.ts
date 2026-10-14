/**
 * The map's Redis keys, in a module with no Prisma import.
 *
 * The SDE import script deletes these by name after it writes, and it runs on
 * the worker client: importing them from the services would construct the
 * API's Prisma client in a worker process.
 */
import type { MapProjection, MapScope } from './universe-map.service';

export function geometryCacheKey(
  scope: MapScope,
  projection: MapProjection,
): string {
  return `map:geometry:${scope}:${projection}`;
}
