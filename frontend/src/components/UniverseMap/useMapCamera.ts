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

  // Mirrored into refs so the two callbacks below can read the current values
  // without taking them as dependencies — a new onCameraChange identity on
  // every selection would churn the pointer hook for nothing.
  const effectiveCamera = useRef(effective);
  const currentFocus = useRef(focus);
  useEffect(() => {
    effectiveCamera.current = effective;
    currentFocus.current = focus;
  }, [effective, focus]);

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
  useEffect(() => {
    const urlCamera = parseCamera(searchParams);
    const urlFocus = parseFocus(searchParams);

    if (
      lastWritten.current &&
      urlCamera &&
      cameraQuery(scope, urlCamera, urlFocus) ===
        cameraQuery(
          scope,
          lastWritten.current.camera,
          lastWritten.current.focus,
        )
    ) {
      return;
    }

    // A URL with no camera leaves the current one alone — that is a `?region=`
    // link, and the framing reaches the hook as the fallback instead.
    if (urlCamera) setCamera(urlCamera);
    setFocus(urlFocus);
  }, [searchParams, scope]);

  const onCameraChange = useCallback(
    (next: MapCamera) => {
      setCamera(next);
      write({ camera: next, focus: currentFocus.current }, false);
    },
    [write],
  );

  const onFocusChange = useCallback(
    (next: number | null) => {
      setFocus(next);
      // Before the geometry lands there is no frame to write the selection
      // against. The state still moves, so the popup opens either way.
      const against = effectiveCamera.current;
      if (against) write({ camera: against, focus: next }, true);
    },
    [write],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { camera: effective, onCameraChange, focus, onFocusChange };
}
