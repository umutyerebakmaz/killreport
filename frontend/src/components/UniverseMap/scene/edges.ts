import { GATE_ALPHA, GATE_TINT } from '@/utils/map/colors';
import { splitDashed } from '@/utils/map/dash';
import type { EdgeSegment } from '@/utils/map/edges';
import type { MapOrigin } from '@/utils/map/origin';
import type { Graphics } from 'pixi.js';

/** One stroke's worth of path, laid down and closed with the shared style. */
function strokeAll(target: Graphics, segments: EdgeSegment[]): void {
  if (segments.length === 0) return;

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

/**
 * Builds one Graphics from segments that are already origin-local.
 *
 * `pixelLine: true` is what makes this a build-once job: the stroke stays one
 * pixel whatever the camera scale, so the geometry is never rebuilt on a zoom.
 * Expressing the width in world units instead would mean redrawing all 6,959
 * segments on every wheel tick.
 *
 * Two strokes on the one Graphics, not two Graphics: an edge that leaves its
 * region is laid down as the dash pieces `splitDashed` cuts it into, and the
 * pieces are ordinary segments by the time they arrive here. Both passes carry
 * the same colour, alpha and pixel width — the dashes are the whole of the
 * difference — and both are cut in world metres, so the zoom still touches
 * nothing. The mesh grows from 6,989 segments to about 14,400.
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

  const { solid, dashed } = splitDashed(segments);
  strokeAll(target, solid);
  strokeAll(target, dashed);
}
