export interface OverlayBox {
  left: number;
  top: number;
}

function clampAxis(value: number, extent: number, viewport: number): number {
  // The upper bound first, then zero: for a viewport too small to hold the
  // overlay at all, `max` wins and the overlay is pinned rather than pushed off
  // the near edge. Off-screen would be worse than overlapping.
  return Math.max(Math.min(value, viewport - extent), 0);
}

/**
 * Where a floating overlay goes, given the system it belongs to.
 *
 * Centred across the anchor and `offset` clear beneath it. The click or the
 * hover already said which system this is about, so the overlay opens on that
 * spot rather than beside it — and beneath rather than over it, because the
 * thing it names has to stay visible.
 *
 * `offset` is the anchor's own drawn radius plus a gap, not a constant. The dots
 * grow with the camera and reach tens of pixels at the interior zooms, where a
 * fixed offset would put the overlay back on top of the system.
 *
 * Vertically it flips above at the bottom edge rather than sliding up: sliding
 * would return it over the anchor, which is the one thing this placement exists
 * to prevent. Horizontally it slides, where there is nothing to cover.
 *
 * Two other placements were written and removed. `beside` — down and to the
 * right, flipping at both edges — was the original, and it cost the eye a
 * journey from the thing it described. `centred`, which put the overlay's middle
 * on the anchor, hid the system it was about. Neither is worth keeping as an
 * option nobody passes.
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
  let top = anchorY + offset;
  if (top + overlayHeight > viewportHeight) {
    top = anchorY - offset - overlayHeight;
  }

  return {
    left: clampAxis(anchorX - overlayWidth / 2, overlayWidth, viewportWidth),
    top: Math.max(top, 0),
  };
}
