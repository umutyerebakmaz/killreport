import type { MapNode } from '@/generated/graphql';
import { securityTint } from '@/utils/map/colors';
import { spriteScale, systemRadiusPx } from '@/utils/map/marks';
import { Sprite } from 'pixi.js';
import { DOT_TEXTURE_RADIUS, type MapScene } from './createScene';

export interface SystemSprites {
  sprites: Sprite[];
  radii: number[];
}

/**
 * One sprite per system, sharing one texture so Pixi batches the lot.
 *
 * The position is the raw galactic metre, with no origin subtracted: Pixi
 * composes the transform in float64 and only the resulting screen coordinate
 * reaches float32.
 */
export function buildSystems(scene: MapScene, nodes: MapNode[]): SystemSprites {
  scene.systems.removeChildren();

  const sprites: Sprite[] = [];
  const radii: number[] = [];

  for (const node of nodes) {
    const sprite = new Sprite(scene.dot);
    sprite.anchor.set(0.5);
    sprite.position.set(node.x, node.z);
    sprite.tint = securityTint(node.securityStatus);
    sprites.push(sprite);
    radii.push(node.radius);
    scene.systems.addChild(sprite);
  }

  return { sprites, radii };
}

/**
 * The counter-scale pass. Measured at 0.60 ms for 5,241 systems, which is 3.6%
 * of a 60 fps frame and runs only when the zoom changes — not per frame, and
 * deliberately not debounced, because the disc growing continuously is the
 * whole feel of the approach.
 */
export function scaleSystems(
  { sprites, radii }: SystemSprites,
  cameraScale: number,
): void {
  for (let i = 0; i < sprites.length; i++) {
    sprites[i].scale.set(
      spriteScale(
        systemRadiusPx(radii[i], cameraScale),
        DOT_TEXTURE_RADIUS,
        cameraScale,
      ),
    );
  }
}
