import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Tooltip from './Tooltip';

/**
 * jsdom lays nothing out, so the trigger and the tooltip are given the boxes a
 * browser would measure: a trigger at x 100–300, y 50–70, a 120 × 24 tooltip.
 */
function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const rect = this.classList.contains('tooltip-trigger')
        ? { left: 100, right: 300, top: 50, bottom: 70, width: 200, height: 20 }
        : { left: 0, right: 120, top: 0, bottom: 24, width: 120, height: 24 };
      return { ...rect, x: rect.left, y: rect.top, toJSON: () => rect };
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Tooltip', () => {
  it('top-start sits above the trigger, its left edge on the trigger’s start', async () => {
    stubLayout();
    render(
      <Tooltip content="Show Corporation Info" position="top-start">
        <span>Kenshin.</span>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByText('Kenshin.'));
    const tooltip = await screen.findByText('Show Corporation Info');

    expect(tooltip.style.left).toBe('100px');
    expect(tooltip.style.top).toBe('18px'); // 50 − 24 − 8
  });

  it('top still centres on the trigger', async () => {
    stubLayout();
    render(
      <Tooltip content="Show Corporation Info">
        <span>Kenshin.</span>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByText('Kenshin.'));
    const tooltip = await screen.findByText('Show Corporation Info');

    expect(tooltip.style.left).toBe('140px'); // 100 + 200 / 2 − 120 / 2
  });
});
