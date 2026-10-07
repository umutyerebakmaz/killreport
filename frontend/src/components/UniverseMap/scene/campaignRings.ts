import {
  RING_STROKE_PX,
  ringArcs,
  type RingMark,
} from '@/utils/map/campaignMarks';
import type { Graphics } from 'pixi.js';

/**
 * `--color-destroyed` in globals.css, EVE's red — the same ink the sidebar's
 * attacker names take. Every ring, opened or not: the spin is what marks a
 * campaign on the map, and the panel and the popup say whether it is live.
 */
export const RING_TINT = 0xfe3743;

/**
 * Clears and redraws every ring as its arcs, turned by `angle` (radians,
 * clockwise on screen). Positions are already in screen pixels.
 *
 * Each arc opens its own subpath with a `moveTo` to its start: without it the
 * path would carry on from the previous arc's end and draw the gap shut.
 */
export function drawRings(
  target: Graphics,
  rings: readonly RingMark[],
  angle: number,
): void {
  target.clear();
  const arcs = ringArcs(angle);
  for (const ring of rings) {
    for (const { start, end } of arcs) {
      target
        .moveTo(
          ring.x + ring.radius * Math.cos(start),
          ring.y + ring.radius * Math.sin(start),
        )
        .arc(ring.x, ring.y, ring.radius, start, end);
    }
    target.stroke({
      width: RING_STROKE_PX,
      color: RING_TINT,
      alpha: 1,
    });
  }
}
