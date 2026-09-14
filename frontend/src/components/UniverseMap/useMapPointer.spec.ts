import { act, renderHook } from '@testing-library/react';
import { zoomCameraAt, type MapCamera } from '@/utils/map/camera';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useMapPointer,
  type MapPick,
  type PointerPosition,
  type ZoomLimits,
} from './useMapPointer';

const LIMITS: ZoomLimits = { minZoom: -10, maxZoom: 10 };

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { clientX: x, clientY: y, bubbles: true });
}

function wheelEvent(deltaY: number, x: number, y: number): WheelEvent {
  return new WheelEvent('wheel', {
    deltaY,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
}

describe('useMapPointer', () => {
  let canvas: HTMLCanvasElement;
  let onCameraChange: ReturnType<typeof vi.fn<(next: MapCamera) => void>>;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
          right: 800,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    onCameraChange = vi.fn<(next: MapCamera) => void>();
  });

  it('pans on all three moves of a continuous drag — regression for the freeze-after-one-tick bug', () => {
    const initial: MapCamera = { x: 0, z: 0, zoom: 0 };
    const { rerender } = renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(canvas, camera, LIMITS, onCameraChange),
      { initialProps: { camera: initial } },
    );

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
    });

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointermove', 110, 100));
    });
    expect(onCameraChange).toHaveBeenCalledTimes(1);
    // The real component's camera state updates and re-renders in response to
    // the first move, exactly as it does in production — a hook that only
    // works when its props never change during a drag is the bug.
    rerender({ camera: onCameraChange.mock.calls[0][0] });

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointermove', 120, 100));
    });
    expect(onCameraChange).toHaveBeenCalledTimes(2);
    rerender({ camera: onCameraChange.mock.calls[1][0] });

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointermove', 130, 100));
    });
    expect(onCameraChange).toHaveBeenCalledTimes(3);

    expect(onCameraChange.mock.calls.map((call) => call[0].x)).toEqual([
      -10, -20, -30,
    ]);
  });

  it('does nothing on a move with no prior pointerdown', () => {
    renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(canvas, camera, LIMITS, onCameraChange),
      { initialProps: { camera: { x: 0, z: 0, zoom: 0 } } },
    );

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointermove', 110, 100));
    });

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it('ends the drag on pointerup', () => {
    renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(canvas, camera, LIMITS, onCameraChange),
      { initialProps: { camera: { x: 0, z: 0, zoom: 0 } } },
    );

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointerup', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointermove', 110, 100));
    });

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it('ends the drag on pointerleave', () => {
    renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(canvas, camera, LIMITS, onCameraChange),
      { initialProps: { camera: { x: 0, z: 0, zoom: 0 } } },
    );

    act(() => {
      canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointerleave', 100, 100));
      canvas.dispatchEvent(pointerEvent('pointermove', 110, 100));
    });

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it('zooms about the pointer on wheel and respects the zoom ceiling', () => {
    const initial: MapCamera = { x: 0, z: 0, zoom: 9.5 };
    renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(canvas, camera, LIMITS, onCameraChange),
      { initialProps: { camera: initial } },
    );

    act(() => {
      canvas.dispatchEvent(wheelEvent(-3000, 300, 200));
    });

    expect(onCameraChange).toHaveBeenCalledTimes(1);
    const expected = zoomCameraAt(initial, 10, 300, 200, 800, 600, LIMITS);
    expect(onCameraChange).toHaveBeenCalledWith(expected);
    expect(onCameraChange.mock.calls[0][0].zoom).toBe(LIMITS.maxZoom);
  });

  it('removes every listener on unmount', () => {
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    const { unmount } = renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(canvas, camera, LIMITS, onCameraChange),
      { initialProps: { camera: { x: 0, z: 0, zoom: 0 } } },
    );

    unmount();

    const types = removeSpy.mock.calls.map((call) => call[0]);
    expect(types).toEqual(
      expect.arrayContaining([
        'pointerdown',
        'pointerup',
        'pointerleave',
        'pointermove',
        'wheel',
      ]),
    );
  });
  describe('hover and click', () => {
    let onHover: ReturnType<typeof vi.fn<MapPick['onHover']>>;
    let onSelect: ReturnType<typeof vi.fn<MapPick['onSelect']>>;
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      onHover = vi.fn<(at: PointerPosition | null) => void>();
      onSelect = vi.fn<(at: PointerPosition) => void>();
      frames = [];
      // Deterministic rAF: the hook coalesces moves into one frame, and a real
      // rAF would make "how many times was onHover called" depend on timing.
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });

    // vitest.config.mts does not set unstubGlobals, so the default leaves
    // stubs in place across files. Undone by hand.
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function flushFrame() {
      const pending = frames;
      frames = [];
      for (const cb of pending) cb(0);
    }

    function mount() {
      return renderHook(() =>
        useMapPointer(canvas, { x: 0, z: 0, zoom: 0 }, LIMITS, onCameraChange, {
          onHover,
          onSelect,
        }),
      );
    }

    it('reports the pointer once per frame, not once per move', () => {
      mount();

      act(() => {
        canvas.dispatchEvent(pointerEvent('pointermove', 10, 20));
        canvas.dispatchEvent(pointerEvent('pointermove', 11, 21));
        canvas.dispatchEvent(pointerEvent('pointermove', 12, 22));
      });
      expect(onHover).not.toHaveBeenCalled();

      act(() => flushFrame());
      expect(onHover).toHaveBeenCalledTimes(1);
      // The LAST position, not the first: the frame reports where the pointer
      // ended up.
      expect(onHover).toHaveBeenCalledWith({ x: 12, y: 22 });
    });

    it('clears the hover while dragging', () => {
      mount();

      act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      });
      expect(onHover).toHaveBeenCalledWith(null);

      onHover.mockClear();
      act(() => {
        canvas.dispatchEvent(pointerEvent('pointermove', 140, 100));
        flushFrame();
      });
      // A drag pans; it does not light up every system it passes over.
      expect(onHover).not.toHaveBeenCalledWith({ x: 140, y: 100 });
    });

    it('clears the hover when the pointer leaves the canvas', () => {
      mount();
      act(() => {
        canvas.dispatchEvent(pointerEvent('pointerleave', 0, 0));
      });
      expect(onHover).toHaveBeenCalledWith(null);
    });

    it('selects when the pointer goes up within the tolerance', () => {
      mount();

      act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', 200, 150));
        canvas.dispatchEvent(pointerEvent('pointermove', 202, 151));
        canvas.dispatchEvent(pointerEvent('pointerup', 202, 151));
      });

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith({ x: 202, y: 151 });
    });

    it('does not select after a drag', () => {
      // Without the tolerance every pan would open a popup.
      mount();

      act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', 200, 150));
        canvas.dispatchEvent(pointerEvent('pointermove', 260, 150));
        canvas.dispatchEvent(pointerEvent('pointerup', 260, 150));
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('measures the tolerance from the pointerdown, not from the last move', () => {
      // Ten moves of 1 px are a 10 px drag, not ten clicks.
      mount();

      act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', 200, 150));
        for (let i = 1; i <= 10; i++) {
          canvas.dispatchEvent(pointerEvent('pointermove', 200 + i, 150));
        }
        canvas.dispatchEvent(pointerEvent('pointerup', 210, 150));
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('still works when no pick handlers are given', () => {
      // The four-argument call is what the existing tests and any caller that
      // does not care about picking use.
      renderHook(() =>
        useMapPointer(canvas, { x: 0, z: 0, zoom: 0 }, LIMITS, onCameraChange),
      );

      act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', 10, 10));
        canvas.dispatchEvent(pointerEvent('pointerup', 10, 10));
        flushFrame();
      });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
