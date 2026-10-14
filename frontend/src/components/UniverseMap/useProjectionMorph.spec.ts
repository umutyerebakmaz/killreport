import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./scene/systems', () => ({ scaleSystems: vi.fn() }));
const reduced = vi.fn(() => false);
vi.mock('./useReducedMotion', () => ({ useReducedMotion: () => reduced() }));

import { useProjectionMorph, type MorphRun } from './useProjectionMorph';

function fakeRun(overrides: Partial<MorphRun> = {}) {
  const ticks: (() => void)[] = [];
  const ticker = {
    add: vi.fn((fn: () => void) => ticks.push(fn)),
    remove: vi.fn((fn: () => void) => ticks.splice(ticks.indexOf(fn), 1)),
  };
  const sprite = () => ({ position: { set: vi.fn() }, alpha: 1 });
  const sprites = {
    sprites: [sprite(), sprite()],
    radii: [],
    logos: [],
    discs: [],
  };
  const run = {
    scene: {
      app: { ticker },
      world: { scale: { set: vi.fn() }, position: { set: vi.fn() } },
    },
    sprites,
    from: [
      { x: 0, z: 0 },
      { x: 10, z: 10 },
    ],
    to: [{ x: 100, z: 200 }, null],
    fromCamera: { x: 0, z: 0, zoom: -50 },
    toCamera: { x: 50, z: 50, zoom: -49 },
    width: 800,
    height: 600,
    onDone: vi.fn(),
    ...overrides,
  } as unknown as MorphRun;
  return { run, ticks, ticker, sprites };
}

let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  reduced.mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

describe('useProjectionMorph', () => {
  it('moves each dot to its new place and ends exactly there', () => {
    const { result } = renderHook(() => useProjectionMorph());
    const { run, ticks, sprites } = fakeRun();
    result.current.run(run);

    now = 600;
    ticks[0]();

    expect(sprites.sprites[0].position.set).toHaveBeenLastCalledWith(100, 200);
    expect(run.onDone).toHaveBeenCalledTimes(1);
    expect(ticks).toHaveLength(0);
  });

  it('fades a dot with nowhere to go', () => {
    const { result } = renderHook(() => useProjectionMorph());
    const { run, ticks, sprites } = fakeRun();
    result.current.run(run);

    now = 600;
    ticks[0]();
    expect(sprites.sprites[1].alpha).toBe(0);
  });

  it('is half way at half time', () => {
    const { result } = renderHook(() => useProjectionMorph());
    const { run, ticks, sprites } = fakeRun();
    result.current.run(run);

    now = 300;
    ticks[0]();
    expect(sprites.sprites[0].position.set).toHaveBeenLastCalledWith(50, 100);
    expect(run.onDone).not.toHaveBeenCalled();
  });

  it('skips the motion for a viewer who asked for less', () => {
    reduced.mockReturnValue(true);
    const { result } = renderHook(() => useProjectionMorph());
    const { run, ticker } = fakeRun();
    result.current.run(run);

    expect(ticker.add).not.toHaveBeenCalled();
    expect(run.onDone).toHaveBeenCalledTimes(1);
  });

  it('comes off the ticker when the map unmounts mid-run', () => {
    const { result, unmount } = renderHook(() => useProjectionMorph());
    const { run, ticker } = fakeRun();
    result.current.run(run);
    unmount();
    expect(ticker.remove).toHaveBeenCalled();
    expect(run.onDone).not.toHaveBeenCalled();
  });
});
