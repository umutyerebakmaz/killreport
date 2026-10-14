import { describe, expect, it } from 'vitest';
import {
  easeInOut,
  lerpCamera,
  lerpPoint,
  morphAnchor,
  morphTarget,
  pairNodes,
} from './morph';

describe('easeInOut', () => {
  it('starts at 0, ends at 1 and passes the middle at 0.5', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });

  it('clamps outside the run, so a late frame lands exactly on the end', () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(1.7)).toBe(1);
  });
});

describe('lerpPoint and lerpCamera', () => {
  it('returns the ends at 0 and 1', () => {
    const a = { x: 1e17, z: -2e17 };
    const b = { x: 3e17, z: 4e17 };
    expect(lerpPoint(a, b, 0)).toEqual(a);
    expect(lerpPoint(a, b, 1)).toEqual(b);
    expect(lerpPoint(a, b, 0.5)).toEqual({ x: 2e17, z: 1e17 });
  });

  it('moves the zoom with the position', () => {
    expect(
      lerpCamera({ x: 0, z: 0, zoom: -50 }, { x: 10, z: 20, zoom: -48 }, 0.5),
    ).toEqual({ x: 5, z: 10, zoom: -49 });
  });
});

describe('pairNodes', () => {
  it('pairs by system id, in the order of the layout being left', () => {
    const from = [
      { systemId: 2, x: 0, z: 0 },
      { systemId: 1, x: 5, z: 5 },
    ];
    const to = [
      { systemId: 1, x: 10, z: 10 },
      { systemId: 2, x: 20, z: 20 },
    ];
    expect(pairNodes(from, to)).toEqual([
      { x: 20, z: 20 },
      { x: 10, z: 10 },
    ]);
  });

  it('leaves a system the new layout lacks unpaired', () => {
    expect(
      pairNodes([{ systemId: 9, x: 0, z: 0 }], [{ systemId: 1, x: 1, z: 1 }]),
    ).toEqual([null]);
  });
});

describe('morphAnchor', () => {
  const from = [
    { systemId: 1, x: 0, z: 0 },
    { systemId: 2, x: 100, z: 100 },
  ];
  const to = [
    { systemId: 1, x: 1000, z: 1000 },
    { systemId: 2, x: 5000, z: 5000 },
  ];

  it('anchors on the selected system when both layouts hold it', () => {
    expect(
      morphAnchor({ focus: 2, camera: { x: 0, z: 0, zoom: -45 }, from, to }),
    ).toEqual({ from: { x: 100, z: 100 }, to: { x: 5000, z: 5000 } });
  });

  it('falls back to the system nearest the centre of the screen', () => {
    expect(
      morphAnchor({
        focus: null,
        camera: { x: 10, z: 10, zoom: -45 },
        from,
        to,
      }),
    ).toEqual({ from: { x: 0, z: 0 }, to: { x: 1000, z: 1000 } });
  });

  it('is null when the nearest system has nowhere to go', () => {
    expect(
      morphAnchor({
        focus: null,
        camera: { x: 0, z: 0, zoom: -45 },
        from,
        to: [{ systemId: 2, x: 1, z: 1 }],
      }),
    ).toBeNull();
  });
});

describe('morphTarget', () => {
  const toFit = { x: 7, z: 8, zoom: -50.2 };
  const anchor = { from: { x: 100, z: 100 }, to: { x: 400, z: 700 } };

  it('goes from one fit to the other when the camera sat at the fit', () => {
    expect(
      morphTarget({
        camera: { x: 0, z: 0, zoom: -50 },
        atFit: true,
        toFit,
        anchor,
      }),
    ).toBe(toFit);
  });

  it('keeps the anchor where it was on screen, and the zoom, otherwise', () => {
    expect(
      morphTarget({
        camera: { x: 110, z: 90, zoom: -45 },
        atFit: false,
        toFit,
        anchor,
      }),
    ).toEqual({ x: 410, z: 690, zoom: -45 });
  });

  it('fits when there is no anchor to keep', () => {
    expect(
      morphTarget({
        camera: { x: 1, z: 1, zoom: -45 },
        atFit: false,
        toFit,
        anchor: null,
      }),
    ).toBe(toFit);
  });
});
