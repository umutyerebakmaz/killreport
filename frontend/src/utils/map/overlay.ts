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

/** Which side of the anchor the overlay opens on, before any flip. */
export type OverlaySide = 'above' | 'below';

/**
 * Where a floating overlay goes, given the system it belongs to.
 *
 * Centred across the anchor and `offset` clear of it on `side`. The click or the
 * hover already said which system this is about, so the overlay opens on that
 * spot rather than beside it — and clear of it rather than over it, because the
 * thing it names has to stay visible.
 *
 * `offset` is the anchor's own drawn radius plus a gap, not a constant. The dots
 * grow with the camera and reach tens of pixels at the interior zooms, where a
 * fixed offset would put the overlay back on top of the system.
 *
 * Vertically it flips to the other side at the edge rather than sliding along:
 * sliding would return it over the anchor, which is the one thing this placement
 * exists to prevent. Horizontally it slides, where there is nothing to cover.
 *
 * Two earlier placements were written and removed. `beside` — down and to the
 * right, flipping at both edges — was the original, and it cost the eye a
 * journey from the thing it described. A fully centred one, with the overlay's
 * middle on the anchor, hid the system it was about.
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
  side = 'below',
}: {
  anchorX: number;
  anchorY: number;
  overlayWidth: number;
  overlayHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offset: number;
  side?: OverlaySide;
}): OverlayBox {
  const below = anchorY + offset;
  const above = anchorY - offset - overlayHeight;

  let top = side === 'above' ? above : below;
  // The flip, once. A viewport too small to hold the overlay on either side
  // falls through to the clamp below rather than oscillating.
  if (side === 'above' && top < 0) top = below;
  if (side === 'below' && top + overlayHeight > viewportHeight) top = above;

  return {
    left: clampAxis(anchorX - overlayWidth / 2, overlayWidth, viewportWidth),
    top: clampAxis(top, overlayHeight, viewportHeight),
  };
}

/**
 * The popup's height, in pixels, before it is placed.
 *
 * `clampOverlay` has to know how tall the panel is to flip it at the bottom
 * edge, and it is asked BEFORE the browser has laid anything out — so the
 * height is computed rather than measured. A constant did the job while the
 * panel was a fixed six lines; the stargate list made it vary between a
 * wormhole with no gates and Jita with seven.
 *
 * Measured against the rendered panel on 2026-09-20. Being a few pixels out
 * only moves where the panel flips to the other side of the system, never
 * whether it stays on screen — the clamp is what guarantees that. So the
 * numbers round UP where they are unsure, which flips a little early rather
 * than a little late.
 */
export const POPUP_BASE_HEIGHT_PX = 161;

/** The owner's crest and name, shown only when the system is held. */
export const POPUP_OWNER_LINE_PX = 30;

/** The "Stargates" heading and its `mt-3`, present only with chips under it. */
export const POPUP_STARGATE_HEADING_PX = 28;

/** One row of destination chips, including the gap above it. */
export const POPUP_STARGATE_ROW_PX = 30;

/**
 * How many chips a row holds.
 *
 * Exact, not an estimate: the chips sit in a two-column grid, so the count is
 * a property of the layout rather than of how long the names happen to be.
 * It was a guess while they wrapped — "T5ZI-S" and "New Caldari" do not cost
 * the same — and the grid is what settled it. Move `grid-cols-2` in
 * `SystemPopup` and this number moves with it.
 */
export const STARGATE_CHIPS_PER_ROW = 2;

export function popupHeightPx({
  stargateCount,
  hasOwner,
}: {
  stargateCount: number;
  hasOwner: boolean;
}): number {
  return (
    POPUP_BASE_HEIGHT_PX +
    (hasOwner ? POPUP_OWNER_LINE_PX : 0) +
    // A system with no stargates draws no heading either — there is nothing
    // for it to head, and "Stargates" over an empty space reads as a failure
    // to load rather than as a wormhole.
    (stargateCount === 0
      ? 0
      : POPUP_STARGATE_HEADING_PX +
        Math.ceil(stargateCount / STARGATE_CHIPS_PER_ROW) *
          POPUP_STARGATE_ROW_PX)
  );
}
