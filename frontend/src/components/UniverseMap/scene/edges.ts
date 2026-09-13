import { GATE_ALPHA, GATE_TINT } from '@/utils/map/colors';
import type { EdgeSegment } from '@/utils/map/edges';
import type { MapOrigin } from '@/utils/map/origin';
import type { Graphics } from 'pixi.js';

/**
 * Builds one Graphics from segments that are already origin-local.
 *
 * `pixelLine: true` is what makes this a build-once job: the stroke stays one
 * pixel whatever the camera scale, so the geometry is never rebuilt on a zoom.
 * Expressing the width in world units instead would mean redrawing all 6,959
 * segments on every wheel tick.
 *
 * The Graphics is positioned at the origin, so its float32 vertices stay
 * origin-local while the large offset rides in the float64 transform.
 */
export function drawEdges(
  target: Graphics,
  segments: EdgeSegment[],
  origin: MapOrigin,
): void {
  target.clear();
  target.position.set(origin.x, origin.z);

  for (const segment of segments) {
    target.moveTo(segment.from[0], segment.from[1]);
    target.lineTo(segment.to[0], segment.to[1]);
  }

  target.stroke({
    width: 1,
    pixelLine: true,
    color: GATE_TINT,
    alpha: GATE_ALPHA,
  });
}
