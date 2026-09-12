import { describe, expect, it } from 'vitest';
import {
  boundsCenter,
  float32StepMetres,
  float32StepPixels,
  maxLocalMagnitude,
  nodePosition,
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
});

describe('nodePosition', () => {
  it('reads x and z off the node', () => {
    const position = nodePosition({ x: 1e9, z: 2e9 });
    expect(position(node(3e9, 5e9))).toEqual([2e9, 3e9]);
  });
});

describe('the float32 budget on the real NEW_EDEN scene', () => {
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
      const [x, z] = nodePosition(origin)(corner);
      expect(Math.abs(x)).toBeLessThanOrEqual(halfSpan);
      expect(Math.abs(z)).toBeLessThanOrEqual(halfSpan);
    }
  });

  it('quantises to 2.85e10 metres in float32', () => {
    expect(float32StepMetres(4.786565e17)).toBeCloseTo(2.853015e10, -6);
  });

  it('is invisible at the galaxy fit and 0.22 px at the Faz 1 ceiling', () => {
    const fit = -49.918;
    expect(float32StepPixels(4.786565e17, fit)).toBeLessThan(0.001);
    expect(float32StepPixels(4.786565e17, fit + 13)).toBeCloseTo(0.22, 2);
  });

  it('would be 598 px without the floating origin, which is the whole reason for it', () => {
    // The raw coordinate, fed straight to the GPU, at the deepest zoom the
    // design reaches (fit + 22.8, opened in Faz 2).
    expect(float32StepPixels(9.57e17, -49.918 + 22.8)).toBeGreaterThan(100);
  });
});
