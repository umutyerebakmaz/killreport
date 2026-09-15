'use client';

import { panCamera, zoomCameraAt, type MapCamera } from '@/utils/map/camera';
import type { MapArea } from '@/utils/map/edges';
import { useEffect, useRef } from 'react';

export type ZoomLimits = { minZoom: number; maxZoom: number };

/**
 * How far the pointer may travel between down and up and still count as a
 * click. Without it every pan would open a popup, because a drag that starts
 * on the map also ends with a pointerup on the map.
 *
 * Measured from the pointerdown, not from the previous move: ten 1 px moves
 * are a 10 px drag, not ten clicks.
 */
export const CLICK_MOVE_TOLERANCE_PX = 4;

/**
 * Host-relative, which is what a hit test in screen space needs. The canvas
 * fills the host, so these are the canvas's own coordinates too.
 */
export interface PointerPosition {
  x: number;
  y: number;
}

export interface MapPick {
  /** Null means "nothing to hover": the pointer left, or a drag started. */
  onHover: (at: PointerPosition | null) => void;
  /** A label was hovered, so the system is known without a hit test. */
  onHoverSystem: (systemId: number) => void;
  onSelect: (at: PointerPosition) => void;
  /** A label was clicked. */
  onSelectSystem: (systemId: number) => void;
  /**
   * An area name — a region's or a constellation's — is under the pointer, or
   * null for none. Hover rather than click: the highlight answers "which lines
   * are this area's", a question that wants no dismissing.
   */
  onHoverArea: (area: MapArea | null) => void;
}

