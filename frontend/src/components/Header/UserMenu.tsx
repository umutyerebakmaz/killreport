'use client';

import {
  CloseButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/20/solid';

import EveImage from '@/components/ui/EveImage';
import type { UserData } from '@/hooks/useAuth';

/**
 * The signed-in character, drawn as the header's right-hand edge.
 *
 * Built the way NotificationBell is: it opens on click only, because the one
 * row inside ends the session and a pointer sweeping past must not put it
 * under the cursor, and it closes when the pointer leaves.
 *
 * The box is 64px with its border, and `-my-3` lets it spill 12px into the
 * nav's padding on each side: it counts as 40px in the row, the height the
 * LOGIN button it replaces already had, so the header stays 88px whether
 * anyone is signed in or not, and the portrait sits on the row's centre line.
 * The margin is on the wrapper rather than the button because the wrapper is
 * what the panel is positioned against — on the button, the wrapper would
 * measure 40px and the panel would open over the bottom of the portrait.
 */
export function UserMenu({
  user,
  onLogout,
}: {
  user: UserData;
  onLogout: () => void;
}) {
  return (
    <Popover>
      {({ open, close }) => (
        <div
          className="relative -my-3"
          onMouseLeave={() => {
            if (open) close();
          }}
        >
          <PopoverButton
            aria-label={`Account menu for ${user.characterName}`}
            className="block transition-colors border size-16 border-white/10 hover:border-white/25 focus:outline-none focus-visible:border-white/25 data-open:border-white/25"
          >
            <EveImage
              kind="character"
              id={Number(user.characterId)}
              name={user.characterName}
              size={62}
            />
          </PopoverButton>
          {/* The 12px offset is padding, not a margin, so the pointer stays
              inside the panel on its way down from the portrait and the panel
              is not dismissed mid-travel. */}
          <PopoverPanel
            transition
            className="absolute right-0 z-10 w-56 pt-3 transition duration-0 data-closed:opacity-0 data-leave:duration-150 data-leave:ease-in"
          >
            <div className="overflow-hidden float">
              <div className="px-4 py-3 text-sm font-medium text-white truncate border-b border-white/10">
                {user.characterName}
              </div>
              {/* Red where the nav popovers use cyan: the row is not a place
                  to go, it ends the session. Utilities outrank `.menu-row`'s
                  own neutral hover. */}
              <CloseButton
                onClick={onLogout}
                className="px-4 text-white menu-row hover:bg-danger/20 focus:outline-none focus-visible:bg-danger/20"
              >
                <ArrowRightStartOnRectangleIcon
                  aria-hidden="true"
                  className="size-5 text-ink-muted"
                />
                Logout
              </CloseButton>
            </div>
          </PopoverPanel>
        </div>
      )}
    </Popover>
  );
}
