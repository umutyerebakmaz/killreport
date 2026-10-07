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

  it('reads the layer and the owner out of the URL it was mounted with', () => {
    searchParams = new URLSearchParams('layer=sovereignty&owner=99003581');
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
    expect(result.current.layer).toBe('sovereignty');
    expect(result.current.owner).toBe(99003581);
  });

  // An owner in the URL of a security-layer map isolates nothing.
  it('reports no owner on the security layer, whatever the URL says', () => {
    searchParams = new URLSearchParams('owner=99003581');
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));
    expect(result.current.layer).toBe('security');
    expect(result.current.owner).toBeNull();
  });

  it('writes a layer change at once, like a selection', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onLayerChange('sovereignty'));

    expect(replace).toHaveBeenCalledWith(
      '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00&layer=sovereignty',
      { scroll: false },
    );
    expect(result.current.layer).toBe('sovereignty');
  });

  it('clears the owner on the way back to security', () => {
    searchParams = new URLSearchParams('layer=sovereignty&owner=99003581');
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onLayerChange('security'));
    act(() => result.current.onLayerChange('sovereignty'));

    expect(result.current.owner).toBeNull();
    expect(replace).toHaveBeenLastCalledWith(
      '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00&layer=sovereignty',
      { scroll: false },
    );
  });

  it('writes an isolated owner at once', () => {
    searchParams = new URLSearchParams('layer=sovereignty');
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onOwnerChange(99003581));

    expect(replace).toHaveBeenLastCalledWith(
      '?scope=NEW_EDEN&x=0&z=0&zoom=-50.00&layer=sovereignty&owner=99003581',
      { scroll: false },
    );
  });

  // The hazard focus already had, now for two more parameters: cameraQuery
  // rebuilds the URL from nothing, so a pan that did not carry the layer would
  // drop the reader back onto the security map.
  it('carries the layer and the owner into a pan', () => {
    vi.useFakeTimers();
    searchParams = new URLSearchParams('layer=sovereignty&owner=99003581');
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onCameraChange({ x: 1e9, z: 0, zoom: -45 }));
    act(() => {
      vi.advanceTimersByTime(URL_DEBOUNCE_MS);
    });

    expect(replace).toHaveBeenLastCalledWith(
      '?scope=NEW_EDEN&x=1000000000&z=0&zoom=-45.00&layer=sovereignty&owner=99003581',
      { scroll: false },
    );
  });

  // A panel row moves the camera AND opens the popup. As two calls, the
  // debounced camera write would land 250 ms later carrying the focus it
  // closed over — the old one — and close the popup it had just opened.
  it('jumps the camera and the selection in one immediate write', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.jumpTo({ x: 2e9, z: 0, zoom: -45.73 }, 30004759));
    act(() => {
      vi.advanceTimersByTime(URL_DEBOUNCE_MS);
    });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      '?scope=NEW_EDEN&x=2000000000&z=0&zoom=-45.73&focus=30004759',
      { scroll: false },
    );
    expect(result.current.focus).toBe(30004759);
    expect(result.current.camera).toEqual({ x: 2e9, z: 0, zoom: -45.73 });
  });

  it('keeps the selection when a jump names none', () => {
    const { result } = renderHook(() => useMapCamera(MapScope.NewEden, FIT));

    act(() => result.current.onFocusChange(30000142));
    act(() => result.current.jumpTo({ x: 2e9, z: 0, zoom: -45 }));

    expect(result.current.focus).toBe(30000142);
  });

  it('takes a layer that changes in the URL underneath it', () => {
    const { result, rerender } = renderHook(() =>
      useMapCamera(MapScope.NewEden, FIT),
    );

    searchParams = new URLSearchParams(
      'scope=NEW_EDEN&x=0&z=0&zoom=-50.00&layer=sovereignty',
    );
    rerender();

    expect(result.current.layer).toBe('sovereignty');
  });

  // The router commits a replace some time after it is asked to. A pan that
  // pauses twice puts two writes in flight, and the first one landing after
  // the second has gone out is still this hook's own — taking it for a
  // foreign change snapped the camera back to where it had been a moment ago.
  it('keeps the camera when an older write of its own lands late', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() =>
      useMapCamera(MapScope.NewEden, FIT),
    );

    act(() => result.current.onCameraChange({ x: 1e9, z: 1e9, zoom: -45 }));
    act(() => {
      vi.advanceTimersByTime(URL_DEBOUNCE_MS);
    });
    const first = replace.mock.calls.at(-1)?.[0] as string;

    act(() => result.current.onCameraChange({ x: 2e9, z: 0, zoom: -44 }));
    act(() => {
      vi.advanceTimersByTime(URL_DEBOUNCE_MS);
    });
    const second = replace.mock.calls.at(-1)?.[0] as string;

    searchParams = new URLSearchParams(first.slice(1));
    rerender();
    expect(result.current.camera).toEqual({ x: 2e9, z: 0, zoom: -44 });

    searchParams = new URLSearchParams(second.slice(1));
    rerender();
    expect(result.current.camera).toEqual({ x: 2e9, z: 0, zoom: -44 });
  });

  // What the pending list must not swallow: once its own writes have landed,
  // a URL it did not write — the back button — still moves the camera.
  it('still follows the back button after its own writes have landed', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() =>
      useMapCamera(MapScope.NewEden, FIT),
    );

    act(() => result.current.onCameraChange({ x: 1e9, z: 1e9, zoom: -45 }));
    act(() => {
      vi.advanceTimersByTime(URL_DEBOUNCE_MS);
    });
    const first = replace.mock.calls.at(-1)?.[0] as string;
    searchParams = new URLSearchParams(first.slice(1));
    rerender();

    searchParams = new URLSearchParams('scope=NEW_EDEN&x=0&z=0&zoom=-50.00');
    rerender();
    expect(result.current.camera).toEqual({ x: 0, z: 0, zoom: -50 });
  });
});
