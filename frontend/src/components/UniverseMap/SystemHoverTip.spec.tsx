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
        {...VIEWPORT}
      />,
    );

    expect(screen.getByText('Jita')).toBeInTheDocument();
    expect(screen.getByText('0.9')).toBeInTheDocument();
  });

  it('is positioned down and to the right of the dot', () => {
    const { container } = render(
      <SystemHoverTip
        name="Jita"
        securityStatus={0.94}
        screenX={100}
        screenY={100}
        {...VIEWPORT}
      />,
    );

    const tip = container.firstElementChild as HTMLElement;
    expect(tip.style.left).toBe('112px');
    expect(tip.style.top).toBe('112px');
  });

  it('does not take pointer events, so it cannot block a drag', () => {
    const { container } = render(
      <SystemHoverTip
        name="Jita"
        securityStatus={0.94}
        screenX={100}
        screenY={100}
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
        {...VIEWPORT}
      />,
    );

    expect(screen.getByText('Sentinel MZ')).toBeInTheDocument();
    expect(screen.getByText('-1.0')).toBeInTheDocument();
  });
});
