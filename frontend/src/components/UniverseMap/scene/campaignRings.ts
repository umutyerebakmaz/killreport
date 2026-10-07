import { RING_STROKE_PX, type RingMark } from '@/utils/map/campaignMarks';
import type { Graphics } from 'pixi.js';

/** `--color-accent` in globals.css: a timer that has not opened yet. */
export const RING_UPCOMING_TINT = 0x5ccbcb;

/** `--color-destroyed` (red-400) in globals.css: a timer that is live. */
export const RING_LIVE_TINT = 0xf87171;

/** Clears and redraws every ring. Positions are already in screen pixels. */
export function drawRings(target: Graphics, rings: readonly RingMark[]): void {
  target.clear();
  for (const ring of rings) {
    target.circle(ring.x, ring.y, ring.radius).stroke({
      width: RING_STROKE_PX,
      color: ring.live ? RING_LIVE_TINT : RING_UPCOMING_TINT,
      alpha: 1,
    });
  }
}
