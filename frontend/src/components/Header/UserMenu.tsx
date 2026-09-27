'use client';

import {
  CloseButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRef } from 'react';

import EveImage from '@/components/ui/EveImage';
import type { UserData } from '@/hooks/useAuth';

// NavPopover's panel and surface, anchored to the right edge instead of the
// left: the portrait is the last thing in the header, and a panel opening
// rightwards from it would run off the page. `w-72` less the surface's `p-4`
// leaves exactly the 256px the portrait inside is drawn at.
const USER_MENU_PANEL =
  'absolute right-0 z-10 w-72 pt-3 transition duration-0 data-closed:opacity-0 data-leave:duration-150 data-leave:ease-in';
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
type Membership = { id: number; name: string } | null | undefined;

export function UserMenu({
  user,
  corporation,
  alliance,
  onLogout,
}: {
  user: UserData;
  /** Absent until the character query answers; the name shows without it. */
  corporation?: Membership;
  alliance?: Membership;
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
              {/* 256px, so the image server is asked for 512 — exactly twice,
                  and the largest size it serves (eveImageUrl.ts). */}
              <div className="relative">
                <EveImage
                  kind="character"
                  id={Number(user.characterId)}
                  name={user.characterName}
                  size={256}
                />
                {/* The bottom band is darkened so the text reads over any
                    portrait: the map cards' scrim, at their height. */}
                <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-linear-to-t from-black/95 via-black/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 space-y-1.5">
                  <p className="font-medium text-white truncate">
                    {user.characterName}
                  </p>
                  {/* Side by side, each truncating on its own when the pair
                      is wider than the portrait. */}
                  {(corporation || alliance) && (
                    <div className="flex items-center gap-3">
                      {corporation && (
                        <MembershipLine
                          kind="corporation"
                          entity={corporation}
                        />
                      )}
                      {alliance && (
                        <MembershipLine kind="alliance" entity={alliance} />
                      )}
                    </div>
                  )}
                </div>
              </div>
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

/**
 * A 20px logo — fetched at 64, twice and rounded up — and the name beside it,
 * linking to the entity's page. `CloseButton` shuts the panel on the way, and
 * `Link` keeps the navigation client-side, as in NavPopoverLink.
 */
function MembershipLine({
  kind,
  entity,
}: {
  kind: 'corporation' | 'alliance';
  entity: { id: number; name: string };
}) {
  return (
    <CloseButton
      as={Link}
      href={`/${kind === 'corporation' ? 'corporations' : 'alliances'}/${entity.id}`}
      // The logo's alt text is the same name, so without this the link
      // would be announced twice over.
      aria-label={entity.name}
      className="flex items-center min-w-0 gap-2 text-sm text-gray-200 transition-colors hover:text-accent-link focus:outline-none focus-visible:text-accent-link"
    >
      <EveImage
        kind={kind}
        id={entity.id}
        name={entity.name}
        size={20}
        className="flex-none"
      />
      <span className="truncate">{entity.name}</span>
    </CloseButton>
  );
}
