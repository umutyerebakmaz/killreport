import { describe, expect, it } from 'vitest';

import { cameraTransform, type MapCamera } from './camera';
import {
  MIN_PICK_RADIUS_PX,
  pickRadiusPx,
  pickSystem,
  type PickNode,
} from './pick';

const WIDTH = 800;
const HEIGHT = 600;

function node(over: Partial<PickNode> = {}): PickNode {
  return {
    systemId: 30000142,
    name: 'Jita',
    x: 0,
    z: 0,
    radius: 0,
    securityStatus: 0.94,
    ...over,
  };
}

/** A camera centred on the origin, one pixel per metre. */
const UNIT_CAMERA: MapCamera = { x: 0, z: 0, zoom: 0 };
const UNIT = cameraTransform(UNIT_CAMERA, WIDTH, HEIGHT);

function pick(nodes: PickNode[], pointerX: number, pointerY: number) {
  return pickSystem({
    nodes,
    transform: UNIT,
    pointerX,
    pointerY,
    cameraScale: 1,
  });
}

describe('pickRadiusPx', () => {
  it('floors at MIN_PICK_RADIUS_PX, because a 1.5 px dot cannot be clicked', () => {
    // systemRadiusPx's own floor is 1.5, which is the galaxy zoom case.
    expect(pickRadiusPx(0, 1)).toBe(MIN_PICK_RADIUS_PX);
  });

  it('follows the real dot once the dot is larger than the floor', () => {
    // radius 100 m at scale 1 is a 100 px disc; the whole disc is clickable.
    expect(pickRadiusPx(100, 1)).toBe(100);
  });
});

describe('pickSystem', () => {
  it('returns the node under the pointer, with its screen position', () => {
    // The origin projects to the viewport centre.
    const target = pick([node()], WIDTH / 2, HEIGHT / 2);
    expect(target?.node.systemId).toBe(30000142);
    expect(target?.screenX).toBe(WIDTH / 2);
    expect(target?.screenY).toBe(HEIGHT / 2);
  });

  it('returns null when the pointer is outside every radius', () => {
    expect(pick([node()], WIDTH / 2 + 20, HEIGHT / 2)).toBeNull();
  });

  it('picks a 1.5 px dot from 5 px away, thanks to the floor', () => {
    expect(pick([node()], WIDTH / 2 + 5, HEIGHT / 2)?.node.name).toBe('Jita');
  });

  it('projects +z upward: scaleY is negative', () => {
    // A node 50 m up the z axis must land ABOVE the centre, at a smaller
    // screen y. This is the map's +z-is-up contract and the one thing that
    // silently inverts if the projection is copied wrong.
    const target = pick([node({ z: 50 })], WIDTH / 2, HEIGHT / 2 - 50);
    expect(target?.screenY).toBe(HEIGHT / 2 - 50);
  });

  it('gives the nearest node when two clickable areas overlap', () => {
    // At the galaxy fit the median neighbour is 3.0 px apart, so with a 6 px
    // radius neighbouring systems really do overlap. Nearest wins, so the
    // result is deterministic even then.
    const near = node({ systemId: 1, name: 'Near', x: 2 });
    const far = node({ systemId: 2, name: 'Far', x: -4 });
    expect(pick([far, near], WIDTH / 2 + 2, HEIGHT / 2)?.node.name).toBe(
      'Near',
    );
  });

  it('returns null for an empty scene', () => {
    expect(pick([], WIDTH / 2, HEIGHT / 2)).toBeNull();
  });
});
