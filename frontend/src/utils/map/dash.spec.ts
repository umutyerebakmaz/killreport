import { describe, expect, it } from 'vitest';
import { DASH_CELL_M, DASH_GAP_RATIO, dashSegment, splitDashed } from './dash';
import type { EdgeSegment } from './edges';

function segment(
  from: [number, number],
  to: [number, number],
  crossing = true,
): EdgeSegment {
  return {
    from,
    to,
    regions: crossing ? [10000001, 10000002] : [10000001, 10000001],
    constellations: crossing ? [20000001, 20000002] : [20000001, 20000001],
  };
}

/** The length a run of pieces covers, gaps excluded. */
function inked(pieces: EdgeSegment[]): number {
  return pieces.reduce(
    (total, piece) =>
      total +
      Math.hypot(piece.to[0] - piece.from[0], piece.to[1] - piece.from[1]),
    0,
  );
}

describe('dashSegment', () => {
  it('starts and ends on a dash, so neither end floats off its system', () => {
    const pieces = dashSegment(segment([0, 0], [DASH_CELL_M * 6, 0]));

    expect(pieces[0].from).toEqual([0, 0]);
    expect(pieces.at(-1)?.to[0]).toBeCloseTo(DASH_CELL_M * 6, -6);
  });

  it('cuts a segment into about one dash per cell of its own length', () => {
    expect(dashSegment(segment([0, 0], [DASH_CELL_M * 6, 0]))).toHaveLength(6);
    expect(dashSegment(segment([0, 0], [DASH_CELL_M * 12, 0]))).toHaveLength(
      12,
    );
  });

  it('dashes even the shortest crossing, which would otherwise read as solid', () => {
    // The 370 region crossings run from 5.1e15 m up, but nothing guarantees a
    // future one is not shorter than a single cell. Two dashes is the floor:
    // one dash is a solid line that stops early.
    expect(dashSegment(segment([0, 0], [DASH_CELL_M / 100, 0]))).toHaveLength(
      2,
    );
  });

  it('inks the duty cycle and leaves the rest as gaps', () => {
    const length = DASH_CELL_M * 6;
    const pieces = dashSegment(segment([0, 0], [length, 0]));
    // n dashes and n-1 gaps: the ink is length / (1 + (n-1)/n * gapRatio).
    const expected = length / (1 + (5 / 6) * DASH_GAP_RATIO);

    expect(inked(pieces)).toBeCloseTo(expected, -6);
  });

  it('keeps every piece on the line it came from', () => {
    const pieces = dashSegment(
      segment([0, 0], [DASH_CELL_M * 4, DASH_CELL_M * 4]),
    );

    for (const piece of pieces) {
      expect(piece.from[0]).toBeCloseTo(piece.from[1], -6);
      expect(piece.to[0]).toBeCloseTo(piece.to[1], -6);
    }
  });

  it('carries the crossing flag onto every piece', () => {
    expect(
      dashSegment(segment([0, 0], [DASH_CELL_M * 3, 0])).every(
        (p) => p.regions[0] !== p.regions[1],
      ),
    ).toBe(true);
  });

  it('returns a zero-length segment whole rather than dividing by it', () => {
    // Two systems at the same coordinates cannot happen in the data, but a
    // NaN here would take the whole mesh down with it.
    expect(dashSegment(segment([7, 7], [7, 7]))).toEqual([
      segment([7, 7], [7, 7]),
    ]);
  });
});

describe('splitDashed', () => {
  const inside = segment([0, 0], [DASH_CELL_M * 6, 0], false);
  const crossing = segment([0, 0], [DASH_CELL_M * 6, 0], true);

  it('leaves an edge inside one region whole', () => {
    expect(splitDashed([inside]).solid).toEqual([inside]);
    expect(splitDashed([inside]).dashed).toEqual([]);
  });

  it('cuts only the edges that leave their region', () => {
    const { solid, dashed } = splitDashed([inside, crossing]);

    expect(solid).toEqual([inside]);
    expect(dashed).toHaveLength(6);
  });

  it('returns two empty lists for an empty mesh', () => {
    expect(splitDashed([])).toEqual({ solid: [], dashed: [] });
  });
});
