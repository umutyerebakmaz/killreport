'use client';

import type { MapScope } from '@/generated/graphql';
import {
  cameraQuery,
  parseCamera,
  parseFocus,
  parseLayer,
  parseOwner,
  type MapCamera,
} from '@/utils/map/camera';
import type { MapLayerId } from '@/utils/map/layers';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 250 ms. Without it a drag writes a history entry per frame; with a longer one
 * the URL lags visibly behind the view when you stop moving.
 */
const URL_DEBOUNCE_MS = 250;

/** Own writes remembered while in flight; far more than a pan ever has. */
const MAX_PENDING = 8;

/**
 * One write of the URL: everything this hook owns there.
 *
 * The layer and the owner are here, beside the camera and the focus, because
 * the URL has to have exactly one writer. Two hooks calling `router.replace`
 * would each overwrite the other's parameters, and the "is this my own write"
 * comparison below only works when one serialisation describes the whole URL.
 */
interface WrittenUrl {
  camera: MapCamera;
  focus: number | null;
  layer: MapLayerId;
  owner: number | null;
}

function queryOf(scope: MapScope, url: WrittenUrl): string {
  return cameraQuery(scope, url.camera, url.focus, url.layer, url.owner);
}

export function useMapCamera(scope: MapScope, fallback: MapCamera | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [camera, setCamera] = useState<MapCamera | null>(() =>
    parseCamera(searchParams),
  );
  const [focus, setFocus] = useState<number | null>(() =>
    parseFocus(searchParams),
  );
  const [layer, setLayer] = useState<MapLayerId>(() =>
    parseLayer(searchParams),
  );
  const [owner, setOwner] = useState<number | null>(() =>
    parseOwner(searchParams),
  );

  /**
   * The URLs this hook has written that the router has not handed back yet,
   * oldest first, so its own writes are recognisable when they land.
   *
   * A list, not the last write alone: `router.replace` commits some time after
   * it is called, and a pan that pauses twice has two writes in flight. With
   * only the latest remembered, the older one landing after it read as a
   * foreign URL and snapped the camera back to where it had been.
   */
  const pending = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The autofit is not known until the geometry lands, so until the pointer has
  // moved the camera simply *is* the fallback — resolved here at render time
  // rather than copied into state by an effect. Writing it to state would cost
  // an extra render pass and trips react-hooks/set-state-in-effect; it would
  // also pin the very first frame, so a window resized before anyone touched
  // the map would keep the stale one. Once `camera` is set, `fallback` is
  // ignored, which is what keeps a later resize from throwing away where the
  // user has moved to.
  const effective = camera ?? fallback;

  const write = useCallback(
    (next: WrittenUrl, immediate: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      const run = () => {
        const query = queryOf(scope, next);
        // Bounded: a write the router never hands back — superseded before
        // it rendered — would otherwise stay here for the session.
        pending.current = [...pending.current, query].slice(-MAX_PENDING);
        router.replace(`?${query}`, { scroll: false });
      };
      // A pan is a stream of events and is debounced. A click is one event:
      // waiting out the debounce to put the popup in the URL would lose it to a
      // back button pressed in between.
      if (immediate) run();
      else timer.current = setTimeout(run, URL_DEBOUNCE_MS);
    },
    [router, scope],
  );

  // The URL is authoritative for anything that did not come from the pointer: a
  // nav link, the back button, a pasted link. App Router keeps this component
  // mounted across a query string change, so reading once on mount would
  // swallow all three.
  //
  // Its own writes are recognised by comparing one pure function's output
  // against itself, and left alone entirely: the state already holds the
  // newest write, and an older one landing late must not drag the camera, the
  // focus, the layer or the owner back to it. Every write older than the one
  // that landed is dropped with it — the router will not hand those back now.
  //
  // The camera is applied through a functional update rather than `setCamera
  // (fromUrl)`: parseCamera allocates a fresh object every call, so a plain set
  // can never bail out on equality and every URL change would re-render whether
  // the frame moved or not. Returning `current` when the two agree is what makes
  // the no-op actually free.
  //
  // The focus, the layer and the owner are primitives, so setting one to the
  // value it already holds costs nothing, and they are read even when the URL
  // carries no camera: a `?focus=` link has no x/z/zoom.
  //
  // Deliberately not guarded against the current state, and the state is
  // deliberately not a dependency. The URL is an external store and this effect
  // is the subscription to it — the use react-hooks' set-state-in-effect rule's
  // own documentation allows, which it cannot recognise here because
  // `searchParams` reaches the hook as a value rather than through a callback.
  // A guard against the state would be wrong: between a write and the router
  // committing it, the stale searchParams would revert the change the user just
  // made. With `[searchParams]` alone the effect does not run in that window.
  useEffect(() => {
    const fromUrl = parseCamera(searchParams);
    const nextFocus = parseFocus(searchParams);
    const nextLayer = parseLayer(searchParams);
    const nextOwner = parseOwner(searchParams);

    if (fromUrl) {
      const own = pending.current.indexOf(
        cameraQuery(scope, fromUrl, nextFocus, nextLayer, nextOwner),
      );
      if (own !== -1) {
        pending.current = pending.current.slice(own + 1);
        return;
      }
    }
    pending.current = [];

    /* eslint-disable react-hooks/set-state-in-effect */
    if (fromUrl) {
      setCamera((current) =>
        current &&
        current.x === fromUrl.x &&
        current.z === fromUrl.z &&
        current.zoom === fromUrl.zoom
          ? current
          : fromUrl,
      );
    }
    setFocus(nextFocus);
    setLayer(nextLayer);
    setOwner(nextOwner);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams, scope]);

  const onCameraChange = useCallback(
    (next: MapCamera) => {
      setCamera(next);
      write({ camera: next, focus, layer, owner }, false);
    },
    [write, focus, layer, owner],
  );

  const onFocusChange = useCallback(
    (next: number | null) => {
      setFocus(next);
      // Before the geometry lands there is no frame to write the selection
      // against. The state still moves, so the popup opens either way.
      if (effective)
        write({ camera: effective, focus: next, layer, owner }, true);
    },
    [write, effective, layer, owner],
  );

  const onLayerChange = useCallback(
    (next: MapLayerId) => {
      // An isolated owner belongs to the sovereignty layer; leaving it drops
      // the isolation rather than carrying it, invisible, into the next visit.
      const nextOwner = next === 'sovereignty' ? owner : null;
      setLayer(next);
      setOwner(nextOwner);
      if (effective) {
        write(
          { camera: effective, focus, layer: next, owner: nextOwner },
          true,
        );
      }
    },
    [write, effective, focus, owner],
  );

  const onOwnerChange = useCallback(
    (next: number | null) => {
      setOwner(next);
      if (effective)
        write({ camera: effective, focus, layer, owner: next }, true);
    },
    [write, effective, focus, layer],
  );

  // A camera move and a selection as ONE write. A panel row does both, and as
  // two calls the debounced camera write would land a moment later carrying the
  // focus it closed over — the old one — and close the popup it just opened.
  const jumpTo = useCallback(
    (nextCamera: MapCamera, nextFocus?: number | null) => {
      const resolvedFocus = nextFocus === undefined ? focus : nextFocus;
      setCamera(nextCamera);
      setFocus(resolvedFocus);
      write({ camera: nextCamera, focus: resolvedFocus, layer, owner }, true);
    },
    [write, focus, layer, owner],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    camera: effective,
    onCameraChange,
    focus,
    onFocusChange,
    layer,
    onLayerChange,
    // Reported only where it means something; the URL may still carry one the
    // security layer cannot use.
    owner: layer === 'sovereignty' ? owner : null,
    onOwnerChange,
    jumpTo,
  };
}
