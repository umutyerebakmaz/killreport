'use client';

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  PopoverGroup,
} from '@headlessui/react';
import { Bars3Icon, XMarkIcon, HomeIcon } from '@heroicons/react/24/outline';
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
import { NAV_ITEM, NavPopover, NavPopoverLink } from './NavPopover';

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

  return (
    <header className="sticky top-0 z-50 backdrop-blur-sm bg-neutral-900">
      <nav
        aria-label="Global"
        className="flex items-center justify-between p-6 mx-auto lg:px-8 xl:px-12 2xl:px-16 max-w-480"
      >
        <div className="flex mr-8 2xl:mr-12 min-[1800px]:mr-24">
          <Link
            href="/"
            className="-m-1.5 p-1.5 text-gray-200 transition-colors hover:text-white"
          >
            <span className="sr-only">KillReport</span>
            <HomeIcon aria-hidden="true" className="size-7" />
          </Link>
        </div>

        <div className="flex xl:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-400"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon aria-hidden="true" className="size-6" />
          </button>
        </div>
        <PopoverGroup className="hidden xl:flex xl:gap-x-4 2xl:gap-x-6 min-[1800px]:gap-x-8">
          <NavPopover label="UNIVERSE">
            <NavPopoverLink
              href="/regions"
              label="REGIONS"
              description="64 Regions across New Eden - High, Low, Null, and Wormhole space"
            />
            <NavPopoverLink
              href="/constellations"
              label="CONSTELLATIONS"
              description="1,090+ Constellations connecting solar systems"
            />
            <NavPopoverLink
              href="/solar-systems"
              label="SOLAR SYSTEMS"
              description="8,000+ Solar Systems with security ratings and statistics"
            />
          </NavPopover>
          <NavPopover label="KILLMAILS">
            <NavPopoverLink
              href="/killmails?page=1&regionId=10000070"
              label="POCHVEN"
              description="Explore Pochven triglavian space killmails and statistics"
            />
            <NavPopoverLink
              href="/killmails?page=1&securitySpace=wormhole"
              label="WORMHOLES"
              description="Explore wormhole space killmails and statistics"
            />
          </NavPopover>
          <Link href="/alliances" className={NAV_ITEM}>
            ALLIANCES
          </Link>
          <Link href="/corporations" className={NAV_ITEM}>
            CORPORATIONS
          </Link>
          <Link href="/characters" className={NAV_ITEM}>
            CHARACTERS
          </Link>
          <Link href="/leaderboards" className={NAV_ITEM}>
            LEADERBOARDS
          </Link>
          <NavPopover label="SOVEREIGNTY">
            <NavPopoverLink
              href="/sovereignty"
              label="OVERVIEW"
              description="Null-sec territory control, rankings, and active wars"
            />
            <NavPopoverLink
              href="/sovereignty/structures"
              label="STRUCTURES &amp; TIMERS"
              description="IHub/TCU inventory and upcoming vulnerability windows"
            />
            <NavPopoverLink
              href="/sovereignty/history"
              label="HISTORY"
              description="Resolved campaigns, outcomes, and top defenders"
            />
            <NavPopoverLink
              href="/sovereignty/hotspots"
              label="HOT ZONES"
              description="Regions ranked by conflict intensity"
            />
            <NavPopoverLink
              href="/sovereignty/map"
              label="MAP"
              description="Territory map colored by controlling alliance"
            />
          </NavPopover>
          <Link href="/workers" className={NAV_ITEM}>
            WORKERS
          </Link>
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
          className="fixed inset-y-0 right-0 z-50 w-full p-6 overflow-y-auto transition duration-300 ease-out bg-stone-900 sm:max-w-sm sm:ring-1 sm:ring-gray-100/10 data-closed:translate-x-full data-leave:duration-200 data-leave:ease-in"
        >
          <div className="flex items-center justify-between">
            <Link
              href="/"
              onClick={closeMobileMenu}
              className="-m-1.5 p-1.5 text-gray-200 transition-colors hover:text-white"
            >
              <span className="sr-only">KillReport</span>
              <HomeIcon aria-hidden="true" className="size-7" />
            </Link>
            <button
              onClick={closeMobileMenu}
              className="-m-2.5 rounded-md p-2.5 text-gray-400"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden="true" className="size-6" />
            </button>
          </div>
          <div className="flow-root mt-6">
            <div className="-my-6 divide-y divide-white/5">
              <div className="py-6 space-y-2">
                <MobileNavDisclosure label="UNIVERSE">
                  <MobileNavSubLink
                    href="/regions"
                    onNavigate={closeMobileMenu}
                  >
                    REGIONS
                  </MobileNavSubLink>
                  <MobileNavSubLink
                    href="/constellations"
                    onNavigate={closeMobileMenu}
                  >
                    CONSTELLATIONS
                  </MobileNavSubLink>
                  <MobileNavSubLink
                    href="/solar-systems"
                    onNavigate={closeMobileMenu}
                  >
                    SOLAR SYSTEMS
                  </MobileNavSubLink>
                </MobileNavDisclosure>
                <MobileNavDisclosure label="KILLMAILS">
                  <MobileNavSubLink
                    href="/killmails?page=1&regionId=10000070"
                    onNavigate={closeMobileMenu}
                  >
                    POCHVEN
                  </MobileNavSubLink>
                  <MobileNavSubLink
                    href="/killmails?page=1&securitySpace=wormhole"
                    onNavigate={closeMobileMenu}
                  >
                    WORMHOLES
                  </MobileNavSubLink>
                </MobileNavDisclosure>
                <MobileNavLink href="/alliances" onNavigate={closeMobileMenu}>
                  ALLIANCES
                </MobileNavLink>
                <MobileNavLink
                  href="/corporations"
                  onNavigate={closeMobileMenu}
                >
                  CORPORATIONS
                </MobileNavLink>
                <MobileNavLink href="/characters" onNavigate={closeMobileMenu}>
                  CHARACTERS
                </MobileNavLink>
                <MobileNavLink
                  href="/leaderboards"
                  onNavigate={closeMobileMenu}
                >
                  LEADERBOARDS
                </MobileNavLink>
                <MobileNavDisclosure label="SOVEREIGNTY">
                  <MobileNavSubLink
                    href="/sovereignty"
                    onNavigate={closeMobileMenu}
                  >
                    OVERVIEW
                  </MobileNavSubLink>
                  <MobileNavSubLink
                    href="/sovereignty/structures"
                    onNavigate={closeMobileMenu}
                  >
                    STRUCTURES &amp; TIMERS
                  </MobileNavSubLink>
                  <MobileNavSubLink
                    href="/sovereignty/history"
                    onNavigate={closeMobileMenu}
                  >
                    HISTORY
                  </MobileNavSubLink>
                  <MobileNavSubLink
                    href="/sovereignty/hotspots"
                    onNavigate={closeMobileMenu}
                  >
                    HOT ZONES
                  </MobileNavSubLink>
                  <MobileNavSubLink
                    href="/sovereignty/map"
                    onNavigate={closeMobileMenu}
                  >
                    MAP
                  </MobileNavSubLink>
                </MobileNavDisclosure>
                <MobileNavLink href="/workers" onNavigate={closeMobileMenu}>
                  WORKERS
                </MobileNavLink>
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
