'use client';

import { panCamera, zoomCameraAt, type MapCamera } from '@/utils/map/camera';
import { useEffect, useRef } from 'react';
import type { MapScene } from './scene/createScene';

export type ZoomLimits = { minZoom: number; maxZoom: number };

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

  useEffect(() => {
    if (!canvas) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = () => (dragging = false);
    const move = (e: PointerEvent) => {
      if (!dragging || !cameraRef.current) return;
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
    canvas.addEventListener('pointerleave', up);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('wheel', wheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', up);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [canvas]);
}
