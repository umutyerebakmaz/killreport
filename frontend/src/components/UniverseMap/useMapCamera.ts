'use client';

import type { MapScope } from '@/generated/graphql';
import { cameraQuery, parseCamera, type MapCamera } from '@/utils/map/camera';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 250 ms. Without it a drag writes a history entry per frame; with a longer one
 * the URL lags visibly behind the view when you stop moving.
 */
const URL_DEBOUNCE_MS = 250;

export function useMapCamera(scope: MapScope, fit: MapCamera | null) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [camera, setCamera] = useState<MapCamera | null>(() =>
    parseCamera(searchParams),
  );

  /** The last camera this hook wrote, so its own writes are recognisable. */
  const lastWritten = useRef<MapCamera | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL is authoritative for anything that did not come from the pointer: a
  // nav link, the back button, a pasted link. App Router keeps this component
  // mounted across a query string change, so reading once on mount would
  // swallow all three.
  useEffect(() => {
    const fromUrl = parseCamera(searchParams);
    if (!fromUrl) return;
    if (
      lastWritten.current &&
      cameraQuery(scope, fromUrl) === cameraQuery(scope, lastWritten.current)
    ) {
      return;
    }
    setCamera(fromUrl);
  }, [searchParams, scope]);

  const onCameraChange = useCallback(
    (next: MapCamera) => {
      setCamera(next);

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        lastWritten.current = next;
        router.replace(`?${cameraQuery(scope, next)}`, { scroll: false });
      }, URL_DEBOUNCE_MS);
    },
    [router, scope],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // The autofit is not known until the geometry lands, so until the pointer has
  // moved the camera simply *is* the fit — resolved here at render time rather
  // than copied into state by an effect. Writing it to state would cost an extra
  // render pass and trips react-hooks/set-state-in-effect; it would also pin the
  // very first fit, so a window resized before anyone touched the map would keep
  // the stale frame. Once `camera` is set, `fit` is ignored, which is what keeps
  // a later resize from throwing away where the user has moved to.
  return { camera: camera ?? fit, onCameraChange };
}
