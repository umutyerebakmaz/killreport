export interface OverlayBox {
  left: number;
  top: number;
}

/**
 * Where a floating overlay goes, given the thing it belongs to.
 *
 * Down and to the right of the anchor by `offset`, flipping to the other side
 * of the anchor on either axis when that edge would be crossed — so a system
 * near the right edge of the canvas opens its popup to the left, and one near
 * the bottom opens upward. The flip is per-axis: a corner flips both.
 *
 * Pinned to zero as a last resort, for a viewport too small to hold the overlay
 * on either side. Off-screen would be worse than overlapping.
 *
 * One function for the hover tip and the popup both: it is the same decision,
 * and it IS a decision, so it belongs in the tested layer rather than in two
 * components' style attributes.
 */
export function clampOverlay({
  anchorX,
  anchorY,
  overlayWidth,
  overlayHeight,
  viewportWidth,
  viewportHeight,
  offset,
}: {
  anchorX: number;
  anchorY: number;
  overlayWidth: number;
  overlayHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offset: number;
}): OverlayBox {
  let left = anchorX + offset;
  if (left + overlayWidth > viewportWidth) {
    left = anchorX - offset - overlayWidth;
  }

  let top = anchorY + offset;
  if (top + overlayHeight > viewportHeight) {
    top = anchorY - offset - overlayHeight;
  }

  return { left: Math.max(left, 0), top: Math.max(top, 0) };
}
