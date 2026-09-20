import { GATE_ALPHA, GATE_TINT } from '@/utils/map/colors';
import type { EdgeSegment } from '@/utils/map/edges';
import { Graphics } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { drawEdgeGroups } from './edges';

/**
 * A Graphics builds its path without a GPU, so what this asserts is the one
 * thing the grouping exists for: one stroke per colour, with that colour.
 */
function segment(x: number): EdgeSegment {
  return {
    from: [x, 0],
    to: [x + 1, 1],
    regions: [10000001, 10000001],
    constellations: [20000001, 20000001],
    systems: [x, x + 1],
  };
}

const ORIGIN = { x: 0, z: 0 };

describe('drawEdgeGroups', () => {
  it('strokes each group with its own colour and the neutral one with GATE_TINT', () => {
    const target = new Graphics();
    const stroke = vi.spyOn(target, 'stroke');

    drawEdgeGroups(
      target,
      [
        { tint: null, segments: [segment(0)] },
        { tint: 0x7cd05d, segments: [segment(2)] },
      ],
      ORIGIN,
    );

    const colours = stroke.mock.calls.map((call) => call[0]);
    expect(colours).toEqual([
      { width: 1, pixelLine: true, color: GATE_TINT, alpha: GATE_ALPHA },
      { width: 1, pixelLine: true, color: 0x7cd05d, alpha: GATE_ALPHA },
    ]);
  });

  it('clears what was there, so a layer switch does not draw over itself', () => {
    const target = new Graphics();
    const clear = vi.spyOn(target, 'clear');
    drawEdgeGroups(target, [], ORIGIN);
    expect(clear).toHaveBeenCalled();
  });
});
