'use client';

import { panCamera, zoomCameraAt, type MapCamera } from '@/utils/map/camera';
import { useEffect, useRef } from 'react';
import type { MapScene } from './scene/createScene';

export type ZoomLimits = { minZoom: number; maxZoom: number };

/**
 * How far the pointer may travel between down and up and still count as a
 * click. Without it every pan would open a popup, because a drag that starts
 * on the canvas also ends with a pointerup on the canvas.
 *
 * Measured from the pointerdown, not from the previous move: ten 1 px moves
 * are a 10 px drag, not ten clicks.
 */
export const CLICK_MOVE_TOLERANCE_PX = 4;

/** Canvas-relative, which is what a hit test in screen space needs. */
export interface PointerPosition {
  x: number;
  y: number;
}

export interface MapPick {
  /** Null means "nothing to hover": the pointer left, or a drag started. */
  onHover: (at: PointerPosition | null) => void;
  onSelect: (at: PointerPosition) => void;
}

/** Whatever pixi.js's Application exposes as its canvas. */
export type SceneCanvas = MapScene['app']['canvas'];

/**
 * Pan and zoom. deck.gl shipped a controller; Pixi does not, so the events
 * land here and the arithmetic lives in camera.ts where it is tested.
 *
 * The listeners are bound exactly once per canvas, not once per camera move.
 * `onCameraChange` fires on every pointermove, and `camera` — read back from
 * the caller's own state — changes with it; an effect that depended on
 * `camera` tore the five listeners down and rebuilt them on every tick,
 * losing `dragging` (a closure-local flag) in the process. A drag then froze
 * after its first pixel: the next pointermove found `dragging` reset to
 * `false`, with no pointerdown to set it again until the button was lifted
 * and pressed once more.
 *
 * Instead, the latest camera, limits and callback live in refs that small
 * effects keep current; the handlers read the refs, so they never need to
 * appear in the binding effect's dependency array. The handlers also write
 * the camera ref directly after computing a move, rather than waiting for
 * the caller's next render — consecutive pointermove events can otherwise
 * outrun React's commit, which would reintroduce the same staleness this
 * hook exists to remove.
 */
export function useMapPointer(
  canvas: SceneCanvas | null,
  camera: MapCamera | null,
  limits: ZoomLimits | null,
  onCameraChange: (next: MapCamera) => void,
  pick?: MapPick,
): void {
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  const limitsRef = useRef(limits);
  useEffect(() => {
    limitsRef.current = limits;
  }, [limits]);

  const onCameraChangeRef = useRef(onCameraChange);
  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);

  // Same reason as the three above: the listeners bind once per canvas, so the
  // handlers read the latest callbacks through a ref rather than taking them as
  // dependencies. `pick` is rebuilt on every camera move — the projection it
  // closes over has changed — and rebinding on that would resurrect the
  // freeze-after-one-pixel bug this whole hook is shaped around.
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  }, [pick]);

  useEffect(() => {
    if (!canvas) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    let movedBeyondTolerance = false;
    // The pointer's latest canvas-relative position, and the frame that will
    // report it. `pointermove` fires dozens of times a second; the hit test is
    // cheap but writing React state at that rate is not.
    let hoverAt: PointerPosition | null = null;
    let hoverFrame: number | null = null;

    const canvasPosition = (e: PointerEvent): PointerPosition => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const scheduleHover = (at: PointerPosition) => {
      hoverAt = at;
      if (hoverFrame !== null) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = null;
        if (hoverAt) pickRef.current?.onHover(hoverAt);
      });
    };

    const cancelHover = () => {
      if (hoverFrame !== null) {
        cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
      }
      hoverAt = null;
      pickRef.current?.onHover(null);
    };

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      movedBeyondTolerance = false;
      // A press starts either a drag or a click, and neither wants a hover tip
      // in the way.
      cancelHover();
    };
    const up = (e: PointerEvent) => {
      const wasDragging = dragging;
      dragging = false;
      if (wasDragging && !movedBeyondTolerance) {
        pickRef.current?.onSelect(canvasPosition(e));
      }
    };
    const leave = () => {
      dragging = false;
      cancelHover();
    };
    const move = (e: PointerEvent) => {
      if (!dragging) {
        scheduleHover(canvasPosition(e));
        return;
      }
      if (
        Math.abs(e.clientX - downX) > CLICK_MOVE_TOLERANCE_PX ||
        Math.abs(e.clientY - downY) > CLICK_MOVE_TOLERANCE_PX
      ) {
        movedBeyondTolerance = true;
      }
      if (!cameraRef.current) return;
      const next = panCamera(
        cameraRef.current,
        e.clientX - lastX,
        e.clientY - lastY,
      );
      lastX = e.clientX;
      lastY = e.clientY;
      cameraRef.current = next;
      onCameraChangeRef.current(next);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current || !limitsRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const next = zoomCameraAt(
        cameraRef.current,
        -e.deltaY / 300,
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height,
        limitsRef.current,
      );
      cameraRef.current = next;
      onCameraChangeRef.current(next);
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('wheel', wheel, { passive: false });

    return () => {
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [canvas]);
}
