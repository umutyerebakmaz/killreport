'use client';

import type { MapScope } from '@/generated/graphql';
import {
  cameraQuery,
  parseCamera,
  parseFocus,
  type MapCamera,
} from '@/utils/map/camera';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 250 ms. Without it a drag writes a history entry per frame; with a longer one
 * the URL lags visibly behind the view when you stop moving.
 */
const URL_DEBOUNCE_MS = 250;

/** One write of the URL: the two things this hook owns there. */
interface WrittenUrl {
  camera: MapCamera;
  focus: number | null;
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

  /** The last URL this hook wrote, so its own writes are recognisable. */
  const lastWritten = useRef<WrittenUrl | null>(null);
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
        lastWritten.current = next;
        router.replace(`?${cameraQuery(scope, next.camera, next.focus)}`, {
          scroll: false,
        });
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
  // Telling its own writes apart is a comparison of one pure function's output
  // against itself, which is why the focus came along for free when cameraQuery
  // took a third argument.
  //
  // The camera is applied through a functional update rather than `setCamera
  // (fromUrl)`: parseCamera allocates a fresh object every call, so a plain set
  // can never bail out on equality and every URL change would re-render whether
  // the frame moved or not. Returning `current` when the two agree is what makes
  // the no-op actually free — and is what react-hooks' set-state-in-effect rule
  // is asking for.
  useEffect(() => {
    const fromUrl = parseCamera(searchParams);
    if (!fromUrl) return;

    const written = lastWritten.current;
    if (
      written &&
      cameraQuery(scope, fromUrl, parseFocus(searchParams)) ===
        cameraQuery(scope, written.camera, written.focus)
    ) {
      return;
    }

    setCamera((current) =>
      current &&
      current.x === fromUrl.x &&
      current.z === fromUrl.z &&
      current.zoom === fromUrl.zoom
        ? current
        : fromUrl,
    );
  }, [searchParams, scope]);

  // A focus is a number, so setting it to the value it already holds costs
  // nothing. Its own effect rather than the camera's: a `?focus=` link carries
  // no x/z/zoom, and behind that effect's early return the selection would
  // never reach state at all.
  //
  // Deliberately unguarded, and `focus` is deliberately not a dependency. The
  // URL is an external store and this effect is the subscription to it — the
  // use the rule's own documentation allows, which it cannot recognise here
  // because `searchParams` reaches the hook as a value rather than through a
  // callback. Comparing against the current focus is what a guard would mean,
  // and it would be wrong: between `onFocusChange` writing the URL and the
  // router committing it, the stale searchParams would revert the selection the
  // user just made. With `[searchParams]` alone the effect simply does not run
  // in that window, and the write path is what keeps the two in agreement.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocus(parseFocus(searchParams));
  }, [searchParams]);

  const onCameraChange = useCallback(
    (next: MapCamera) => {
      setCamera(next);
      write({ camera: next, focus }, false);
    },
    [write, focus],
  );

  const onFocusChange = useCallback(
    (next: number | null) => {
      setFocus(next);
      // Before the geometry lands there is no frame to write the selection
      // against. The state still moves, so the popup opens either way.
      if (effective) write({ camera: effective, focus: next }, true);
    },
    [write, effective],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { camera: effective, onCameraChange, focus, onFocusChange };
}
