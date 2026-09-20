import {
  GATE_ALPHA,
  GATE_TINT,
  HIGHLIGHT_ALPHA,
  HIGHLIGHT_TINT,
} from '@/utils/map/colors';
import { splitDashed } from '@/utils/map/dash';
import type { EdgeSegment } from '@/utils/map/edges';
import type { EdgeGroup } from '@/utils/map/layers';
import type { MapOrigin } from '@/utils/map/origin';
import type { Graphics } from 'pixi.js';

/** One stroke's worth of path, laid down and closed with one style. */
function strokeAll(
  target: Graphics,
  segments: EdgeSegment[],
  color: number,
  alpha: number,
): void {
  if (segments.length === 0) return;

  for (const segment of segments) {
    target.moveTo(segment.from[0], segment.from[1]);
    target.lineTo(segment.to[0], segment.to[1]);
  }

  target.stroke({ width: 1, pixelLine: true, color, alpha });
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
  strokeAll(target, solid, GATE_TINT, GATE_ALPHA);
  strokeAll(target, dashed, GATE_TINT, GATE_ALPHA);
}

/**
 * The galaxy mesh when the layer colours it.
 *
 * `drawEdges` stays as it is for the local mesh and this takes over the galaxy
 * one: the two differ only in how many styles the path is laid down in, and a
 * one-group call here is `drawEdges` exactly.
 *
 * Each group is laid down twice for the same reason `drawEdges` is — the
 * solid pieces and the dashes a region crossing was cut into share every part
 * of their style but the dashing — and `strokeAll` returns early on an empty
 * list, so a group with no crossings costs one call and no path.
 */
export function drawEdgeGroups(
  target: Graphics,
  groups: EdgeGroup[],
  origin: MapOrigin,
): void {
  target.clear();
  target.position.set(origin.x, origin.z);

  for (const group of groups) {
    const colour = group.tint ?? GATE_TINT;
    const { solid, dashed } = splitDashed(group.segments);
    strokeAll(target, solid, colour, GATE_ALPHA);
    strokeAll(target, dashed, colour, GATE_ALPHA);
  }
}

/**
 * The hovered region's own mesh, lifted out of the galaxy one it is drawn over.
 *
 * Its own Graphics rather than a third stroke on the galaxy mesh: a hover
 * changes several times a second, and rebuilding 14,400 segments for each one
 * would throw away the build-once property `drawEdges` exists to hold. What is
 * rebuilt here is one region's edges — 99 on average and 260 at the busiest,
 * which is a fiftieth of the mesh.
 *
 * `regionSegments` has already dropped the edges that leave the region, so
 * nothing this draws is dashed; it goes through `splitDashed` anyway rather
 * than assuming that, because the day the filter changes is the day an
 * unsplit crossing would be drawn solid and lit with no test to catch it.
 *
 * An empty list clears, which is how a pointer leaving a name is drawn.
 */
export function drawHighlight(
  target: Graphics,
  segments: EdgeSegment[],
  origin: MapOrigin,
): void {
  target.clear();
  target.position.set(origin.x, origin.z);

  const { solid, dashed } = splitDashed(segments);
  strokeAll(target, solid, HIGHLIGHT_TINT, HIGHLIGHT_ALPHA);
  strokeAll(target, dashed, HIGHLIGHT_TINT, HIGHLIGHT_ALPHA);
}
