import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserMenu } from './UserMenu';

const character = {
  characterId: '95465499',
  characterName: 'Umut Yerebakmaz',
};

// jsdom has no matchMedia, so hover-to-open is inert unless a test asks for it.
function stubPointer({ canHover }: { canHover: boolean }) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: canHover, media: query })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderUserMenu() {
  const onLogout = vi.fn();
  render(<UserMenu user={character} onLogout={onLogout} />);
  return {
    onLogout,
    button: screen.getByRole('button', { name: /account menu for umut/i }),
  };
}

const logoutButton = () => screen.queryByRole('button', { name: /logout/i });

describe('UserMenu', () => {
  it('draws the character portrait', () => {
    renderUserMenu();
    expect(screen.getByAltText('Umut Yerebakmaz')).toHaveAttribute(
      'src',
      'https://images.evetech.net/characters/95465499/portrait?size=64',
    );
  });

  it('opens on click and names the signed-in character', async () => {
    const user = userEvent.setup();
    const { button } = renderUserMenu();
    expect(logoutButton()).toBeNull();

    await user.click(button);

    expect(logoutButton()).toBeInTheDocument();
    expect(
      screen.getByText('Signed in as Umut Yerebakmaz'),
    ).toBeInTheDocument();
  });

  it('opens on hover alone when the pointer can hover', async () => {
    stubPointer({ canHover: true });
    const user = userEvent.setup();
    const { button } = renderUserMenu();

    await user.hover(button);

    expect(logoutButton()).toBeInTheDocument();
  });

  it('ignores hover on a device that cannot hover', async () => {
    stubPointer({ canHover: false });
    const user = userEvent.setup();
    const { button } = renderUserMenu();

    await user.hover(button);

    expect(logoutButton()).toBeNull();
  });

  it('closes when the pointer leaves', async () => {
    const user = userEvent.setup();
    const { button } = renderUserMenu();
    await user.click(button);

    await user.unhover(button.parentElement as HTMLElement);

    await waitFor(() => expect(logoutButton()).toBeNull());
  });

  it('calls onLogout once and closes when LOGOUT is chosen', async () => {
    const user = userEvent.setup();
    const { button, onLogout } = renderUserMenu();
    await user.click(button);

    await user.click(logoutButton()!);

    expect(onLogout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(logoutButton()).toBeNull());
  });
});
