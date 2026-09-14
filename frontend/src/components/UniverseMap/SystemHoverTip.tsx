'use client';

import { clampOverlay } from '@/utils/map/overlay';
import { formatSecurityStatus, getSecurityColor } from '@/utils/security';

/** Enough to clear the cursor without drifting away from the dot. */
const TIP_OFFSET_PX = 12;

/**
 * Estimated rather than measured: the tip is one short line, and giving
 * `clampOverlay` a fixed size keeps the component from needing a layout pass to
 * know where to be. A long system name overhangs by a few pixels at the right
 * edge; the popup, which is the thing that must not be clipped, gets the same
 * treatment but with room to spare.
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
  viewportWidth,
  viewportHeight,
}: {
  name: string;
  securityStatus: number | null;
  screenX: number;
  screenY: number;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const { left, top } = clampOverlay({
    anchorX: screenX,
    anchorY: screenY,
    overlayWidth: TIP_WIDTH_PX,
    overlayHeight: TIP_HEIGHT_PX,
    viewportWidth,
    viewportHeight,
    offset: TIP_OFFSET_PX,
  });

  return (
    <div
      // pointer-events-none is load-bearing: the tip follows the cursor, so
      // without it every hover would put an element under the pointer and the
      // canvas would stop receiving the moves that placed it there.
      className="absolute z-10 flex items-center px-2 py-1 text-xs float gap-x-2 pointer-events-none"
      style={{ left, top }}
    >
      <span className="text-gray-100">{name}</span>
      <span className={`font-medium ${getSecurityColor(securityStatus)}`}>
        {formatSecurityStatus(securityStatus)}
      </span>
    </div>
  );
}
