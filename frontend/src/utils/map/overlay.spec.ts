import { describe, expect, it } from 'vitest';

import {
  clampOverlay,
  popupHeightPx,
  POPUP_BASE_HEIGHT_PX,
  POPUP_OWNER_LINE_PX,
  POPUP_STARGATE_HEADING_PX,
  POPUP_STARGATE_ROW_PX,
  STARGATE_CHIPS_PER_ROW,
} from './overlay';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };
const SIZE = { overlayWidth: 200, overlayHeight: 100 };

function place(anchorX: number, anchorY: number, offset = 12) {
  return clampOverlay({ anchorX, anchorY, ...SIZE, ...VIEWPORT, offset });
}

describe('clampOverlay, below the anchor', () => {
  // Centred across, clear beneath: the system that was clicked or hovered stays
  // visible under the thing describing it.
  it('centres across the anchor and opens under it', () => {
    expect(place(400, 300)).toEqual({ left: 300, top: 312 });
  });

  // The offset is the disc's own size plus a gap, so a system drawn large is
  // cleared by how large it is rather than by a constant.
  it('takes the offset as the distance to clear', () => {
    expect(place(400, 300, 60).top).toBe(360);
  });

  // A slide would put the overlay back over the anchor, which is the one thing
  // this placement exists to prevent. It flips instead.
  it('flips above rather than sliding back over the anchor', () => {
    expect(place(400, 550).top).toBe(550 - 12 - 100);
  });

  // Sideways there is nothing to cover, so it slides rather than flipping.
  it('slides inside the left and right edges', () => {
    expect(place(790, 300).left).toBe(600);
    expect(place(10, 300).left).toBe(0);
  });

  it('never goes negative, even when nothing fits', () => {
    expect(
      clampOverlay({
        anchorX: 400,
        anchorY: 300,
        overlayWidth: 900,
        overlayHeight: 700,
        ...VIEWPORT,
        offset: 12,
      }),
    ).toEqual({ left: 0, top: 0 });
  });
});

describe('clampOverlay, above the anchor', () => {
  function above(anchorX: number, anchorY: number, offset = 12) {
    return clampOverlay({
      anchorX,
      anchorY,
      ...SIZE,
      ...VIEWPORT,
      offset,
      side: 'above',
    });
  }

  it('centres across the anchor and opens over it', () => {
    // 300 - 12 - 100: the box's bottom edge sits `offset` clear of the anchor.
    expect(above(400, 300)).toEqual({ left: 300, top: 188 });
  });

  it('takes the offset as the distance to clear', () => {
    expect(above(400, 300, 60).top).toBe(300 - 60 - 100);
  });

  // Same reasoning as the other side: sliding down would return it over the
  // anchor, so it flips under instead.
  it('flips below rather than sliding back over the anchor', () => {
    expect(above(400, 40).top).toBe(52);
  });

  it('still clamps sideways', () => {
    expect(above(790, 300).left).toBe(600);
    expect(above(10, 300).left).toBe(0);
  });
});

describe('popupHeightPx', () => {
  it('is the bare panel for a system with no owner and no gates', () => {
    // A wormhole: nothing holds it and nothing leads out of it by gate.
    expect(popupHeightPx({ stargateCount: 0, hasOwner: false })).toBe(
      POPUP_BASE_HEIGHT_PX,
    );
  });

  it('adds the owner line only when the system is held', () => {
    expect(popupHeightPx({ stargateCount: 0, hasOwner: true })).toBe(
      POPUP_BASE_HEIGHT_PX + POPUP_OWNER_LINE_PX,
    );
  });

  it('adds the heading once and a row per chipful of destinations', () => {
    // Jita's seven, the busiest list the data holds short of the eight-gate
    // maximum measured on 2026-09-20. Four rows at two chips a row.
    expect(popupHeightPx({ stargateCount: 7, hasOwner: true })).toBe(
      POPUP_BASE_HEIGHT_PX +
        POPUP_OWNER_LINE_PX +
        POPUP_STARGATE_HEADING_PX +
        4 * POPUP_STARGATE_ROW_PX,
    );
  });

  it('keeps a part-full row whole', () => {
    // The chips wrap, so one gate past a full row still costs a whole row.
    const full = popupHeightPx({
      stargateCount: STARGATE_CHIPS_PER_ROW,
      hasOwner: false,
    });
    const oneMore = popupHeightPx({
      stargateCount: STARGATE_CHIPS_PER_ROW + 1,
      hasOwner: false,
    });
    expect(oneMore - full).toBe(POPUP_STARGATE_ROW_PX);
  });

  it('does not grow inside a row', () => {
    const one = popupHeightPx({ stargateCount: 1, hasOwner: false });
    const two = popupHeightPx({
      stargateCount: STARGATE_CHIPS_PER_ROW,
      hasOwner: false,
    });
    expect(two).toBe(one);
  });
});
