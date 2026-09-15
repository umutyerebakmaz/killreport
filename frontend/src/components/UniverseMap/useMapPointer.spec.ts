import type { MapArea } from '@/utils/map/edges';
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
  let host: HTMLDivElement;
  let onCameraChange: ReturnType<typeof vi.fn<(next: MapCamera) => void>>;

  beforeEach(() => {
    // A div, not a canvas: the listeners are bound to the HOST. The canvas
    // fills it, so the rectangle a hit test works in is the same either way.
    host = document.createElement('div');
    host.getBoundingClientRect = vi.fn(
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
        useMapPointer(host, camera, LIMITS, onCameraChange),
      { initialProps: { camera: initial } },
    );

    act(() => {
      host.dispatchEvent(pointerEvent('pointerdown', 100, 100));
    });

    act(() => {
      host.dispatchEvent(pointerEvent('pointermove', 110, 100));
    });
    expect(onCameraChange).toHaveBeenCalledTimes(1);
    // The real component's camera state updates and re-renders in response to
    // the first move, exactly as it does in production — a hook that only
    // works when its props never change during a drag is the bug.
    rerender({ camera: onCameraChange.mock.calls[0][0] });

    act(() => {
      host.dispatchEvent(pointerEvent('pointermove', 120, 100));
    });
    expect(onCameraChange).toHaveBeenCalledTimes(2);
    rerender({ camera: onCameraChange.mock.calls[1][0] });

    act(() => {
      host.dispatchEvent(pointerEvent('pointermove', 130, 100));
    });
    expect(onCameraChange).toHaveBeenCalledTimes(3);

    expect(onCameraChange.mock.calls.map((call) => call[0].x)).toEqual([
      -10, -20, -30,
    ]);
  });

  it('does nothing on a move with no prior pointerdown', () => {
    renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(host, camera, LIMITS, onCameraChange),
      { initialProps: { camera: { x: 0, z: 0, zoom: 0 } } },
    );

    act(() => {
      host.dispatchEvent(pointerEvent('pointermove', 110, 100));
    });

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it('ends the drag on pointerup', () => {
    renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(host, camera, LIMITS, onCameraChange),
      { initialProps: { camera: { x: 0, z: 0, zoom: 0 } } },
    );

    act(() => {
      host.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      host.dispatchEvent(pointerEvent('pointerup', 100, 100));
      host.dispatchEvent(pointerEvent('pointermove', 110, 100));
    });

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it('ends the drag on pointerleave', () => {
    renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(host, camera, LIMITS, onCameraChange),
      { initialProps: { camera: { x: 0, z: 0, zoom: 0 } } },
    );

    act(() => {
      host.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      host.dispatchEvent(pointerEvent('pointerleave', 100, 100));
      host.dispatchEvent(pointerEvent('pointermove', 110, 100));
    });

    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it('zooms about the pointer on wheel and respects the zoom ceiling', () => {
    const initial: MapCamera = { x: 0, z: 0, zoom: 9.5 };
    renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(host, camera, LIMITS, onCameraChange),
      { initialProps: { camera: initial } },
    );

    act(() => {
      host.dispatchEvent(wheelEvent(-3000, 300, 200));
    });

    expect(onCameraChange).toHaveBeenCalledTimes(1);
    const expected = zoomCameraAt(initial, 10, 300, 200, 800, 600, LIMITS);
    expect(onCameraChange).toHaveBeenCalledWith(expected);
    expect(onCameraChange.mock.calls[0][0].zoom).toBe(LIMITS.maxZoom);
  });

  it('binds every listener to the host, never to the canvas', () => {
    // The label overlay sits ABOVE the canvas and its system names take
    // pointer events, so a press or a wheel that lands on a name never
    // reaches the canvas at all. Bound to the host, every one of those events
    // is back in reach, because they bubble out of the label to it.
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const hostSpy = vi.spyOn(host, 'addEventListener');
    const canvasSpy = vi.spyOn(canvas, 'addEventListener');

    renderHook(() =>
      useMapPointer(host, { x: 0, z: 0, zoom: 0 }, LIMITS, onCameraChange),
    );

    expect(hostSpy.mock.calls.map((call) => call[0])).toEqual([
      'pointerdown',
      'pointerup',
      'pointerleave',
      'pointermove',
      'wheel',
    ]);
    expect(canvasSpy).not.toHaveBeenCalled();
  });

  it('removes every listener on unmount', () => {
    const removeSpy = vi.spyOn(host, 'removeEventListener');
    const { unmount } = renderHook(
      ({ camera }: { camera: MapCamera }) =>
        useMapPointer(host, camera, LIMITS, onCameraChange),
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
    let onHoverSystem: ReturnType<typeof vi.fn<MapPick['onHoverSystem']>>;
    let onSelect: ReturnType<typeof vi.fn<MapPick['onSelect']>>;
    let onSelectSystem: ReturnType<typeof vi.fn<MapPick['onSelectSystem']>>;
    let onHoverArea: ReturnType<typeof vi.fn<MapPick['onHoverArea']>>;
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      onHover = vi.fn<(at: PointerPosition | null) => void>();
      onHoverSystem = vi.fn<(systemId: number) => void>();
      onSelect = vi.fn<(at: PointerPosition) => void>();
      onSelectSystem = vi.fn<(systemId: number) => void>();
      onHoverArea = vi.fn<(area: MapArea | null) => void>();
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
        useMapPointer(host, { x: 0, z: 0, zoom: 0 }, LIMITS, onCameraChange, {
          onHover,
          onHoverSystem,
          onSelect,
          onSelectSystem,
          onHoverArea,
        }),
      );
    }

    it('reports the pointer once per frame, not once per move', () => {
      mount();

      act(() => {
        host.dispatchEvent(pointerEvent('pointermove', 10, 20));
        host.dispatchEvent(pointerEvent('pointermove', 11, 21));
        host.dispatchEvent(pointerEvent('pointermove', 12, 22));
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
        host.dispatchEvent(pointerEvent('pointerdown', 100, 100));
      });
      expect(onHover).toHaveBeenCalledWith(null);

      onHover.mockClear();
      act(() => {
        host.dispatchEvent(pointerEvent('pointermove', 140, 100));
        flushFrame();
      });
      // A drag pans; it does not light up every system it passes over.
      expect(onHover).not.toHaveBeenCalledWith({ x: 140, y: 100 });
    });

    it('clears the hover when the pointer leaves the map', () => {
      mount();
      act(() => {
        host.dispatchEvent(pointerEvent('pointerleave', 0, 0));
      });
      expect(onHover).toHaveBeenCalledWith(null);
    });

    it('selects when the pointer goes up within the tolerance', () => {
      mount();

      act(() => {
        host.dispatchEvent(pointerEvent('pointerdown', 200, 150));
        host.dispatchEvent(pointerEvent('pointermove', 202, 151));
        host.dispatchEvent(pointerEvent('pointerup', 202, 151));
      });

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith({ x: 202, y: 151 });
    });

    it('does not select after a drag', () => {
      // Without the tolerance every pan would open a popup.
      mount();

      act(() => {
        host.dispatchEvent(pointerEvent('pointerdown', 200, 150));
        host.dispatchEvent(pointerEvent('pointermove', 260, 150));
        host.dispatchEvent(pointerEvent('pointerup', 260, 150));
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('measures the tolerance from the pointerdown, not from the last move', () => {
      // Ten moves of 1 px are a 10 px drag, not ten clicks.
      mount();

      act(() => {
        host.dispatchEvent(pointerEvent('pointerdown', 200, 150));
        for (let i = 1; i <= 10; i++) {
          host.dispatchEvent(pointerEvent('pointermove', 200 + i, 150));
        }
        host.dispatchEvent(pointerEvent('pointerup', 210, 150));
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('still works when no pick handlers are given', () => {
      // The four-argument call is what the existing tests and any caller that
      // does not care about picking use.
      renderHook(() =>
        useMapPointer(host, { x: 0, z: 0, zoom: 0 }, LIMITS, onCameraChange),
      );

      act(() => {
        host.dispatchEvent(pointerEvent('pointerdown', 10, 10));
        host.dispatchEvent(pointerEvent('pointerup', 10, 10));
        flushFrame();
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    describe('label targets', () => {
      /**
       * A system name as `labelLayer` stamps it. A child of the host, because
       * the overlay is: that is what puts its events in reach of the
       * listeners.
       */
      function label(systemId?: number) {
        const el = document.createElement('span');
        if (systemId !== undefined) el.dataset.mapSystem = String(systemId);
        host.appendChild(el);
        return el;
      }

      /** An area name as `labelLayer` stamps it: the system tier's twin. */
      function regionLabel(regionId: number) {
        const el = document.createElement('span');
        el.dataset.mapRegion = String(regionId);
        host.appendChild(el);
        return el;
      }

      function constellationLabel(constellationId: number) {
        const el = document.createElement('span');
        el.dataset.mapConstellation = String(constellationId);
        host.appendChild(el);
        return el;
      }

      it('reports a hover over a constellation name at its own tier', () => {
        const name = constellationLabel(20000020);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });

        expect(onHoverArea).toHaveBeenCalledWith({
          tier: 'constellation',
          id: 20000020,
        });
      });

      it('swaps tiers when the pointer crosses from one name to the other', () => {
        const region = regionLabel(10000002);
        const constellation = constellationLabel(20000020);
        mount();

        act(() => {
          region.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });
        act(() => {
          constellation.dispatchEvent(pointerEvent('pointermove', 30, 10));
          flushFrame();
        });

        expect(onHoverArea).toHaveBeenLastCalledWith({
          tier: 'constellation',
          id: 20000020,
        });
      });

      it('hands back the same object while the pointer rests on one name', () => {
        // The caller holds this in state and rebuilds a mesh from it. A fresh
        // object per move would redraw that area dozens of times a second for
        // an answer that never changed.
        const name = constellationLabel(20000020);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });
        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 11, 11));
          flushFrame();
        });

        const [first, second] = onHoverArea.mock.calls;
        expect(second[0]).toBe(first[0]);
      });

      it('reports a hover over a region name by id', () => {
        const name = regionLabel(10000002);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });

        expect(onHoverArea).toHaveBeenCalledWith({
          tier: 'region',
          id: 10000002,
        });
        expect(onHoverSystem).not.toHaveBeenCalled();
      });

      it('clears the system hover while the pointer rests on a region name', () => {
        // A name is drawn OVER the map, not part of it. Without this the tip
        // for whatever the pointer last crossed stays up behind the name.
        const name = regionLabel(10000002);
        mount();

        act(() => {
          host.dispatchEvent(pointerEvent('pointermove', 12, 22));
          flushFrame();
        });
        onHover.mockClear();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });

        expect(onHover).toHaveBeenCalledWith(null);
      });

      it('drops the highlight when the pointer leaves the name', () => {
        const name = regionLabel(10000002);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });
        onHoverArea.mockClear();

        act(() => {
          host.dispatchEvent(pointerEvent('pointermove', 12, 22));
          flushFrame();
        });

        expect(onHoverArea).toHaveBeenCalledWith(null);
      });

      it('drops the highlight when the pointer leaves the map', () => {
        const name = regionLabel(10000002);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });
        onHoverArea.mockClear();

        act(() => {
          host.dispatchEvent(new PointerEvent('pointerleave'));
        });

        expect(onHoverArea).toHaveBeenCalledWith(null);
      });

      it('reports one hover per frame across a region name and the canvas', () => {
        // The third path shares the single frame the other two do, so crossing
        // from a name onto empty space still reports once, for where the
        // pointer ENDED.
        const name = regionLabel(10000002);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          host.dispatchEvent(pointerEvent('pointermove', 12, 22));
          flushFrame();
        });

        expect(onHoverArea).toHaveBeenCalledTimes(1);
        expect(onHoverArea).toHaveBeenCalledWith(null);
        expect(onHover).toHaveBeenCalledWith({ x: 12, y: 22 });
      });

      it('leaves a click on a region name to the hit test', () => {
        // The highlight is a hover, not a selection: a region name carries no
        // `data-map-system`, so a press on one still picks whatever is under
        // the pointer.
        const name = regionLabel(10000002);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointerdown', 10, 10));
          name.dispatchEvent(pointerEvent('pointerup', 10, 10));
        });

        expect(onSelectSystem).not.toHaveBeenCalled();
        expect(onSelect).toHaveBeenCalledWith({ x: 10, y: 10 });
      });

      it('selects by id when the pointer goes up on a name', () => {
        const name = label(30000142);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointerdown', 10, 10));
          name.dispatchEvent(pointerEvent('pointerup', 10, 10));
        });

        expect(onSelectSystem).toHaveBeenCalledWith(30000142);
        // Not both: the shortcut answers WHAT was hit, so the hit test that
        // would have answered the same question never runs.
        expect(onSelect).not.toHaveBeenCalled();
      });

      it('pans on a drag that starts on a name', () => {
        const name = label(30000142);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointerdown', 10, 10));
          name.dispatchEvent(pointerEvent('pointermove', 60, 10));
        });

        expect(onCameraChange).toHaveBeenCalled();
      });

      it('zooms on a wheel over a name', () => {
        const name = label(30000142);
        mount();

        act(() => {
          name.dispatchEvent(wheelEvent(-300, 300, 200));
        });

        expect(onCameraChange).toHaveBeenCalledTimes(1);
      });

      it('reports a hover over a name by id, not by coordinate', () => {
        const name = label(30000142);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });

        expect(onHoverSystem).toHaveBeenCalledWith(30000142);
        expect(onHover).not.toHaveBeenCalled();
      });

      it('reports one hover per frame across a label and the canvas', () => {
        // The two paths share the single frame the coordinate hover always
        // had, so crossing from a name onto empty space cannot report twice
        // for one frame — and what is reported is where the pointer ENDED.
        const name = label(30000142);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointermove', 10, 10));
          host.dispatchEvent(pointerEvent('pointermove', 12, 22));
          flushFrame();
        });

        expect(onHoverSystem).not.toHaveBeenCalled();
        expect(onHover).toHaveBeenCalledTimes(1);
        expect(onHover).toHaveBeenCalledWith({ x: 12, y: 22 });
      });

      it('falls through to the hit test for a name that carries no id', () => {
        // A region or constellation name: the layer stamps `data-map-system`
        // on the system tier alone, and nothing else is selectable.
        const name = label();
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointerdown', 10, 10));
          name.dispatchEvent(pointerEvent('pointerup', 10, 10));
        });

        expect(onSelectSystem).not.toHaveBeenCalled();
        expect(onSelect).toHaveBeenCalledWith({ x: 10, y: 10 });
      });

      it('holds the shortcut to the same drag tolerance as the hit test', () => {
        // One tolerance rule, not two: a drag that ends on a name is a pan,
        // exactly as a drag that ends on empty space is.
        const name = label(30000142);
        mount();

        act(() => {
          name.dispatchEvent(pointerEvent('pointerdown', 200, 150));
          name.dispatchEvent(pointerEvent('pointermove', 260, 150));
          name.dispatchEvent(pointerEvent('pointerup', 260, 150));
        });

        expect(onSelectSystem).not.toHaveBeenCalled();
        expect(onSelect).not.toHaveBeenCalled();
      });
    });

    describe('overlay panels', () => {
      /** SystemPopup: a child of the host, and not part of the map. */
      function panel() {
        const el = document.createElement('div');
        el.dataset.mapOverlay = '';
        const inside = document.createElement('span');
        el.appendChild(inside);
        host.appendChild(el);
        return inside;
      }

      it('does not pan on a drag that starts on a panel', () => {
        const inside = panel();
        mount();

        act(() => {
          inside.dispatchEvent(pointerEvent('pointerdown', 10, 10));
          inside.dispatchEvent(pointerEvent('pointermove', 60, 10));
        });

        expect(onCameraChange).not.toHaveBeenCalled();
      });

      it('does not read a click on a panel as a click on the map', () => {
        // Which would hit-test the panel's own pixels, find nothing there and
        // close the very panel that was clicked.
        const inside = panel();
        mount();

        act(() => {
          inside.dispatchEvent(pointerEvent('pointerdown', 10, 10));
          inside.dispatchEvent(pointerEvent('pointerup', 10, 10));
        });

        expect(onSelect).not.toHaveBeenCalled();
        expect(onSelectSystem).not.toHaveBeenCalled();
      });

      it('does not zoom on a wheel over a panel', () => {
        const inside = panel();
        mount();

        act(() => {
          inside.dispatchEvent(wheelEvent(-300, 300, 200));
        });

        expect(onCameraChange).not.toHaveBeenCalled();
      });

      it('does not hit-test a hover that rests on a panel', () => {
        // The panel covers the map, so hit-testing its own pixels lights up
        // whatever dot happens to sit underneath, renders a hover tip behind
        // the panel and gives the host a pointer cursor over it.
        const inside = panel();
        mount();

        act(() => {
          inside.dispatchEvent(pointerEvent('pointermove', 10, 10));
          flushFrame();
        });

        expect(onHover).not.toHaveBeenCalledWith({ x: 10, y: 10 });
        expect(onHoverSystem).not.toHaveBeenCalled();
      });

      it('clears a hover already up when the pointer crosses onto a panel', () => {
        // A bare return would leave the last tip on screen and the host's
        // pointer cursor with it. The canvas used to fire pointerleave here.
        const inside = panel();
        mount();

        act(() => {
          host.dispatchEvent(pointerEvent('pointermove', 10, 20));
          flushFrame();
        });
        expect(onHover).toHaveBeenCalledWith({ x: 10, y: 20 });

        onHover.mockClear();
        act(() => {
          inside.dispatchEvent(pointerEvent('pointermove', 12, 22));
          flushFrame();
        });

        expect(onHover).toHaveBeenCalledWith(null);
      });

      it('clears a hover already up when a panel is pressed', () => {
        const inside = panel();
        mount();

        act(() => {
          host.dispatchEvent(pointerEvent('pointermove', 10, 20));
          flushFrame();
        });
        onHover.mockClear();

        act(() => {
          inside.dispatchEvent(pointerEvent('pointerdown', 12, 22));
        });

        expect(onHover).toHaveBeenCalledWith(null);
      });

      it('keeps panning a drag that crosses a panel', () => {
        // The guard is on the press, not on the move: a pan started on the
        // map must not stall — or jump — when the pointer passes over a
        // panel.
        const inside = panel();
        mount();

        act(() => {
          host.dispatchEvent(pointerEvent('pointerdown', 10, 10));
          inside.dispatchEvent(pointerEvent('pointermove', 60, 10));
        });

        expect(onCameraChange).toHaveBeenCalledTimes(1);
      });
    });
  });
});
