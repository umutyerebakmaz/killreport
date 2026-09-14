import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
let searchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

import { MapScope } from '@/generated/graphql';
import { useMapCamera } from './useMapCamera';

/** Stands in for the autofit the component computes from the geometry. */
const FIT = { x: 0, z: 0, zoom: -50 };
const URL_DEBOUNCE_MS = 250;

beforeEach(() => {
  searchParams = new URLSearchParams('');
  replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMapCamera', () => {
  it('is the fallback until the camera moves', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
    expect(result.current.camera).toEqual(FIT);
    expect(result.current.focus).toBeNull();
  });

  it('reads a focus out of the URL it was mounted with', () => {
    searchParams = new URLSearchParams('focus=30000142');
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
    expect(result.current.focus).toBe(30000142);
  });

  // A click is one event: waiting out the pan debounce would lose the selection
  // to a back button pressed in between.
  it('writes a selection at once, without the pan debounce', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onFocusChange(30000142));

    expect(replace).toHaveBeenCalledWith(
      '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00&focus=30000142',
      { scroll: false },
    );
    expect(result.current.focus).toBe(30000142);
  });

  // Clicking empty space clears it, and nothing but the absent parameter says so.
  it('removes the parameter when the selection is cleared', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onFocusChange(30000142));
    act(() => result.current.onFocusChange(null));

    expect(replace).toHaveBeenLastCalledWith(
      '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00',
      { scroll: false },
    );
    expect(result.current.focus).toBeNull();
  });

  // The hazard the whole slice is built around: cameraQuery writes a fresh
  // URLSearchParams, so a camera write that did not carry the focus would drop
  // the popup out of the URL on the first drag.
  it('carries the selection into a camera write instead of erasing it', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onFocusChange(30000142));
    act(() => result.current.onCameraChange({ x: 1e9, z: 2e9, zoom: -45 }));
    act(() => {
      vi.advanceTimersByTime(URL_DEBOUNCE_MS);
    });

    expect(replace).toHaveBeenLastCalledWith(
      '?scope=NEW_EDEN&x=1000000000&z=2000000000&zoom=-45.00&focus=30000142',
      { scroll: false },
    );
  });

  it('debounces a camera write, and writes once for a burst of them', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onCameraChange({ x: 1e9, z: 0, zoom: -50 }));
    act(() => result.current.onCameraChange({ x: 2e9, z: 0, zoom: -50 }));
    act(() => result.current.onCameraChange({ x: 3e9, z: 0, zoom: -50 }));
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(URL_DEBOUNCE_MS);
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      '?scope=NEW_EDEN&x=3000000000&z=0&zoom=-50.00',
      { scroll: false },
    );
  });

  // Its own echo is not an external change; the back button is. The comparison
  // is the output of one pure function against itself, which is why focus came
  // along for free.
  it('keeps its own write, and accepts one it did not make', () => {
    const { result, rerender } = renderHook(() =>
      useMapCamera(MapScope.NewEden, FIT),
    );

    act(() => result.current.onFocusChange(30000142));

    searchParams = new URLSearchParams(
      'scope=NEW_EDEN&x=0&z=0&zoom=-50.00&focus=30000142',
    );
    rerender();
    expect(result.current.focus).toBe(30000142);

    // The back button: the same camera, no focus. Not this hook's own write.
    searchParams = new URLSearchParams('scope=NEW_EDEN&x=0&z=0&zoom=-50.00');
    rerender();
    expect(result.current.focus).toBeNull();
  });

  it('takes a camera that changes in the URL underneath it', () => {
    const { result, rerender } = renderHook(() =>
      useMapCamera(MapScope.NewEden, FIT),
    );

    searchParams = new URLSearchParams('scope=NEW_EDEN&x=5e9&z=0&zoom=-44');
    rerender();

    expect(result.current.camera).toEqual({ x: 5e9, z: 0, zoom: -44 });
  });

  // Nothing has been written yet, so there is no camera in state — but the
  // frame on screen is the fallback, and that is what the selection has to be
  // written against.
  it('writes a selection made before the camera has ever moved', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
    act(() => result.current.onFocusChange(30000142));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('writes nothing at all when there is no frame yet', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, null));
    act(() => result.current.onFocusChange(30000142));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.focus).toBe(30000142);
  });
});
