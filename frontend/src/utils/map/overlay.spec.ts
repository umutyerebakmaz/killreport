import { describe, expect, it } from 'vitest';

import { clampOverlay } from './overlay';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };
const SIZE = { overlayWidth: 200, overlayHeight: 100 };

function clamp(anchorX: number, anchorY: number, offset = 12) {
  return clampOverlay({ anchorX, anchorY, ...SIZE, ...VIEWPORT, offset });
}

describe('clampOverlay, beside the anchor', () => {
  it('opens down and to the right of the anchor', () => {
    expect(clamp(100, 100)).toEqual({ left: 112, top: 112 });
  });

  it('flips to the left when the right edge would be crossed', () => {
    // 700 + 12 + 200 = 912 > 800, so the overlay goes to the anchor's left.
    expect(clamp(700, 100).left).toBe(700 - 12 - 200);
  });

  it('flips upward when the bottom edge would be crossed', () => {
    expect(clamp(100, 550).top).toBe(550 - 12 - 100);
  });

  it('flips both at once in the bottom-right corner', () => {
    expect(clamp(700, 550)).toEqual({ left: 488, top: 438 });
  });

  it('never goes negative, even when the flip does not fit either', () => {
    // A viewport narrower than the overlay: pinned to 0 rather than off-screen.
    expect(
      clampOverlay({
        anchorX: 10,
        anchorY: 10,
        overlayWidth: 900,
        overlayHeight: 700,
        ...VIEWPORT,
        offset: 12,
      }),
    ).toEqual({ left: 0, top: 0 });
  });
});

describe('clampOverlay, centred on the anchor', () => {
  function centred(anchorX: number, anchorY: number) {
    return clampOverlay({
      anchorX,
      anchorY,
      ...SIZE,
      ...VIEWPORT,
      offset: 12,
      placement: 'centred',
    });
  }

  // The popup opens over the system rather than beside it: the click said where
  // to look, and putting the panel there means the eye does not have to travel.
  it('puts the overlay centre on the anchor', () => {
    expect(centred(400, 300)).toEqual({ left: 400 - 100, top: 300 - 50 });
  });

  it('ignores the offset, which only means anything beside an anchor', () => {
    expect(centred(400, 300)).toEqual(
      clampOverlay({
        anchorX: 400,
        anchorY: 300,
        ...SIZE,
        ...VIEWPORT,
        offset: 999,
        placement: 'centred',
      }),
    );
  });

  // No flip: there is no other side to go to. A clamp on both edges instead, so
  // a system near a corner slides the panel inside rather than hanging it off.
  it('slides inside the right and bottom edges', () => {
    expect(centred(790, 590)).toEqual({ left: 600, top: 500 });
  });

  it('slides inside the left and top edges', () => {
    expect(centred(10, 10)).toEqual({ left: 0, top: 0 });
  });

  it('pins to zero when the overlay is larger than the viewport', () => {
    expect(
      clampOverlay({
        anchorX: 400,
        anchorY: 300,
        overlayWidth: 900,
        overlayHeight: 700,
        ...VIEWPORT,
        offset: 12,
        placement: 'centred',
      }),
    ).toEqual({ left: 0, top: 0 });
  });
});

describe('clampOverlay, below the anchor', () => {
  function below(anchorX: number, anchorY: number, offset = 12) {
    return clampOverlay({
      anchorX,
      anchorY,
      ...SIZE,
      ...VIEWPORT,
      offset,
      placement: 'below',
    });
  }

  // Centred across, clear beneath: the system that was clicked stays visible.
  it('centres across the anchor and opens under it', () => {
    expect(below(400, 300)).toEqual({ left: 300, top: 312 });
  });

  it('takes the offset as the distance to clear, so a big disc pushes further', () => {
    expect(below(400, 300, 60).top).toBe(360);
  });

  // A slide would put the panel back over the anchor, which is the one thing
  // this placement exists to prevent. It flips instead.
  it('flips above rather than sliding back over the anchor', () => {
    expect(below(400, 550).top).toBe(550 - 12 - 100);
  });

  it('still clamps sideways, so a corner does not hang it off the edge', () => {
    expect(below(790, 300).left).toBe(600);
    expect(below(10, 300).left).toBe(0);
  });
});
