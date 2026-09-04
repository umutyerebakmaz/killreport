'use client';

import {
  CloseButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { ReactNode } from 'react';

// The desktop nav needs ~1750px to lay out at full size, so it only appears at
// xl and scales up in three steps instead of switching on at lg and overflowing.
export const NAV_ITEM =
  'font-semibold text-white text-sm min-[1800px]:text-base';
const NAV_POPOVER_BUTTON = `flex items-center gap-x-1 ${NAV_ITEM}`;

// The panel carries no background of its own — it is the hit area, and the
// 12px offset below the button is `pt-3` rather than `mt-3` so the pointer
// stays inside it while travelling from button to menu. With a margin the
// pointer is over neither element in that gap and onMouseLeave fires before
// the menu is ever reached.
const NAV_POPOVER_PANEL =
  'absolute left-0 z-10 w-screen max-w-md pt-3 transition duration-0 data-closed:opacity-0 data-leave:duration-150 data-leave:ease-in';

// The visible surface, held one level in so `overflow-hidden` clips the menu
// rows and not the gap above them.
const NAV_POPOVER_SURFACE =
  'overflow-hidden bg-stone-900 outline-1 -outline-offset-1 outline-white/10 p-4';

/**
 * A nav dropdown that opens without a transition, aligns to the start of its
 * button rather than centring on it, and closes both when a link inside it is
 * chosen and when the pointer leaves.
 *
 * `close` is only reachable through the render prop, so the pointer handler
 * lives on a wrapper inside `Popover` rather than on `Popover` itself.
 */
export function NavPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      {({ open, close }) => (
        <div
          className="relative"
          onMouseLeave={() => {
            if (open) close();
          }}
        >
          <PopoverButton className={NAV_POPOVER_BUTTON}>
            {label}
            <ChevronDownIcon
              aria-hidden="true"
              className="flex-none text-gray-500 size-5"
            />
          </PopoverButton>
          <PopoverPanel transition className={NAV_POPOVER_PANEL}>
            <div className={NAV_POPOVER_SURFACE}>{children}</div>
          </PopoverPanel>
        </div>
      )}
    </Popover>
  );
}

/**
 * One row of a nav dropdown. `CloseButton` dismisses the panel on selection,
 * and `Link` keeps the navigation client-side — a plain anchor reloaded the
 * page and left the panel on screen until the new document painted.
 */
export function NavPopoverLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
      <div className="flex-auto">
        <CloseButton
          as={Link}
          href={href}
          className="block font-semibold text-white"
        >
          {label}
          <span className="absolute inset-0" />
        </CloseButton>
        <p className="mt-1 text-gray-400">{description}</p>
      </div>
    </div>
  );
}