/**
 * Pan and zoom. deck.gl shipped a controller; Pixi does not, so the events
 * land here and the arithmetic lives in camera.ts where it is tested.
 *
 * Bound to the HOST, not to the canvas. The label overlay sits above the
 * canvas and its system names take pointer events, so a press or a wheel that
 * starts on a name never reaches the canvas at all — the map would freeze
 * exactly where it is labelled. Listening on the host puts every one of those
 * events back in reach, because they bubble out of the label to it. The canvas
 * fills the host, so `getBoundingClientRect` reports the same box a
 * canvas-bound version read.
 *
 * The listeners are bound exactly once per host, not once per camera move.
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
  host: HTMLElement | null,
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

  // Same reason as the three above: the listeners bind once per host, so the
  // handlers read the latest callbacks through a ref rather than taking them as
  // dependencies. `pick` is rebuilt on every camera move — the projection it
  // closes over has changed — and rebinding on that would resurrect the
  // freeze-after-one-pixel bug this whole hook is shaped around.
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  }, [pick]);

  useEffect(() => {
    if (!host) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    let movedBeyondTolerance = false;
    // The pointer's latest host-relative position, or the label it is over,
    // and the frame that will report whichever it is. `pointermove` fires
    // dozens of times a second; the hit test is cheap but writing React state
    // at that rate is not.
    let hoverAt: PointerPosition | null = null;
    let hoverSystemId: number | null = null;
    let hoverArea: MapArea | null = null;
    let hoverFrame: number | null = null;

    const hostPosition = (e: PointerEvent): PointerPosition => {
      const rect = host.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    /** The id a stamped label carries, for either tier's stamp. */
    const labelId = (
      e: Event,
      selector: string,
      key: 'mapSystem' | 'mapRegion' | 'mapConstellation',
    ): number | null => {
      const target = e.target;
      if (!(target instanceof Element)) return null;
      const label = target.closest(selector);
      const raw = label instanceof HTMLElement ? label.dataset[key] : undefined;
      if (!raw) return null;
      const id = Number(raw);
      return Number.isFinite(id) ? id : null;
    };

    /**
     * The system a pointer event landed on by way of a label, or null.
     *
     * One picking path with one drag-tolerance rule, not two: the shortcut
     * answers WHAT was hit, and everything about WHETHER it counts as a click
     * is left to the handlers below, unchanged.
     */
    const labelSystemId = (e: Event): number | null =>
      labelId(e, '[data-map-system]', 'mapSystem');

    /**
     * The area a name stands for, or null. Region first: the two stamps are on
     * different elements, so the order only decides which is asked about
     * first, and the coarser tier is the cheaper miss.
     */
    const labelArea = (e: Event): MapArea | null => {
      const regionId = labelId(e, '[data-map-region]', 'mapRegion');
      if (regionId !== null) return { tier: 'region', id: regionId };
      const constellationId = labelId(
        e,
        '[data-map-constellation]',
        'mapConstellation',
      );
      return constellationId === null
        ? null
        : { tier: 'constellation', id: constellationId };
    };

    /**
     * Whether an event came from an overlay panel rather than from the map.
     *
     * Everything the host contains bubbles to these listeners, SystemPopup
     * included — it is a child of the host, not a sibling of it. Without this
     * a drag across the panel would pan the map underneath it, and a click on
     * the panel would be hit-tested as a click on the panel's own pixels, find
     * no system there and close the very panel that was clicked. A label is
     * deliberately not an overlay: a name is part of the map, and a drag from
     * one pans.
     */
    const fromOverlay = (e: Event): boolean =>
      e.target instanceof Element &&
      e.target.closest('[data-map-overlay]') !== null;

    // One frame for all three kinds of hover, so crossing between a label and
    // the canvas cannot queue two reports for a single frame.
    const scheduleHoverFrame = () => {
      if (hoverFrame !== null) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = null;
        // Reported every frame rather than only on a change: the caller's
        // setState bails out on an unchanged value, and one unconditional call
        // is what keeps "where the pointer ended" the whole answer.
        pickRef.current?.onHoverArea(hoverArea);
        if (hoverArea !== null) {
          // A name is drawn over the map, not part of it: while the pointer
          // rests on one there is no system under it to tip.
          pickRef.current?.onHover(null);
        } else if (hoverSystemId !== null) {
          pickRef.current?.onHoverSystem(hoverSystemId);
        } else if (hoverAt) {
          pickRef.current?.onHover(hoverAt);
        }
      });
    };

    const scheduleHover = (at: PointerPosition) => {
      hoverAt = at;
      hoverSystemId = null;
      hoverArea = null;
      scheduleHoverFrame();
    };

    const scheduleHoverSystem = (systemId: number) => {
      hoverAt = null;
      hoverSystemId = systemId;
      hoverArea = null;
      scheduleHoverFrame();
    };

    const scheduleHoverArea = (area: MapArea) => {
      hoverAt = null;
      hoverSystemId = null;
      // The same area keeps the same object. The caller holds this in state and
      // rebuilds the highlight from it, so minting a fresh object on every
      // pointermove across one name would redraw that area's mesh dozens of
      // times a second for an answer that never changed. Every other hover
      // report is a primitive and got this for free.
      if (hoverArea?.tier !== area.tier || hoverArea.id !== area.id) {
        hoverArea = area;
      }
      scheduleHoverFrame();
    };

    const cancelHover = () => {
      if (hoverFrame !== null) {
        cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
      }
      hoverAt = null;
      hoverSystemId = null;
      hoverArea = null;
      pickRef.current?.onHover(null);
      pickRef.current?.onHoverArea(null);
    };

    const down = (e: PointerEvent) => {
      // `cancelHover()`, not a bare return: a press on the panel leaves the
      // tip that was up behind it, and the host keeps the pointer cursor a
      // hovered name gave it.
      if (fromOverlay(e)) {
        cancelHover();
        return;
      }
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
      // A press the host declined never set `dragging`, so an overlay panel
      // needs no second guard here.
      if (!wasDragging || movedBeyondTolerance) return;

      const id = labelSystemId(e);
      if (id !== null) {
        pickRef.current?.onSelectSystem(id);
        return;
      }
      pickRef.current?.onSelect(hostPosition(e));
    };
    const leave = () => {
      dragging = false;
      cancelHover();
    };
    const move = (e: PointerEvent) => {
      if (!dragging) {
        // A pointer resting on the panel is not hovering the map. Without this
        // the panel's own pixels are hit-tested every frame: a dot underneath
        // lights up, a hover tip renders behind the panel and the host takes
        // the label cursor. Cancelling rather than returning is what clears
        // the tip the pointer left behind on its way in — the canvas used to
        // get a `pointerleave` for exactly this.
        //
        // Deliberately only on this branch. A guard in the dragging branch
        // below would drop the move without updating lastX/lastY, so a pan
        // crossing the panel would stall and then jump.
        if (fromOverlay(e)) {
          cancelHover();
          return;
        }
        const area = labelArea(e);
        if (area !== null) {
          scheduleHoverArea(area);
          return;
        }
        const id = labelSystemId(e);
        if (id !== null) {
          scheduleHoverSystem(id);
          return;
        }
        scheduleHover(hostPosition(e));
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
      if (fromOverlay(e)) return;
      e.preventDefault();
      if (!cameraRef.current || !limitsRef.current) return;
      const rect = host.getBoundingClientRect();
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

    host.addEventListener('pointerdown', down);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointerleave', leave);
    host.addEventListener('pointermove', move);
    host.addEventListener('wheel', wheel, { passive: false });

    return () => {
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('wheel', wheel);
    };
  }, [host]);
}
