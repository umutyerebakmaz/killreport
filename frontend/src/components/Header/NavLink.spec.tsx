import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavLink } from './NavLink';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

afterEach(() => {
  pathname = '/';
});

function renderNavLink() {
  render(<NavLink href="/alliances">ALLIANCES</NavLink>);
  return screen.getByRole('link', { name: 'ALLIANCES' });
}

describe('NavLink', () => {
  it('marks itself as the current page on its own route', () => {
    pathname = '/alliances';

    expect(renderNavLink()).toHaveAttribute('aria-current', 'page');
  });

  it('stays current on a detail page below its route', () => {
    pathname = '/alliances/99005338';

    expect(renderNavLink()).toHaveAttribute('aria-current', 'page');
  });

  it('is not current elsewhere', () => {
    pathname = '/corporations';

    expect(renderNavLink()).not.toHaveAttribute('aria-current');
  });

  it('carries the class the accent line hangs off', () => {
    expect(renderNavLink()).toHaveClass('nav-item');
  });
});
