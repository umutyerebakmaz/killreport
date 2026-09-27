'use client';

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/20/solid';

import EveImage from '@/components/ui/EveImage';
import type { UserData } from '@/hooks/useAuth';

/**
 * The signed-in character, drawn as the header's right-hand edge.
 *
 * Opens on click only. The one row inside ends the session, and a pointer
 * sweeping past must not put it under the cursor — the reason the
 * notification bell does not open on hover either.
 *
 * The box is 64px with its border, and `-my-3` lets it spill 12px into the
 * nav's padding on each side: it counts as 40px in the row, the height the
 * LOGIN button it replaces already had, so the header stays 88px whether
 * anyone is signed in or not, and the portrait sits on the row's centre line.
 */
export function UserMenu({
  user,
  onLogout,
}: {
  user: UserData;
  onLogout: () => void;
}) {
  return (
    <Menu>
      <MenuButton
        aria-label={`Account menu for ${user.characterName}`}
        className="block -my-3 transition-colors border size-16 border-white/10 hover:border-white/25 focus:outline-none data-focus:border-white/25 data-open:border-white/25"
      >
        <EveImage
          kind="character"
          id={Number(user.characterId)}
          name={user.characterName}
          size={62}
        />
      </MenuButton>
      {/* Red where the nav popovers use cyan: the row is not a place to go,
          it ends the session. `data-focus` is set for pointer and arrow keys
          alike, and as a utility it outranks `.menu-row`'s own neutral hover. */}
      <MenuItems
        transition
        anchor="bottom end"
        className="z-50 w-56 float [--anchor-gap:12px] focus:outline-none transition duration-0 data-closed:opacity-0 data-leave:duration-150 data-leave:ease-in"
      >
        <div className="px-4 py-3 text-sm font-medium text-white truncate border-b border-white/10">
          {user.characterName}
        </div>
        <MenuItem>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 text-white menu-row data-focus:bg-danger/20"
          >
            <ArrowRightStartOnRectangleIcon
              aria-hidden="true"
              className="size-5 text-ink-muted"
            />
            Logout
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
