import type { MapNode } from '@/generated/graphql';
import { securityTint } from '@/utils/map/colors';
import {
  buildSovIndex,
  MAP_LAYERS,
  type MapLayerData,
} from '@/utils/map/layers';
import { spriteScale, SYSTEM_MAX_FLOOR_PX } from '@/utils/map/marks';
import { SOV_COLORS, SOV_UNOWNED_TINT, sovTint } from '@/utils/map/sovColors';
import {
  LOGO_MIN_RADIUS_PX,
  LOGO_TEXTURE_RADIUS,
  RING_TEXTURE_RADIUS,
  ringRadiusPx,
} from '@/utils/map/sovLogos';
import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { DOT_TEXTURE_RADIUS, type MapScene } from './createScene';
import { applyLayer, applyLogos, buildSystems } from './systems';

/**
 * Sprites and their transforms are plain arithmetic; Pixi needs a GPU to draw
 * them, not to build them. Same fake scene celestials.spec.ts uses.
 */
function fakeScene(): MapScene {
  return {
    app: null as unknown as MapScene['app'],
    world: new Container(),
    edgesGalaxy: null as unknown as MapScene['edgesGalaxy'],
    edgesHighlight: null as unknown as MapScene['edgesHighlight'],
    edgesLocal: null as unknown as MapScene['edgesLocal'],
    rings: new Container(),
    systems: new Container(),
    celestials: new Container(),
    dot: Texture.EMPTY,
    ring: Texture.EMPTY,
    destroy: () => {},
  };
}

const WITH_LOGO = Number(Object.keys(SOV_COLORS)[0]);
const NO_LOGO = Number(Object.keys(SOV_COLORS)[1]);

function node(systemId: number, securityStatus = 0.5): MapNode {
  return {
    systemId,
    name: `S-${systemId}`,
    x: 0,
    z: 0,
    radius: 1,
    securityStatus,
    constellationId: 20000001,
    regionId: 10000001,
  };
}

const NODES = [node(1), node(2), node(3, -0.4)];

const DATA: MapLayerData = {
  sovereignty: buildSovIndex({
    systems: [
      { systemId: 1, ownerId: WITH_LOGO },
      { systemId: 2, ownerId: NO_LOGO },
    ],
  }),
};

const OWN_LOGO_TEXTURE = new Texture();
const FALLBACK_TEXTURE = new Texture();

const ATLAS = {
  textureByOwner: new Map([
    [WITH_LOGO, OWN_LOGO_TEXTURE],
    [NO_LOGO, FALLBACK_TEXTURE],
  ]),
  tintedOwners: new Set([NO_LOGO]),
  destroy: () => {},
};

describe('applyLayer', () => {
  it('writes the layer colour over whatever the sprites carried', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);

    expect(built.sprites[2].tint).toBe(securityTint(-0.4));

    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);

    expect(built.sprites[0].tint).toBe(sovTint(WITH_LOGO));
    expect(built.sprites[2].tint).toBe(SOV_UNOWNED_TINT);
  });
});

describe('applyLogos', () => {
  const ownerBySystem = DATA.sovereignty!.ownerBySystem;

  it('swaps a held system to its owner logo and drops the tint', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.sprites[0].texture).toBe(OWN_LOGO_TEXTURE);
    // White, or the tint would multiply the logo's own colours.
    expect(built.sprites[0].tint).toBe(0xffffff);
  });

  it('keeps the owner colour on a logo-less owner sharing the default emblem', () => {
    // The emblem is the same image for all of them, so the colour is the only
    // thing left that says WHICH alliance this system belongs to.
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.sprites[1].texture).toBe(FALLBACK_TEXTURE);
    expect(built.sprites[1].tint).toBe(sovTint(NO_LOGO));
  });

  it('leaves an unheld system as a dot', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.sprites[2].texture).toBe(scene.dot);
    expect(built.logos[2]).toBe(false);
  });

  it('sizes a logo from its own texture radius and floor', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    // A 1 m radius at scale 1 is far under both floors, so the floor decides
    // the size. systemFloorPx(log2(1) = 0) is past APPROACH_ZOOM, so the dot's
    // floor is SYSTEM_MAX_FLOOR_PX (6) and the logo's is the larger of that
    // and LOGO_MIN_RADIUS_PX (8).
    expect(built.sprites[0].scale.x).toBeCloseTo(
      spriteScale(LOGO_MIN_RADIUS_PX, LOGO_TEXTURE_RADIUS, 1),
    );
    expect(built.sprites[2].scale.x).toBeCloseTo(
      spriteScale(SYSTEM_MAX_FLOOR_PX, DOT_TEXTURE_RADIUS, 1),
    );
  });

  it('circles a logo in its owner colour', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    // The ring carries the colour the layer decided, which is what lets the
    // logo itself be drawn white.
    expect(built.rings[0].visible).toBe(true);
    expect(built.rings[0].tint).toBe(sovTint(WITH_LOGO));
    expect(built.sprites[0].tint).toBe(0xffffff);
  });

  it('leaves no circle around a system that is not showing a logo', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.rings[2].visible).toBe(false);
  });

  it('circles an uncoloured owner in the neutral it was drawn in', () => {
    // An owner with no dictionary entry is drawn SOV_UNOWNED_TINT, and the
    // ring has to agree with the mark rather than invent a colour.
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    const data: MapLayerData = {
      sovereignty: buildSovIndex({ systems: [{ systemId: 1, ownerId: 1 }] }),
    };
    const atlas = {
      textureByOwner: new Map([[1, OWN_LOGO_TEXTURE]]),
      tintedOwners: new Set<number>(),
      destroy: () => {},
    };

    applyLayer(built, NODES, MAP_LAYERS.sovereignty, data);
    applyLogos(
      built,
      NODES,
      scene.dot,
      atlas,
      true,
      data.sovereignty!.ownerBySystem,
      1,
    );

    expect(built.rings[0].tint).toBe(SOV_UNOWNED_TINT);
  });

  it('sizes the circle to circumscribe the logo it holds', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.rings[0].scale.x).toBeCloseTo(
      spriteScale(ringRadiusPx(LOGO_MIN_RADIUS_PX), RING_TEXTURE_RADIUS, 1),
    );
  });

  it('puts every dot back when the threshold is crossed downward', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, false, ownerBySystem, 1);

    expect(built.sprites[0].texture).toBe(scene.dot);
    expect(built.logos.every((on) => on === false)).toBe(true);
    expect(built.rings.every((ring) => ring.visible === false)).toBe(true);
  });

  it('draws dots when the atlas has not arrived yet', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, null, true, ownerBySystem, 1);

    expect(built.sprites[0].texture).toBe(scene.dot);
  });
});
