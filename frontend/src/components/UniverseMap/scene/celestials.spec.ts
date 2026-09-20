import { MapCelestialKind, type MapCelestial } from '@/generated/graphql';
import {
  CELESTIAL_RADIUS_PX,
  spriteScale,
  systemFloorPx,
} from '@/utils/map/marks';
import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { buildCelestials } from './celestials';
import { DOT_TEXTURE_RADIUS, type MapScene } from './createScene';
import { buildSystems } from './systems';

/**
 * Containers, sprites and their transforms are plain scene-graph arithmetic:
 * Pixi only needs a GPU to draw them, not to build them. So the two things a
 * build has to get right — draw order and size — are assertable here, and the
 * WebGL half stays the user's to verify by eye.
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

const SYSTEMS = new Map([[30000142, { x: 3e17, z: 2e17 }]]);

function celestial(kind: MapCelestialKind, id: number): MapCelestial {
  return { id, systemId: 30000142, kind, name: `${kind} ${id}`, x: id, z: id };
}

describe('buildCelestials', () => {
  it('keeps moons and belts above the planets, whatever order they arrive in', () => {
    const scene = fakeScene();
    // A moon first, then a planet: the fine container is created at the moon,
    // so an unordered build would leave the planet drawing over it.
    const built = buildCelestials(
      scene,
      [
        celestial(MapCelestialKind.Moon, 1),
        celestial(MapCelestialKind.Planet, 2),
        celestial(MapCelestialKind.Belt, 3),
      ],
      SYSTEMS,
      2 ** -26.5,
    );

    const system = scene.celestials.children[0] as Container;
    expect(system.children.at(-1)).toBe(built.fineContainers[0]);
  });

  it('sizes what it builds, so a celestial is visible before the camera moves', () => {
    const scene = fakeScene();
    const cameraScale = 2 ** -26.5;
    const built = buildCelestials(
      scene,
      [
        celestial(MapCelestialKind.Planet, 1),
        celestial(MapCelestialKind.Moon, 2),
      ],
      SYSTEMS,
      cameraScale,
    );

    expect(built.interior[0].scale.x).toBeCloseTo(
      spriteScale(
        CELESTIAL_RADIUS_PX[MapCelestialKind.Planet],
        DOT_TEXTURE_RADIUS,
        cameraScale,
      ),
      20,
    );
    expect(built.fine[0].scale.x).toBeCloseTo(
      spriteScale(
        CELESTIAL_RADIUS_PX[MapCelestialKind.Moon],
        DOT_TEXTURE_RADIUS,
        cameraScale,
      ),
      20,
    );
  });
});

describe('buildSystems', () => {
  it('sizes what it builds, rather than leaving it 64 metres across', () => {
    const scene = fakeScene();
    const cameraScale = 2 ** -48.78;
    const built = buildSystems(
      scene,
      [
        {
          systemId: 30000142,
          name: 'Jita',
          x: 3e17,
          z: 2e17,
          radius: 3.88e12,
          securityStatus: 0.94,
          constellationId: 20000020,
          regionId: 10000002,
        },
      ] as Parameters<typeof buildSystems>[1],
      cameraScale,
    );

    // The floor for this zoom, counter-scaled: a sprite left at Pixi's default 1
    // would be DOT_TEXTURE_RADIUS world metres and invisible at every zoom. The
    // floor comes from systemFloorPx rather than a literal, because it now rises
    // with the camera instead of sitting at 1.5 everywhere.
    expect(built.sprites[0].scale.x).toBeCloseTo(
      spriteScale(
        systemFloorPx(Math.log2(cameraScale)),
        DOT_TEXTURE_RADIUS,
        cameraScale,
      ),
      20,
    );
    expect(built.sprites[0].scale.x).not.toBe(1);
  });
});
