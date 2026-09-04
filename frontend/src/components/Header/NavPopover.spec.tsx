import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { NavPopover, NavPopoverLink } from './NavPopover';

function renderNavPopover() {
  render(
    <NavPopover label="UNIVERSE">
      <NavPopoverLink
        href="/regions"
        label="REGIONS"
        description="64 Regions across New Eden"
      />
    </NavPopover>,
  );
  return { button: screen.getByRole('button', { name: /universe/i }) };
}

describe('NavPopover', () => {
  it('keeps the panel closed until the button is pressed', () => {
    renderNavPopover();

    expect(screen.queryByRole('link', { name: /regions/i })).toBeNull();
  });

  it('opens the panel on click', async () => {
    const user = userEvent.setup();
    const { button } = renderNavPopover();

    await user.click(button);

    expect(screen.getByRole('link', { name: /regions/i })).toBeInTheDocument();
  });

  it('closes the panel when a link inside it is selected', async () => {
    const user = userEvent.setup();
    const { button } = renderNavPopover();
    await user.click(button);

    await user.click(screen.getByRole('link', { name: /regions/i }));

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /regions/i })).toBeNull(),
    );
  });

  it('closes the panel when the pointer leaves it', async () => {
    const user = userEvent.setup();
    const { button } = renderNavPopover();
    await user.click(button);

    await user.unhover(button.parentElement as HTMLElement);

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /regions/i })).toBeNull(),
    );
  });

  it('leaves the panel open while the pointer is still inside it', async () => {
    const user = userEvent.setup();
    const { button } = renderNavPopover();
    await user.click(button);

    await user.hover(screen.getByRole('link', { name: /regions/i }));

    expect(screen.getByRole('link', { name: /regions/i })).toBeInTheDocument();
  });
});
