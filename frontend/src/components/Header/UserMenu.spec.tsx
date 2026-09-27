import { render, screen } from '@testing-library/react';
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
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(button);

    expect(screen.getByRole('menu')).toHaveTextContent('Umut Yerebakmaz');
    expect(
      screen.getByRole('menuitem', { name: /logout/i }),
    ).toBeInTheDocument();
  });

  it('does not open on hover', async () => {
    const { button } = renderUserMenu();
    await userEvent.hover(button);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onLogout once when Logout is chosen', async () => {
    const { button, onLogout } = renderUserMenu();
    await userEvent.click(button);
    await userEvent.click(screen.getByRole('menuitem', { name: /logout/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('marks the Logout row focused from the keyboard', async () => {
    const { button } = renderUserMenu();
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /logout/i })).toHaveAttribute(
      'data-focus',
    );
  });
});
