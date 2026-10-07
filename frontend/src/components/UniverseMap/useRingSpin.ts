'use client';

import {
  ringSpinAngle,
  shouldSpinRings,
  type RingMark,
} from '@/utils/map/campaignMarks';
import type { Application } from 'pixi.js';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { drawRings } from './scene/campaignRings';
import type { MapScene } from './scene/createScene';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  // jsdom, and nothing else this site runs in, has no matchMedia.
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION).matches
  );
}

/** The handle the ring effect draws through. */
export interface RingSpin {
  /**
   * Draws `rings` into the scene at once and keeps them for the ticker. A
   * null scene — not built yet, or torn down — draws nothing and stops.
   */
  update(scene: MapScene | null, rings: readonly RingMark[]): void;
}

/**
 * The spin's state, outside React: the ticker reads it every frame, and none
 * of it is anything a render shows.
 */
function createRingSpin() {
  let scene: MapScene | null = null;
  let rings: readonly RingMark[] = [];
  let reduced = false;
  // The app the tick is attached to, or null while the rings stand still.
  let spinningOn: Application | null = null;

  const draw = () => {
    if (!scene) return;
    drawRings(
      scene.rings,
      rings,
      reduced ? 0 : ringSpinAngle(performance.now()),
    );
  };

  const stop = () => {
    // A destroyed app has already dropped its ticker, and the tick with it.
    spinningOn?.ticker?.remove(draw);
    spinningOn = null;
  };

  const sync = () => {
    const app = scene?.app ?? null;
    const spin = app !== null && shouldSpinRings(rings.length, reduced);
    if (spinningOn && (!spin || spinningOn !== app)) stop();
    if (spin && !spinningOn) {
      app.ticker.add(draw);
      spinningOn = app;
    }
  };

  return {
    update(nextScene: MapScene | null, nextRings: readonly RingMark[]) {
      scene = nextScene;
      rings = nextRings;
      draw();
      sync();
    },
    setReducedMotion(next: boolean) {
      reduced = next;
      draw();
      sync();
    },
    /** Unmount: off the ticker, and no hold on a scene about to be destroyed. */
    dispose() {
      stop();
      scene = null;
    },
  };
}

/**
 * The campaign rings' spin: every ring turns clockwise, once per
 * RING_SPIN_PERIOD_MS, like EVE's own current-system marker.
 *
 * The ring effect hands each new ring list to `update`, which draws it at
 * once and keeps it; a callback on the Pixi app's ticker then redraws the
 * kept list at the clock's angle every frame. The callback is attached only
 * while `shouldSpinRings` says so — at least one ring, and no reduced-motion
 * preference — and removed the moment the list empties, the layer goes off or
 * the map unmounts. A viewer who asked for reduced motion gets the same arcs,
 * standing still at angle 0.
 *
 * The ticker callback only rewrites the Graphics. Rendering is not its job:
 * the app's ticker starts on init and renders the stage every frame already
 * (Pixi's TickerPlugin, `autoStart`), so the new arcs go out with the next
 * frame it draws.
 */
export function useRingSpin(): RingSpin {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false,
  );
  const [spin] = useState(createRingSpin);

  useEffect(() => {
    spin.setReducedMotion(reducedMotion);
  }, [spin, reducedMotion]);

  useEffect(() => spin.dispose, [spin]);

  return spin;
}
