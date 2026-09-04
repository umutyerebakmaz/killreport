import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  MobileNavDisclosure,
  MobileNavLink,
  MobileNavSubLink,
} from './MobileNav';

describe('MobileNav', () => {
  it('closes the drawer when a top-level link is followed', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <MobileNavLink href="/alliances" onNavigate={onNavigate}>
        ALLIANCES
      </MobileNavLink>,
    );

    await user.click(screen.getByRole('link', { name: 'ALLIANCES' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('closes the drawer when a link inside a group is followed', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <MobileNavDisclosure label="UNIVERSE">
        <MobileNavSubLink href="/regions" onNavigate={onNavigate}>
          REGIONS
        </MobileNavSubLink>
      </MobileNavDisclosure>,
    );
    await user.click(screen.getByRole('button', { name: 'UNIVERSE' }));

    await user.click(screen.getByRole('link', { name: 'REGIONS' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('keeps a group collapsed until its button is pressed', async () => {
    const user = userEvent.setup();
    render(
      <MobileNavDisclosure label="UNIVERSE">
        <MobileNavSubLink href="/regions" onNavigate={vi.fn()}>
          REGIONS
        </MobileNavSubLink>
      </MobileNavDisclosure>,
    );

    expect(screen.queryByRole('link', { name: 'REGIONS' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'UNIVERSE' }));

    expect(screen.getByRole('link', { name: 'REGIONS' })).toBeInTheDocument();
  });

  it('marks the group button open, which is what turns the chevron over', async () => {
    const user = userEvent.setup();
    render(
      <MobileNavDisclosure label="UNIVERSE">
        <MobileNavSubLink href="/regions" onNavigate={vi.fn()}>
          REGIONS
        </MobileNavSubLink>
      </MobileNavDisclosure>,
    );
    const button = screen.getByRole('button', { name: 'UNIVERSE' });

    expect(button).not.toHaveAttribute('data-open');
    await user.click(button);

    expect(button).toHaveAttribute('data-open');
  });
});
