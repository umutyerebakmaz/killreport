import { describe, expect, it } from 'vitest';
import { gateNeighbours } from './topology';

const edges = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 1, to: 4 },
  { from: 5, to: 1 },
];

describe('gateNeighbours', () => {
  it('finds neighbours on both sides of the pair, since edges are stored from < to', () => {
    expect(gateNeighbours(edges, 1).sort()).toEqual([2, 4, 5]);
  });

  it('returns an empty list for a system with no gates, like every wormhole system', () => {
    expect(gateNeighbours(edges, 99)).toEqual([]);
  });

  it('never returns the system itself', () => {
    expect(gateNeighbours([{ from: 7, to: 7 }], 7)).toEqual([]);
  });

  it('deduplicates', () => {
    expect(
      gateNeighbours(
        [
          { from: 1, to: 2 },
          { from: 1, to: 2 },
        ],
        1,
      ),
    ).toEqual([2]);
  });
});
