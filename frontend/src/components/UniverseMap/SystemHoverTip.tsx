'use client';

import { clampOverlay } from '@/utils/map/overlay';
import { formatSecurityStatus, getSecurityColor } from '@/utils/security';

/** How far the tip's bottom edge clears the system's own disc. */
const TIP_GAP_PX = 12;

/**
 * Estimated rather than measured: the tip is one short line, and giving
 * `clampOverlay` a fixed size keeps the component from needing a layout pass to
 * know where to be.
 *
 * The estimate is load-bearing for the viewport clamp only. The tip has no
 * `width` of its own — it is as wide as the name inside it — so positioning its
 * LEFT edge from a guessed width would sit it off-centre by half the error, in
 * one direction for `Jita` and the other for `Sentinel MZ`. Its centre is placed
 * instead, and `-translate-x-1/2` does the rest at the real width, whatever that
 * turns out to be.
 */
const TIP_WIDTH_PX = 140;
const TIP_HEIGHT_PX = 24;

/**
 * The system under the cursor, in one line.
 *
 * Not `SecurityStatus`: that component wraps its value in a `Tooltip`, and a
 * tooltip inside a tooltip is not a thing. The two functions it formats with
 * are called directly here instead.
 */
export default function SystemHoverTip({
  name,
  securityStatus,
  screenX,
  screenY,
  anchorRadius,
  viewportWidth,
  viewportHeight,
}: {
  name: string;
  securityStatus: number | null;
  screenX: number;
  screenY: number;
  /** The system's drawn radius in pixels, which the tip opens clear of. */
  anchorRadius: number;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const box = clampOverlay({
    anchorX: screenX,
    anchorY: screenY,
    overlayWidth: TIP_WIDTH_PX,
    overlayHeight: TIP_HEIGHT_PX,
    viewportWidth,
    viewportHeight,
    offset: anchorRadius + TIP_GAP_PX,
    side: 'above',
  });

  // Back to the centre the clamp was derived from: `box.left` is that centre
  // minus half the estimated width, so adding it back gives the anchor's own x
  // in the common case and the clamped x near an edge.
  const centreX = box.left + TIP_WIDTH_PX / 2;

  return (
    <div
      // pointer-events-none is load-bearing: the tip sits just under the dot
      // the cursor is on, so without it a hover would put an element under the
      // pointer and the canvas would stop receiving the moves that placed it
      // there.
      className="absolute z-10 flex items-center px-2 py-1 text-xs -translate-x-1/2 float gap-x-2 pointer-events-none"
      style={{ left: centreX, top: box.top }}
    >
      <span className="text-gray-100">{name}</span>
      <span className={`font-medium ${getSecurityColor(securityStatus)}`}>
        {formatSecurityStatus(securityStatus)}
      </span>
    </div>
  );
}
