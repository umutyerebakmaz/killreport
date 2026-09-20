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
  discRadiusPx,
  LOGO_MIN_RADIUS_PX,
  LOGO_TEXTURE_RADIUS,
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
    discs: new Container(),
    systems: new Container(),
    celestials: new Container(),
    dot: Texture.EMPTY,
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

  it('draws the shared default emblem white over its owner disc', () => {
    // The emblem is the same image for all of them, and what says WHICH
    // alliance a system belongs to is the disc under it. Tinting the emblem
    // its owner's colour — which is what this did while the circle was a thin
    // ring — would now paint it onto a disc of that same colour.
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.sprites[1].texture).toBe(FALLBACK_TEXTURE);
    expect(built.sprites[1].tint).toBe(0xffffff);
    expect(built.discs[1].tint).toBe(sovTint(NO_LOGO));
  });

  it('un-flips a logo, which the world transform mirrors vertically', () => {
    // `cameraTransform` gives the world a NEGATIVE scaleY, so every sprite is
    // mirrored. A dot is a circle and cannot show it; a crest was drawn upside
    // down until the mark carried the matching negative of its own.
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.sprites[0].scale.y).toBe(-built.sprites[0].scale.x);
    // The unheld system is still a dot, and a dot is never flipped.
    expect(built.sprites[2].scale.y).toBe(built.sprites[2].scale.x);
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

  it('backs a logo with a disc in its owner colour', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    // The ring carries the colour the layer decided, which is what lets the
    // logo itself be drawn white.
    expect(built.discs[0].visible).toBe(true);
    expect(built.discs[0].tint).toBe(sovTint(WITH_LOGO));
    expect(built.sprites[0].tint).toBe(0xffffff);
  });

  it('leaves no disc under a system that is not showing a logo', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLayer(built, NODES, MAP_LAYERS.sovereignty, DATA);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.discs[2].visible).toBe(false);
  });

  it('backs an uncoloured owner with the neutral it was drawn in', () => {
    // An owner with no dictionary entry is drawn SOV_UNOWNED_TINT, and the
    // ring has to agree with the mark rather than invent a colour.
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    const data: MapLayerData = {
      sovereignty: buildSovIndex({ systems: [{ systemId: 1, ownerId: 1 }] }),
    };
    const atlas = {
      textureByOwner: new Map([[1, OWN_LOGO_TEXTURE]]),
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

    expect(built.discs[0].tint).toBe(SOV_UNOWNED_TINT);
  });

  it('sizes the disc a few pixels wider than the logo it backs', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);

    expect(built.discs[0].scale.x).toBeCloseTo(
      spriteScale(discRadiusPx(LOGO_MIN_RADIUS_PX), DOT_TEXTURE_RADIUS, 1),
    );
  });

  it('puts every dot back when the threshold is crossed downward', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, true, ownerBySystem, 1);
    applyLogos(built, NODES, scene.dot, ATLAS, false, ownerBySystem, 1);

    expect(built.sprites[0].texture).toBe(scene.dot);
    expect(built.logos.every((on) => on === false)).toBe(true);
    expect(built.discs.every((disc) => disc.visible === false)).toBe(true);
  });

  it('draws dots when the atlas has not arrived yet', () => {
    const scene = fakeScene();
    const built = buildSystems(scene, NODES, 1);
    applyLogos(built, NODES, scene.dot, null, true, ownerBySystem, 1);

    expect(built.sprites[0].texture).toBe(scene.dot);
  });
});
