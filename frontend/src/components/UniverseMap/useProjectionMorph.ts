'use client';

import {
  cameraTransform,
  zoomToScale,
  type MapCamera,
} from '@/utils/map/camera';
import {
  easeInOut,
  lerpCamera,
  lerpPoint,
  MORPH_DURATION_MS,
  type MorphPoint,
} from '@/utils/map/morph';
import { useEffect, useRef, useState } from 'react';
import type { MapScene } from './scene/createScene';
import { scaleSystems, type SystemSprites } from './scene/systems';
import { useReducedMotion } from './useReducedMotion';

export interface MorphRun {
  scene: MapScene;
  sprites: SystemSprites;
  /** Where sprite i starts: the layout being left, in sprite order. */
  from: readonly MorphPoint[];
  /** Where it ends; null fades it out instead. */
  to: readonly (MorphPoint | null)[];
  fromCamera: MapCamera;
  toCamera: MapCamera;
  width: number;
  height: number;
  /** Called once, on the frame that lands. Never after an unmount. */
  onDone: () => void;
}

/**
 * The switch between layouts, run on the Pixi ticker like the ring spin.
 *
 * Every frame writes the sprites and the world transform directly — no React
 * state, no URL — because 36 renders of a 1,000-line component for one
 * animation would cost more than the animation. The caller hides everything
 * else for the run and builds it again in the new layout from `onDone`.
 */
export function useProjectionMorph(): { run(run: MorphRun): void } {
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const [morph] = useState(() => {
    let stop: (() => void) | null = null;

    return {
      run(r: MorphRun) {
        stop?.();
        if (reducedRef.current) {
          r.onDone();
          return;
        }

        const start = performance.now();
        const ticker = r.scene.app.ticker;
        const tick = () => {
          const raw = (performance.now() - start) / MORPH_DURATION_MS;
          const t = easeInOut(raw);

          for (let i = 0; i < r.sprites.sprites.length; i++) {
            const sprite = r.sprites.sprites[i];
            const end = r.to[i];
            if (end) {
              const p = lerpPoint(r.from[i], end, t);
              sprite.position.set(p.x, p.z);
            } else {
              sprite.alpha = 1 - t;
            }
          }

          const camera = lerpCamera(r.fromCamera, r.toCamera, t);
          const transform = cameraTransform(camera, r.width, r.height);
          r.scene.world.scale.set(transform.scaleX, transform.scaleY);
          r.scene.world.position.set(transform.x, transform.y);
          scaleSystems(r.sprites, zoomToScale(camera.zoom));

          if (raw >= 1) {
            ticker.remove(tick);
            stop = null;
            r.onDone();
          }
        };

        ticker.add(tick);
        stop = () => {
          // A destroyed app has already dropped its ticker, and the tick with it.
          ticker?.remove(tick);
          stop = null;
        };
      },
      dispose() {
        stop?.();
      },
    };
  });

  useEffect(() => morph.dispose, [morph]);
  return morph;
}
