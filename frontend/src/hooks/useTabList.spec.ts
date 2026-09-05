import { renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useTabList } from './useTabList';

const tabs = ['overview', 'members', 'killmails', 'growth'] as const;

type TabKeyboardEvent = KeyboardEvent<HTMLElement>;

function fireKey(
  onKeyDown: (event: TabKeyboardEvent) => void,
  key: string,
  currentTarget?: Partial<HTMLElement>,
) {
  const preventDefault = vi.fn();
  onKeyDown({
    key,
    preventDefault,
    currentTarget,
  } as unknown as TabKeyboardEvent);
  return preventDefault;
}

describe('useTabList', () => {
  it('moves to the next tab on ArrowRight', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'overview', onTabChange),
    );

    fireKey(result.current.onKeyDown, 'ArrowRight');

    expect(onTabChange).toHaveBeenCalledWith('members');
  });

  it('wraps to the first tab when ArrowRight is pressed on the last tab', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'growth', onTabChange),
    );

    fireKey(result.current.onKeyDown, 'ArrowRight');

    expect(onTabChange).toHaveBeenCalledWith('overview');
  });

  it('moves to the previous tab on ArrowLeft', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'killmails', onTabChange),
    );

    fireKey(result.current.onKeyDown, 'ArrowLeft');

    expect(onTabChange).toHaveBeenCalledWith('members');
  });

  it('wraps to the last tab when ArrowLeft is pressed on the first tab', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'overview', onTabChange),
    );

    fireKey(result.current.onKeyDown, 'ArrowLeft');

    expect(onTabChange).toHaveBeenCalledWith('growth');
  });

  it('jumps to the first tab on Home', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'killmails', onTabChange),
    );

    fireKey(result.current.onKeyDown, 'Home');

    expect(onTabChange).toHaveBeenCalledWith('overview');
  });

  it('jumps to the last tab on End', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'overview', onTabChange),
    );

    fireKey(result.current.onKeyDown, 'End');

    expect(onTabChange).toHaveBeenCalledWith('growth');
  });

  it('calls preventDefault for handled navigation keys', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'overview', onTabChange),
    );

    const preventDefault = fireKey(result.current.onKeyDown, 'ArrowRight');

    expect(preventDefault).toHaveBeenCalled();
  });

  it('ignores keys outside the navigation set', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'overview', onTabChange),
    );

    fireKey(result.current.onKeyDown, 'Enter');

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('does nothing when the active tab is not in the list', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'not-a-tab' as (typeof tabs)[number], onTabChange),
    );

    fireKey(result.current.onKeyDown, 'ArrowRight');

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('moves DOM focus to the newly selected tab button', () => {
    const onTabChange = vi.fn();
    const { result } = renderHook(() =>
      useTabList(tabs, 'overview', onTabChange),
    );

    const nextTabButton = { focus: vi.fn() };
    const tabElements = [
      {},
      nextTabButton,
      {},
      {},
    ] as unknown as NodeListOf<HTMLElement>;
    const parentElement = {
      querySelectorAll: vi.fn(() => tabElements),
    };
    const currentTarget = { parentElement } as unknown as Partial<HTMLElement>;

    fireKey(result.current.onKeyDown, 'ArrowRight', currentTarget);

    expect(parentElement.querySelectorAll).toHaveBeenCalledWith('[role="tab"]');
    expect(nextTabButton.focus).toHaveBeenCalled();
  });
});
