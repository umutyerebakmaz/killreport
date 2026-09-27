'use client';

import {
  CloseButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/20/solid';
import { useRef } from 'react';

import EveImage from '@/components/ui/EveImage';
import type { UserData } from '@/hooks/useAuth';

// NavPopover's panel and surface, anchored to the right edge instead of the
// left: the portrait is the last thing in the header, and a panel opening
// rightwards from it would run off the page.
const USER_MENU_PANEL =
  'absolute right-0 z-10 w-screen max-w-xs pt-3 transition duration-0 data-closed:opacity-0 data-leave:duration-150 data-leave:ease-in';
const USER_MENU_SURFACE = 'overflow-hidden float p-4';

/**
 * The signed-in character, drawn as the header's right-hand edge.
 *
 * Built the way NavPopover is — open on hover where the pointer can hover,
 * close and let go of focus when it leaves, 12px of padding rather than margin
 * between button and surface — so the header has one dropdown behaviour, not
 * two. Hovering only shows the row; ending the session still takes a click.
 *
 * At 32px the portrait is shorter than the 40px row the LOGIN button sets, so
 * the header's height does not move between the two states.
 */
export function UserMenu({
  user,
  onLogout,
}: {
  user: UserData;
  onLogout: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <Popover>
      {({ open, close }) => (
        <div
          className="relative"
          // Same touch guard as NavPopover: a tap fires mouseenter before
          // click, and opening on it would let the click close the panel again.
          onMouseEnter={() => {
            if (open) return;
            if (!window.matchMedia?.('(hover: hover)').matches) return;
            buttonRef.current?.click();
          }}
          onMouseLeave={() => {
            if (!open) return;
            close();
            buttonRef.current?.blur();
          }}
        >
          {/* `nav-item` is the nav's own hover line (globals.css), so the
              portrait answers the pointer and the keyboard the way every other
              entry in the header does. */}
          <PopoverButton
            ref={buttonRef}
            aria-label={`Account menu for ${user.characterName}`}
            className="block size-8 nav-item focus:outline-none"
          >
            <EveImage
              kind="character"
              id={Number(user.characterId)}
              name={user.characterName}
              size={32}
            />
          </PopoverButton>
          <PopoverPanel transition className={USER_MENU_PANEL}>
            <div className={USER_MENU_SURFACE}>
              {/* NavPopoverLink's padding and hit area, with an icon in place of
                  the description, and red where it is cyan: the row is not a
                  place to go, it ends the session. */}
              <div className="relative flex items-center p-4 gap-x-3 text-sm/6 hover:bg-danger/20 has-[button:focus-visible]:bg-danger/20">
                <ArrowRightStartOnRectangleIcon
                  aria-hidden="true"
                  className="flex-none size-5 text-ink-muted"
                />
                <CloseButton
                  onClick={onLogout}
                  className="block font-medium text-left text-white focus:outline-none"
                >
                  LOGOUT
                  <span className="absolute inset-0" />
                </CloseButton>
              </div>
            </div>
          </PopoverPanel>
        </div>
      )}
    </Popover>
  );
}
