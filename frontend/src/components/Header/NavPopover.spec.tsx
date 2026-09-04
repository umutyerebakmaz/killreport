import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavPopover, NavPopoverLink } from './NavPopover';

/**
 * jsdom implements no `matchMedia` at all, so hover-to-open is inert in the
 * tests that do not ask for it — which is what keeps the click cases below
 * honest, since a real pointer would have opened the panel before the click.
 */
function stubPointer({ canHover }: { canHover: boolean }) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: canHover, media: query })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('marks the button open, which is what turns the chevron over', async () => {
    const user = userEvent.setup();
    const { button } = renderNavPopover();

    expect(button).not.toHaveAttribute('data-open');
    await user.click(button);

    expect(button).toHaveAttribute('data-open');
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

  it('opens the panel on hover alone when the pointer can hover', async () => {
    stubPointer({ canHover: true });
    const user = userEvent.setup();
    const { button } = renderNavPopover();

    await user.hover(button);

    expect(screen.getByRole('link', { name: /regions/i })).toBeInTheDocument();
  });

  it('ignores hover on a device that cannot hover', async () => {
    // A tap fires mouseenter before click. Opening on it would let the click
    // that follows close the panel again, leaving the menu unusable.
    stubPointer({ canHover: false });
    const user = userEvent.setup();
    const { button } = renderNavPopover();

    await user.hover(button);

    expect(screen.queryByRole('link', { name: /regions/i })).toBeNull();
  });

  it('leaves the panel open while the pointer is still inside it', async () => {
    const user = userEvent.setup();
    const { button } = renderNavPopover();
    await user.click(button);

    await user.hover(screen.getByRole('link', { name: /regions/i }));

    expect(screen.getByRole('link', { name: /regions/i })).toBeInTheDocument();
  });
});
