import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserMenu } from './UserMenu';

const user = { characterId: '95465499', characterName: 'Umut Yerebakmaz' };

function renderUserMenu() {
  const onLogout = vi.fn();
  render(<UserMenu user={user} onLogout={onLogout} />);
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
      'https://images.evetech.net/characters/95465499/portrait?size=128',
    );
  });

  it('is closed until clicked, then shows the name and Logout', async () => {
    const { button } = renderUserMenu();
    expect(logoutButton()).not.toBeInTheDocument();

    await userEvent.click(button);

    expect(screen.getByText('Umut Yerebakmaz')).toBeInTheDocument();
    expect(logoutButton()).toBeInTheDocument();
  });

  it('does not open on hover', async () => {
    const { button } = renderUserMenu();
    await userEvent.hover(button);
    expect(logoutButton()).not.toBeInTheDocument();
  });

  it('closes when the pointer leaves', async () => {
    const { button } = renderUserMenu();
    await userEvent.click(button);
    await userEvent.unhover(button);
    await waitFor(() => expect(logoutButton()).not.toBeInTheDocument());
  });

  it('calls onLogout once when Logout is chosen', async () => {
    const { button, onLogout } = renderUserMenu();
    await userEvent.click(button);
    await userEvent.click(logoutButton()!);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
