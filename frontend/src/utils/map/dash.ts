import type { EdgeSegment } from './edges';

/**
 * The dash cell — one dash plus one gap — in world metres.
 *
 * World metres rather than screen pixels, and that is the whole design. A
 * screen-constant dash would have to be rebuilt every time the camera scale
 * moved, and `edgesGalaxy` is on screen from the galaxy fit (about zoom -50)
 * all the way to INTERIOR_ZOOM, 14 levels of it: at the top of that range the
 * median crossing is 113,000 px long, so holding the dash at 9 px would mean
 * cutting 1,285 lines into millions of pieces on a wheel tick. In world metres
 * the mesh is cut once and never touched again, which is the same bargain
 * `pixelLine: true` makes for the stroke width in scene/edges.ts.
 *
 * 1.5e15 measured against the data: the 370 region crossings run 5.1e15 m at
 * the 10th percentile to 7.4e16 at the 90th, so this gives them roughly 3 to
 * 49 dashes each and the dashed half of the mesh 7,751 pieces. It is one
 * constant and it is meant to be tuned by looking, the way the label
 * thresholds in lod.ts are.
 *
 * What it cannot do: at the fully zoomed-out galaxy view the median crossing
 * is 12 px long, so its dashes are sub-pixel and the line reads as a slightly
 * lighter one. The dashing opens up as the camera comes in.
 */
export const DASH_CELL_M = 1.5e15;

/** Gap as a fraction of the dash — 2:3 is a 60% duty cycle. */
export const DASH_GAP_RATIO = 2 / 3;

/**
 * Cuts one segment into dashes that begin and end on ink.
 *
 * n dashes and n-1 gaps, not n of each: a trailing gap would leave both ends
 * of the line short of the systems it connects, and on this map an endpoint is
 * either a system centre or a real stargate — a place, not a margin.
 *
 * The cell is snapped to the segment's own length (n is rounded, then the dash
 * is solved from it) so the pattern always divides the line exactly. Dash size
 * therefore varies by up to half a cell between one crossing and the next,
 * which is invisible, where a partial dash at one end would not be.
 */
export function dashSegment(
  segment: EdgeSegment,
  cell = DASH_CELL_M,
  gapRatio = DASH_GAP_RATIO,
): EdgeSegment[] {
  const dx = segment.to[0] - segment.from[0];
  const dz = segment.to[1] - segment.from[1];
  const length = Math.hypot(dx, dz);

  // Two systems at one point cannot happen in the data; a NaN here would take
  // the whole mesh down, so it is cheaper to answer than to assume.
  if (length === 0) return [segment];

  // Two is the floor rather than one: a single dash is a solid line that stops
  // early, which says nothing.
  const dashes = Math.max(2, Math.round(length / cell));
  const dash = length / (dashes + (dashes - 1) * gapRatio);
  const stride = dash * (1 + gapRatio);

  const at = (distance: number): [number, number] => [
    segment.from[0] + (dx * distance) / length,
    segment.from[1] + (dz * distance) / length,
  ];

  const pieces: EdgeSegment[] = [];
  for (let i = 0; i < dashes; i++) {
    const start = i * stride;
    pieces.push({ ...segment, from: at(start), to: at(start + dash) });
  }

  return pieces;
}

/**
 * The mesh in its two strokes: the edges that stay inside a region, and the
 * dash pieces of the ones that leave it.
 *
 * Split here rather than in the scene so the one decision that governs what
 * the map says can be read and tested without a canvas.
 */
export function splitDashed(segments: EdgeSegment[]): {
  solid: EdgeSegment[];
  dashed: EdgeSegment[];
} {
  const solid: EdgeSegment[] = [];
  const dashed: EdgeSegment[] = [];

  for (const segment of segments) {
    if (segment.crossesRegion) dashed.push(...dashSegment(segment));
    else solid.push(segment);
  }

  return { solid, dashed };
}
