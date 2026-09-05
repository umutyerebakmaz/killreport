import type { KeyboardEvent } from 'react';

export interface UseTabListResult {
  /** Attach to every tab button's onKeyDown. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Roving-tabindex keyboard navigation for an ARIA `role="tablist"`.
 *
 * Left/Right move the selection by one tab, wrapping past either end; Home
 * and End jump straight to the first and last tab. The tab that becomes
 * selected also receives DOM focus, found by walking up to the enclosing
 * `role="tablist"` and querying its `role="tab"` descendants, so the arrow
 * keys keep working without the user pressing Tab again — and without
 * assuming every tab is a direct child of the tablist.
 *
 * @param tabs - the tab ids, in the order they are rendered
 * @param activeTab - the currently selected tab id
 * @param onTabChange - called with the tab id the selection should move to
 * @returns an onKeyDown handler to attach to each tab button
 */
export function useTabList<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  onTabChange: (tab: T) => void,
): UseTabListResult {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex === -1) {
      return;
    }

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onTabChange(tabs[nextIndex]);

    const tablist = event.currentTarget?.closest('[role="tablist"]');
    if (!tablist) {
      return;
    }
    const tabElements = tablist.querySelectorAll<HTMLElement>('[role="tab"]');
    tabElements[nextIndex]?.focus();
  };

  return { onKeyDown };
}
