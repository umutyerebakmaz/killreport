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

  it('opens on click', async () => {
    const user = userEvent.setup();
    const { button } = renderUserMenu();
    expect(logoutButton()).toBeNull();

    await user.click(button);

    expect(logoutButton()).toBeInTheDocument();
  });

  it('shows the portrait at 256px inside the panel, fetched at twice that', async () => {
    const user = userEvent.setup();
    const { button } = renderUserMenu();

    await user.click(button);

    const large = screen
      .getAllByAltText('Umut Yerebakmaz')
      .find((img) => img.getAttribute('width') === '256');
    expect(large).toHaveAttribute(
      'src',
      'https://images.evetech.net/characters/95465499/portrait?size=512',
    );
  });

  it('lays the name, corporation and alliance over the portrait', async () => {
    const user = userEvent.setup();
    render(
      <UserMenu
        user={character}
        corporation={{ id: 98000001, name: 'Test Corp' }}
        alliance={{ id: 99000001, name: 'Test Alliance' }}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    expect(screen.getByText('Umut Yerebakmaz')).toBeInTheDocument();
    expect(screen.getByText('Test Corp')).toBeInTheDocument();
    expect(screen.getByAltText('Test Corp')).toHaveAttribute(
      'src',
      'https://images.evetech.net/corporations/98000001/logo?size=64',
    );
    expect(screen.getByText('Test Alliance')).toBeInTheDocument();
    expect(screen.getByAltText('Test Alliance')).toHaveAttribute(
      'src',
      'https://images.evetech.net/alliances/99000001/logo?size=64',
    );
  });

  it('links the corporation and alliance to their pages', async () => {
    const user = userEvent.setup();
    render(
      <UserMenu
        user={character}
        corporation={{ id: 98000001, name: 'Test Corp' }}
        alliance={{ id: 99000001, name: 'Test Alliance' }}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    expect(screen.getByRole('link', { name: 'Test Corp' })).toHaveAttribute(
      'href',
      '/corporations/98000001',
    );
    expect(screen.getByRole('link', { name: 'Test Alliance' })).toHaveAttribute(
      'href',
      '/alliances/99000001',
    );
  });

  it('leaves out the alliance line for a character without one', async () => {
    const user = userEvent.setup();
    render(
      <UserMenu
        user={character}
        corporation={{ id: 98000001, name: 'Test Corp' }}
        alliance={null}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    expect(screen.getByText('Test Corp')).toBeInTheDocument();
    expect(screen.queryByText('Test Alliance')).toBeNull();
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
