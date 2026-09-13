import { act, renderHook } from '@testing-library/react';
import { zoomCameraAt, type MapCamera } from '@/utils/map/camera';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMapPointer, type ZoomLimits } from './useMapPointer';

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
});
