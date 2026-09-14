export interface OverlayBox {
  left: number;
  top: number;
}

/**
 * Where a floating overlay sits relative to its anchor.
 *
 * `beside` is for something that follows the cursor: it must not sit under the
 * pointer, so it goes down and to the right and flips at an edge.
 *
 * `centred` is for something the anchor is the subject of. There is no flip —
 * there is no other side to go to — so it clamps against both edges instead.
 */
export type OverlayPlacement = 'beside' | 'centred';

function clampAxis(value: number, extent: number, viewport: number): number {
  // The upper bound first, then zero: for a viewport too small to hold the
  // overlay at all, `max` wins and the overlay is pinned rather than pushed off
  // the near edge. Off-screen would be worse than overlapping.
  return Math.max(Math.min(value, viewport - extent), 0);
}

/**
 * Where a floating overlay goes, given the thing it belongs to.
 *
 * `beside`, the default, puts it down and to the right of the anchor by
 * `offset`, flipping to the other side on either axis when that edge would be
 * crossed — so a system near the right edge of the canvas opens to the left, and
 * one near the bottom opens upward. The flip is per-axis: a corner flips both.
 * This is the hover tip, which chases the cursor.
 *
 * `centred` puts the overlay's own centre on the anchor and ignores `offset`.
 * This is the system popup: the click already said where to look, and opening
 * the panel there rather than beside it saves the eye the journey. Near an edge
 * it slides inside rather than flipping, because a flip would move it off the
 * thing it is about.
 *
 * One function for both, because it is the same decision made two ways, and it
 * IS a decision — so it belongs in the tested layer rather than in two
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
  placement = 'beside',
}: {
  anchorX: number;
  anchorY: number;
  overlayWidth: number;
  overlayHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offset: number;
  placement?: OverlayPlacement;
}): OverlayBox {
  if (placement === 'centred') {
    return {
      left: clampAxis(anchorX - overlayWidth / 2, overlayWidth, viewportWidth),
      top: clampAxis(
        anchorY - overlayHeight / 2,
        overlayHeight,
        viewportHeight,
      ),
    };
  }

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
