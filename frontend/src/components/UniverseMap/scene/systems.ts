import type { MapNode } from '@/generated/graphql';
import { securityTint } from '@/utils/map/colors';
import type { MapColorLayer, MapLayerData } from '@/utils/map/layers';
import { spriteScale, systemFloorPx, systemRadiusPx } from '@/utils/map/marks';
import {
  discRadiusPx,
  LOGO_MIN_RADIUS_PX,
  LOGO_TEXTURE_RADIUS,
} from '@/utils/map/sovLogos';
import { Sprite, type Texture } from 'pixi.js';
import { DOT_TEXTURE_RADIUS, type MapScene } from './createScene';
import type { LogoAtlas } from './logoAtlas';

export interface SystemSprites {
  sprites: Sprite[];
  radii: number[];
  /**
   * Per sprite, whether it is currently showing a logo. Two marks with two
   * texture radii and two floors share one pass, so the pass has to know which
   * of them it is looking at — and a system with no owner stays a dot even at
   * a zoom where its neighbours are logos.
   */
  logos: boolean[];
  /**
   * The owner disc behind each mark, one per system and hidden until its
   * system is showing a logo. Built with the sprites rather than on demand:
   * making 5,228 of them at the moment the threshold is crossed would put the
   * allocation in the middle of the zoom it is meant to be invisible to.
   *
   * The same texture the dots are drawn from — a filled white circle is a
   * filled white circle, and one texture for both marks keeps them in a single
   * batch.
   */
  discs: Sprite[];
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
  scene.discs.removeChildren();

  const sprites: Sprite[] = [];
  const radii: number[] = [];
  const logos: boolean[] = [];
  const discs: Sprite[] = [];

  for (const node of nodes) {
    const sprite = new Sprite(scene.dot);
    sprite.anchor.set(0.5);
    sprite.position.set(node.x, node.z);
    sprite.tint = securityTint(node.securityStatus);
    sprites.push(sprite);
    radii.push(node.radius);
    logos.push(false);
    scene.systems.addChild(sprite);

    const disc = new Sprite(scene.dot);
    disc.anchor.set(0.5);
    disc.position.set(node.x, node.z);
    disc.visible = false;
    discs.push(disc);
    scene.discs.addChild(disc);
  }

  const built = { sprites, radii, logos, discs };
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
  { sprites, radii, logos, discs }: SystemSprites,
  cameraScale: number,
): void {
  const floorPx = systemFloorPx(Math.log2(cameraScale));

  for (let i = 0; i < sprites.length; i++) {
    // A logo is a mark, not a body: it has a floor of its own and a texture
    // twice the dot's. Past the approach the system's own radius overtakes
    // both, so the logo grows with the disc rather than sitting in the middle
    // of it.
    const textureRadius = logos[i] ? LOGO_TEXTURE_RADIUS : DOT_TEXTURE_RADIUS;
    const floor = logos[i] ? Math.max(floorPx, LOGO_MIN_RADIUS_PX) : floorPx;
    const radiusPx = systemRadiusPx(radii[i], cameraScale, floor);

    const scale = spriteScale(radiusPx, textureRadius, cameraScale);

    // NEGATIVE y for a logo, and only for a logo. The world container's
    // scaleY is negative — `cameraTransform` flips the axis there so that the
    // map agrees with the region thumbnails — which mirrors every sprite
    // vertically. A disc and a dot are circles and cannot show it; a crest
    // can, and was drawn upside down until this line. The two negatives
    // cancel and nothing else in the scene is touched.
    sprites[i].scale.set(scale, logos[i] ? -scale : scale);

    // The disc is sized from the logo it backs, not from the system: the two
    // have to move together or the colour drifts out from under the crest.
    if (logos[i]) {
      discs[i].scale.set(
        spriteScale(discRadiusPx(radiusPx), DOT_TEXTURE_RADIUS, cameraScale),
      );
    }
  }
}

/**
 * The layer's colour on every sprite. One pass, run on a layer change and not
 * on a camera move: nothing here depends on the zoom.
 */
export function applyLayer(
  { sprites }: SystemSprites,
  nodes: MapNode[],
  layer: MapColorLayer,
  data: MapLayerData,
): void {
  for (let i = 0; i < sprites.length; i++) {
    sprites[i].tint = layer.tint(nodes[i], data);
  }
}

/**
 * Dots to logos and back, at the one threshold.
 *
 * Called after `applyLayer`, never instead of it: the layer writes the colour
 * and this whitens only the sprites that ended up showing a logo of their own.
 * The owners drawing the shared default emblem keep their colour — the emblem
 * is identical for all of them, so the tint is the only thing left that says
 * which alliance a system belongs to.
 *
 * A system with no owner, an owner with no cell, and the whole of the map
 * before the atlas has arrived all stay dots.
 */
export function applyLogos(
  built: SystemSprites,
  nodes: MapNode[],
  dot: Texture,
  atlas: LogoAtlas | null,
  on: boolean,
  ownerBySystem: Map<number, number>,
  cameraScale: number,
): void {
  const { sprites, logos, discs } = built;

  for (let i = 0; i < sprites.length; i++) {
    const ownerId = ownerBySystem.get(nodes[i].systemId);
    const logo =
      on && atlas && ownerId !== undefined
        ? atlas.textureByOwner.get(ownerId)
        : undefined;

    if (logo) {
      // Read before the whitening below: what the layer wrote IS the owner's
      // colour, so the disc inherits the same decision rather than resolving
      // the dictionary a second time — including the neutral an owner with no
      // entry was given.
      discs[i].tint = sprites[i].tint;
      discs[i].visible = true;

      sprites[i].texture = logo;
      logos[i] = true;
      // Every logo is white now, including the shared default emblem. The
      // disc behind it carries the owner's colour, and tinting the emblem the
      // same colour it sits on would paint it out of existence — which is
      // what the earlier per-owner tint would now do.
      sprites[i].tint = 0xffffff;
    } else {
      sprites[i].texture = dot;
      logos[i] = false;
      discs[i].visible = false;
    }
  }

  // The texture radius just changed under half the sprites, so the
  // counter-scale has to run before the next frame draws them at the other
  // mark's size.
  scaleSystems(built, cameraScale);
}
