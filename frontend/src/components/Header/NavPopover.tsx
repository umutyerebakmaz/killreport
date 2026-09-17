'use client';

import {
  CloseButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useRef } from 'react';

import { isNavActive } from '@/utils/navActive';

// The desktop nav needs ~1750px to lay out at full size, so it only appears at
// xl and scales up in three steps instead of switching on at lg and overflowing.
// `nav-item` (globals.css) is the accent line that sweeps in above the label on
// hover, copied from eveonline.com's nav. It rides on this constant rather than
// on each call site so the popover buttons below get it from NAV_POPOVER_BUTTON.
//
// That line is also why every ring is gone from here. `nav-item` opens on
// `:focus-visible` as well as on hover, so keyboard focus is already shown —
// and shown in the nav's own language rather than as a rectangle around the
// word. Without `focus:outline-none` the browser draws its default ring on top
// of it, which on a dark page is the white one. There is no `focus-visible`
// rule to take away with it: `:focus-visible` is a subset of `:focus`, so the
// one declaration covers pointer and keyboard alike.
export const NAV_ITEM =
  'nav-item font-medium text-white text-sm min-[1800px]:text-base focus:outline-none';
const NAV_POPOVER_BUTTON = `group flex items-center gap-x-1 ${NAV_ITEM}`;

// Matches the drawer's chevron, which turns over the same 200ms. `data-open`
// is on the button, so the icon reads it through the button's `group`.
const NAV_POPOVER_CHEVRON =
  'flex-none text-ink-faint size-5 transition-transform duration-200 group-data-open:rotate-180';

// The panel carries no background of its own — it is the hit area, and the
// 12px offset below the button is `pt-3` rather than `mt-3` so the pointer
// stays inside it while travelling from button to menu. With a margin the
// pointer is over neither element in that gap and onMouseLeave fires before
// the menu is ever reached.
const NAV_POPOVER_PANEL =
  'absolute left-0 z-10 w-screen max-w-md pt-3 transition duration-0 data-closed:opacity-0 data-leave:duration-150 data-leave:ease-in';

// The visible surface, held one level in so `overflow-hidden` clips the menu
// rows and not the gap above them.
const NAV_POPOVER_SURFACE = 'overflow-hidden float p-4';

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
 *
 * `match` is the set of routes the menu owns, and it has to be given: the
 * children are `CloseButton as={Link}` elements whose hrefs are not readable
 * from here without walking the tree, and a menu that quietly never lights up
 * is a harder thing to notice than a missing argument.
 */
export function NavPopover({
  label,
  match,
  children,
}: {
  label: string;
  match: readonly string[];
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

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
            if (!open) return;
            close();
            // `close()` is Headless UI's `refocusableClose`, which always puts
            // focus back on the button. That is right after Escape and wrong
            // after the pointer simply moved away, so the focus goes with it.
            buttonRef.current?.blur();
          }}
        >
          {/* `data-current` rather than `aria-current`: the button is not the
              page you are on, it is the section that holds it, and announcing
              it as the current page would be a lie to a screen reader. The
              link inside the panel carries the honest one. */}
          <PopoverButton
            ref={buttonRef}
            className={NAV_POPOVER_BUTTON}
            data-current={isNavActive(pathname, match) || undefined}
          >
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
  // The row is what lights up, but the link inside it is what takes focus, so
  // `has-[a:focus-visible]` is how the row hears about it — the link is not an
  // ancestor and `group-*` only reads the element carrying `group`. Keyboard
  // and pointer then land on the same highlight instead of on a ring the row
  // would draw around a word rather than around itself.
  return (
    <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50 has-[a:focus-visible]:bg-cyan-900/50">
      <div className="flex-auto">
        <CloseButton
          as={Link}
          href={href}
          className="block font-medium text-white focus:outline-none"
        >
          {label}
          <span className="absolute inset-0" />
        </CloseButton>
        <p className="mt-1 text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
