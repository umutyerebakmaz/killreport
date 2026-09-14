import type { MapNode } from '@/generated/graphql';
import { securityTint } from '@/utils/map/colors';
import { spriteScale, systemFloorPx, systemRadiusPx } from '@/utils/map/marks';
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
 *
 * `cameraScale` is taken here rather than left to the caller's next camera
 * pass: a sprite built at Pixi's default scale of 1 is one texture radius of
 * *world* — 64 metres, roughly 1e-9 px at galaxy zoom — so a build that did not
 * size what it made would be invisible until the camera happened to move.
 */
export function buildSystems(
  scene: MapScene,
  nodes: MapNode[],
  cameraScale: number,
): SystemSprites {
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

  const built = { sprites, radii };
  scaleSystems(built, cameraScale);
  return built;
}

/**
 * The counter-scale pass. Measured at 0.60 ms for 5,241 systems, which is 3.6%
 * of a 60 fps frame and runs only when the zoom changes — not per frame, and
 * deliberately not debounced, because the disc growing continuously is the
 * whole feel of the approach.
 *
 * The floor is resolved once, outside the loop: it is a function of the zoom
 * alone, so 5,241 sprites share one value and recovering the zoom per sprite
 * would be 5,241 logarithms for an answer that cannot change between them.
 */
export function scaleSystems(
  { sprites, radii }: SystemSprites,
  cameraScale: number,
): void {
  const floorPx = systemFloorPx(Math.log2(cameraScale));

  for (let i = 0; i < sprites.length; i++) {
    sprites[i].scale.set(
      spriteScale(
        systemRadiusPx(radii[i], cameraScale, floorPx),
        DOT_TEXTURE_RADIUS,
        cameraScale,
      ),
    );
  }
}
