'use client';

import {
  CloseButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { ReactNode, useRef } from 'react';

// The desktop nav needs ~1750px to lay out at full size, so it only appears at
// xl and scales up in three steps instead of switching on at lg and overflowing.
export const NAV_ITEM =
  'font-semibold text-white text-sm min-[1800px]:text-base';
const NAV_POPOVER_BUTTON = `group flex items-center gap-x-1 ${NAV_ITEM}`;

// Matches the drawer's chevron, which turns over the same 200ms. `data-open`
// is on the button, so the icon reads it through the button's `group`.
const NAV_POPOVER_CHEVRON =
  'flex-none text-gray-500 size-5 transition-transform duration-200 group-data-open:rotate-180';

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
 * A menu that opens on hover without a transition, aligns to the start of its
 * button rather than centring on it, and closes both when a link inside it is
 * chosen and when the pointer leaves.
 *
 * `open` and `close` are only reachable through the render prop, so the
 * pointer handlers live on a wrapper inside `Popover` rather than on `Popover`
 * itself. There is no matching `open()`: the state machine has one but does
 * not expose it, so hover opens the menu by clicking the button.
 *
 * The notification bell deliberately does not do any of this — its button
 * marks alerts read, which a pointer sweeping past it must not trigger.
 */
export function NavPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <Popover>
      {({ open, close }) => (
        <div
          className="relative"
          // A tap on a touchscreen fires mouseenter before click, so opening
          // on hover there would hand the click that follows nothing to do
          // but close the menu again. The nav is xl-only, which still leaves
          // landscape tablets and touch laptops.
          onMouseEnter={() => {
            if (open) return;
            if (!window.matchMedia?.('(hover: hover)').matches) return;
            buttonRef.current?.click();
          }}
          onMouseLeave={() => {
            if (open) close();
          }}
        >
          <PopoverButton ref={buttonRef} className={NAV_POPOVER_BUTTON}>
            {label}
            <ChevronDownIcon
              aria-hidden="true"
              className={NAV_POPOVER_CHEVRON}
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
