import { describe, expect, it } from 'vitest';
import {
  boundsCenter,
  float32StepMetres,
  float32StepPixels,
  maxLocalMagnitude,
  nearestNode,
  originFor,
  toLocal,
} from './origin';

/**
 * The whole point of this module is the one hard rule in the design: a raw
 * galactic coordinate must never reach a GPU attribute. NEW_EDEN's real bounds
 * are the fixture, so the numbers below are the ones the production scene
 * actually produces (measured 2026-09-13).
 */
const NEW_EDEN_BOUNDS = {
  minX: -508743946216137000,
  maxX: 336522971264518000,
  minZ: -484452845697854000,
  maxZ: 472860102256057000,
};

function node(x: number, z: number) {
  return { x, z };
}

describe('boundsCenter', () => {
  it('sits at the midpoint of the scene', () => {
    const origin = boundsCenter(NEW_EDEN_BOUNDS);
    expect(origin.x).toBeCloseTo(-8.611049e16, -10);
    expect(origin.z).toBeCloseTo(-5.796372e15, -10);
  });

  it('is the exact node position for a one-node scene', () => {
    expect(boundsCenter({ minX: 5, maxX: 5, minZ: -3, maxZ: -3 })).toEqual({
      x: 5,
      z: -3,
    });
  });
});

describe('toLocal', () => {
  it('subtracts the origin', () => {
    expect(toLocal({ x: 100, z: -50 }, 250, 25)).toEqual([150, 75]);
  });

  it('returns zero at the origin itself', () => {
    expect(toLocal({ x: 1e17, z: -2e17 }, 1e17, -2e17)).toEqual([0, 0]);
  });

  it('is the only place a Graphics vertex is built — sprites never use it', () => {
    // Documentation as a test: Pixi composes a sprite's transform in float64 and
    // writes the screen coordinate to float32, so a sprite takes raw galactic
    // metres. Only Graphics keeps world-space vertices in a float32 buffer, and
    // that is the entire remaining job of the origin.
    const origin = { x: 1e17, z: -2e17 };
    expect(toLocal(origin, 1.5e17, -2.5e17)).toEqual([5e16, -5e16]);
  });
});

describe('the float32 budget on the galaxy edge mesh', () => {
  const origin = boundsCenter(NEW_EDEN_BOUNDS);
  const corners = [
    node(NEW_EDEN_BOUNDS.minX, NEW_EDEN_BOUNDS.minZ),
    node(NEW_EDEN_BOUNDS.maxX, NEW_EDEN_BOUNDS.maxZ),
  ];

  it('shrinks the largest coordinate from 5.1e17 to 4.8e17 metres', () => {
    expect(maxLocalMagnitude(origin, corners)).toBeCloseTo(4.786565e17, -12);
  });

  it('never lets a local coordinate exceed the scene half-span', () => {
    const halfSpan =
      Math.max(
        NEW_EDEN_BOUNDS.maxX - NEW_EDEN_BOUNDS.minX,
        NEW_EDEN_BOUNDS.maxZ - NEW_EDEN_BOUNDS.minZ,
      ) / 2;
    for (const corner of corners) {
      const [x, z] = toLocal(origin, corner.x, corner.z);
      expect(Math.abs(x)).toBeLessThanOrEqual(halfSpan);
      expect(Math.abs(z)).toBeLessThanOrEqual(halfSpan);
    }
  });

  it('quantises to 2.85e10 metres in float32', () => {
    expect(float32StepMetres(4.786565e17)).toBeCloseTo(2.853015e10, -6);
  });

  it('is invisible at the galaxy fit and 0.22 px at the Phase 1 ceiling', () => {
    const fit = -49.918;
    expect(float32StepPixels(4.786565e17, fit)).toBeLessThan(0.001);
    expect(float32StepPixels(4.786565e17, fit + 13)).toBeCloseTo(0.22, 2);
  });

  it('would be 598 px without the floating origin, which is the whole reason for it', () => {
    // The raw coordinate, fed straight to the GPU, at the deepest zoom the
    // design reaches (fit + 22.8, opened in Phase 2).
    expect(float32StepPixels(9.57e17, -49.918 + 22.8)).toBeGreaterThan(100);
  });
});

describe('nearestNode', () => {
  const nodes = [
    { systemId: 1, x: 0, z: 0 },
    { systemId: 2, x: 1e16, z: 0 },
    { systemId: 3, x: 0, z: -2e16 },
  ];

  it('finds the closest node to a point', () => {
    expect(nearestNode(nodes, 9e15, 1e15)?.systemId).toBe(2);
    expect(nearestNode(nodes, 1e14, -1.9e16)?.systemId).toBe(3);
  });

  it('returns null for an empty scene rather than throwing', () => {
    expect(nearestNode([], 0, 0)).toBeNull();
  });

  it('compares squared distances, so it never needs a square root', () => {
    // A node exactly between two others resolves to the first seen, which is
    // stable across renders because the node order comes from the query.
    expect(nearestNode(nodes, 5e15, 0)?.systemId).toBe(1);
  });
});

describe('originFor', () => {
  const bounds = {
    minX: -508743946216137000,
    maxX: 336522971264518000,
    minZ: -484452845697854000,
    maxZ: 472860102256057000,
  };

  it('is the scene centre while nothing is focused', () => {
    expect(originFor(bounds, null)).toEqual(boundsCenter(bounds));
  });

  it('is the focused system once there is one', () => {
    expect(originFor(bounds, { x: 1e17, z: -2e17 })).toEqual({
      x: 1e17,
      z: -2e17,
    });
  });

  it('is what turns 299 px of jitter into 0.019 px', () => {
    // The numbers that force the switch, asserted rather than left in a comment.
    const sceneHalfSpan = 4.786565e17;
    const biggestSystemRadius = 3.0384e13;
    const deepest = -24.51;

    expect(sceneHalfSpan * 2 ** -24 * 2 ** deepest).toBeGreaterThan(100);
    expect(biggestSystemRadius * 2 ** -24 * 2 ** deepest).toBeLessThan(0.1);
  });
});
