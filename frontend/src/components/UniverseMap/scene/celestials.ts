import type { MapCelestial, MapNode } from '@/generated/graphql';
import { CELESTIAL_TINT } from '@/utils/map/colors';
import {
  CELESTIAL_RADIUS_PX,
  FINE_KINDS,
  INTERIOR_KINDS,
  spriteScale,
} from '@/utils/map/marks';
import { Container, Sprite } from 'pixi.js';
import { DOT_TEXTURE_RADIUS, type MapScene } from './createScene';

export interface CelestialSprites {
  interior: Sprite[];
  interiorRadii: number[];
  fine: Sprite[];
  fineRadii: number[];
  fineContainers: Container[];
}

/**
 * One container per system, positioned at that system's galactic coordinate,
 * with its celestials as children at their in-system offsets.
 *
 * This is what deck.gl had to do by hand: its getPosition added
 * `system.x + celestial.x` for every object. Here the hierarchy composes the
 * two, in float64, and the child's own coordinate stays small.
 *
 * Moons and belts hang off a nested container per system, collected in
 * `fineContainers`, so the fine bucket is a handful of visibility flags rather
 * than a walk over every sprite.
 *
 * A celestial whose system is not in the index is dropped rather than drawn at
 * the origin — the same rule the gate edges follow, for the same reason.
 */
export function buildCelestials(
  scene: MapScene,
  celestials: MapCelestial[],
  systemById: Map<number, Pick<MapNode, 'x' | 'z'>>,
): CelestialSprites {
  scene.celestials.removeChildren();

  const interiorKinds = new Set<string>(INTERIOR_KINDS);
  const fineKinds = new Set<string>(FINE_KINDS);

  const bySystem = new Map<number, Container>();
  const fineBySystem = new Map<number, Container>();
  const result: CelestialSprites = {
    interior: [],
    interiorRadii: [],
    fine: [],
    fineRadii: [],
    fineContainers: [],
  };

  for (const celestial of celestials) {
    const system = systemById.get(celestial.systemId);
    if (!system) continue;

    const isInterior = interiorKinds.has(celestial.kind);
    const isFine = fineKinds.has(celestial.kind);
    if (!isInterior && !isFine) continue;

    let container = bySystem.get(celestial.systemId);
    if (!container) {
      container = new Container();
      container.position.set(system.x, system.z);
      bySystem.set(celestial.systemId, container);
      scene.celestials.addChild(container);
    }

    const sprite = new Sprite(scene.dot);
    sprite.anchor.set(0.5);
    sprite.position.set(celestial.x, celestial.z);
    sprite.tint = CELESTIAL_TINT[celestial.kind];

    const radius = CELESTIAL_RADIUS_PX[celestial.kind];

    if (isInterior) {
      container.addChild(sprite);
      result.interior.push(sprite);
      result.interiorRadii.push(radius);
      continue;
    }

    let fine = fineBySystem.get(celestial.systemId);
    if (!fine) {
      fine = new Container();
      fineBySystem.set(celestial.systemId, fine);
      container.addChild(fine);
      result.fineContainers.push(fine);
    }
    fine.addChild(sprite);
    result.fine.push(sprite);
    result.fineRadii.push(radius);
  }

  return result;
}

export function scaleCelestials(
  sprites: CelestialSprites,
  cameraScale: number,
): void {
  for (let i = 0; i < sprites.interior.length; i++) {
    sprites.interior[i].scale.set(
      spriteScale(sprites.interiorRadii[i], DOT_TEXTURE_RADIUS, cameraScale),
    );
  }
  for (let i = 0; i < sprites.fine.length; i++) {
    sprites.fine[i].scale.set(
      spriteScale(sprites.fineRadii[i], DOT_TEXTURE_RADIUS, cameraScale),
    );
  }
}

/** The fine bucket, toggled per system container rather than per sprite. */
export function setFineVisible(
  sprites: CelestialSprites,
  visible: boolean,
): void {
  for (const container of sprites.fineContainers) container.visible = visible;
}
