'use client';

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  PopoverGroup,
} from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import React, { useCallback, useState } from 'react';
import ActiveUsersCounter from '../ActiveUsersCounter';
import AuthButton from '../AuthButton/AuthButton';
import NotificationBell from '../Notifications/NotificationBell';
import EveStatus from '../EveStatus/EveStatus';
import EveTime from '../EveTime/EveTime';
import Tooltip from '../Tooltip/Tooltip';
import {
  MobileNavDisclosure,
  MobileNavLink,
  MobileNavSubLink,
} from './MobileNav';
import Logo from '../ui/Logo';
import { NAV, isNavGroup } from './navItems';
import { NavLink } from './NavLink';
import { NavPopover, NavPopoverLink } from './NavPopover';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const [status, setStatus] = useState<{ players?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sunucu durumu verisini çek
  React.useEffect(() => {
    fetch('https://esi.evetech.net/latest/status/?datasource=tranquility')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch server status');
        return res.json();
      })
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // The page's own colour at 90%, not `surface`. The header is not a panel
  // sitting on the page — it IS the page's top edge, held in place while the
  // rest scrolls under it, and the 10% is what lets you see that something is
  // still moving down there.
  //
  // Still no backdrop-blur, and the reason outlives the colour: an ancestor
  // carrying backdrop-filter establishes a Backdrop Root, and every panel
  // inside then samples only what is painted within that root. That is why the
  // nav popover and the notification panel once came out see-through but flat.
  // `.float` is opaque now so nothing inside is sampling anything, but the
  // trap is still here for whoever puts a blur back on either one.
  return (
    <header className="sticky top-0 z-50 bg-ground/90">
      <nav
        aria-label="Global"
        className="flex items-center justify-between p-6 mx-auto lg:px-8 xl:px-12 2xl:px-16 max-w-480"
      >
        <div className="flex mr-8 2xl:mr-12 min-[1800px]:mr-24">
          <Link
            href="/"
            className="flex items-center gap-2.5 -m-1.5 p-1.5 text-gray-200 transition-colors hover:text-white focus:outline-none focus-visible:text-white"
          >
            <Logo className="size-7 shrink-0" />
            {/* The wordmark is the link's accessible name at every width and
                its visible name only from 2xl. The nav needs ~1750px laid out
                at full size and the word costs about a hundred of them, so
                below that the mark carries the corner alone — which is what
                the HomeIcon it replaced did, with none of the meaning. */}
            <span className="text-lg font-medium tracking-wider whitespace-nowrap sr-only 2xl:not-sr-only">
              KILLREPORT
            </span>
          </Link>
        </div>

        <div className="flex xl:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="button button-ghost button-icon -m-2.5"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon aria-hidden="true" className="size-6" />
          </button>
        </div>
        <PopoverGroup className="hidden xl:flex xl:gap-x-4 2xl:gap-x-6 min-[1800px]:gap-x-8">
          {NAV.map((entry) =>
            isNavGroup(entry) ? (
              <NavPopover
                key={entry.label}
                label={entry.label}
                match={entry.match}
              >
                {entry.items.map((item) => (
                  <NavPopoverLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    description={item.description}
                  />
                ))}
              </NavPopover>
            ) : (
              <NavLink key={entry.href} href={entry.href}>
                {entry.label}
              </NavLink>
            ),
          )}
        </PopoverGroup>

        <div className="hidden xl:flex xl:flex-1 xl:justify-end xl:items-center xl:gap-4 2xl:gap-6 min-[1800px]:gap-8">
          <div className="flex items-center gap-4 min-[1800px]:gap-6">
            {/* Status readouts are the first thing to go when width is tight. */}
            <div className="hidden min-[1800px]:flex min-[1800px]:items-center min-[1800px]:gap-6">
              <ActiveUsersCounter />
              <Tooltip
                content={`Tranquility ${
                  status?.players?.toLocaleString() ?? '-'
                } online players`}
                position="bottom"
              >
                <EveStatus players={status?.players} />
              </Tooltip>
            </div>
            <div className="hidden 2xl:block">
              <Tooltip
                content="Current Eve Online ingame time"
                position="bottom"
              >
                <EveTime />
              </Tooltip>
            </div>
            <NotificationBell />
          </div>
          <AuthButton />
        </div>
      </nav>
      <Dialog
        open={mobileMenuOpen}
        onClose={setMobileMenuOpen}
        transition
        className="xl:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 z-50 transition duration-300 ease-out bg-black/60 data-closed:opacity-0 data-leave:duration-200 data-leave:ease-in"
        />
        <DialogPanel
          transition
          className="fixed inset-y-0 right-0 z-50 w-full p-6 overflow-y-auto transition duration-300 ease-out float sm:max-w-sm data-closed:translate-x-full data-leave:duration-200 data-leave:ease-in"
        >
          <div className="flex items-center justify-between">
            {/* The drawer is a column with room to spare, so the wordmark
                shows at every width here. */}
            <Link
              href="/"
              onClick={closeMobileMenu}
              className="flex items-center gap-2.5 -m-1.5 p-1.5 text-gray-200 transition-colors hover:text-white focus:outline-none focus-visible:text-white"
            >
              <Logo className="size-7 shrink-0" />
              <span className="text-lg font-medium tracking-wider">
                KILLREPORT
              </span>
            </Link>
            <button
              onClick={closeMobileMenu}
              className="button button-ghost button-icon -m-2.5"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden="true" className="size-6" />
            </button>
          </div>
          <div className="flow-root mt-6">
            <div className="-my-6 divide-y divide-white/5">
              <div className="py-6 space-y-2">
                {NAV.map((entry) =>
                  isNavGroup(entry) ? (
                    <MobileNavDisclosure key={entry.label} label={entry.label}>
                      {entry.items.map((item) => (
                        <MobileNavSubLink
                          key={item.href}
                          href={item.href}
                          onNavigate={closeMobileMenu}
                        >
                          {item.label}
                        </MobileNavSubLink>
                      ))}
                    </MobileNavDisclosure>
                  ) : (
                    <MobileNavLink
                      key={entry.href}
                      href={entry.href}
                      onNavigate={closeMobileMenu}
                    >
                      {entry.label}
                    </MobileNavLink>
                  ),
                )}
              </div>
              <div className="py-6">
                <div className="px-3">
                  <AuthButton />
                </div>
              </div>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>
  );
}
