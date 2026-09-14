import { describe, expect, it } from 'vitest';

import { clampOverlay } from './overlay';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };
const SIZE = { overlayWidth: 200, overlayHeight: 100 };

function clamp(anchorX: number, anchorY: number, offset = 12) {
  return clampOverlay({ anchorX, anchorY, ...SIZE, ...VIEWPORT, offset });
}

describe('clampOverlay', () => {
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
