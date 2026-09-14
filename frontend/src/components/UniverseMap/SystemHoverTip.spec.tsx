import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SystemHoverTip from './SystemHoverTip';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };

describe('SystemHoverTip', () => {
  it('shows the name and the security on one line', () => {
    render(
      <SystemHoverTip
        name="Jita"
        securityStatus={0.94}
        screenX={100}
        screenY={100}
        anchorRadius={1.5}
        {...VIEWPORT}
      />,
    );

    expect(screen.getByText('Jita')).toBeInTheDocument();
    expect(screen.getByText('0.9')).toBeInTheDocument();
  });

  it('is centred across the dot and sits clear beneath it', () => {
    const { container } = render(
      <SystemHoverTip
        name="Jita"
        securityStatus={0.94}
        screenX={100}
        screenY={100}
        anchorRadius={1.5}
        {...VIEWPORT}
      />,
    );

    // Centred: 100 - 140/2. Below: 100 + the dot's 1.5 px radius + the 12 px
    // gap, so the system the tip names is not hidden by it.
    const tip = container.firstElementChild as HTMLElement;
    expect(tip.style.left).toBe('30px');
    expect(tip.style.top).toBe('113.5px');
  });

  it('does not take pointer events, so it cannot block a drag', () => {
    const { container } = render(
      <SystemHoverTip
        name="Jita"
        securityStatus={0.94}
        screenX={100}
        screenY={100}
        anchorRadius={1.5}
        {...VIEWPORT}
      />,
    );

    expect(container.firstElementChild).toHaveClass('pointer-events-none');
  });

  it('renders a wormhole system whose security is negative', () => {
    render(
      <SystemHoverTip
        name="Sentinel MZ"
        securityStatus={-0.99}
        screenX={10}
        screenY={10}
        anchorRadius={1.5}
        {...VIEWPORT}
      />,
    );

    expect(screen.getByText('Sentinel MZ')).toBeInTheDocument();
    expect(screen.getByText('-1.0')).toBeInTheDocument();
  });
});
