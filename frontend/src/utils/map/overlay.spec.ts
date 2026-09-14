import { describe, expect, it } from 'vitest';

import { clampOverlay } from './overlay';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };
const SIZE = { overlayWidth: 200, overlayHeight: 100 };

function place(anchorX: number, anchorY: number, offset = 12) {
  return clampOverlay({ anchorX, anchorY, ...SIZE, ...VIEWPORT, offset });
}

describe('clampOverlay', () => {
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
