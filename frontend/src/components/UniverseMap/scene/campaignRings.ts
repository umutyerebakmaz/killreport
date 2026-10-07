import {
  RING_STROKE_PX,
  ringArcs,
  type RingMark,
} from '@/utils/map/campaignMarks';
import type { Graphics } from 'pixi.js';

/**
 * `--color-ink-muted` in globals.css: a timer that has not opened yet. The
 * map's neutral light ink, so only a live timer carries a colour.
 */
export const RING_UPCOMING_TINT = 0xb0b0b0;

/** `--color-destroyed` (red-400) in globals.css: a timer that is live. */
export const RING_LIVE_TINT = 0xf87171;

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
      color: ring.live ? RING_LIVE_TINT : RING_UPCOMING_TINT,
      alpha: 1,
    });
  }
}
