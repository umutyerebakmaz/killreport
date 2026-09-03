'use client';

import {
  Dialog,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Popover,
  PopoverButton,
  PopoverGroup,
  PopoverPanel,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { Bars3Icon, XMarkIcon, HomeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import React, { useState } from 'react';
import ActiveUsersCounter from '../ActiveUsersCounter';
import AuthButton from '../AuthButton/AuthButton';
import NotificationBell from '../Notifications/NotificationBell';
import EveStatus from '../EveStatus/EveStatus';
import EveTime from '../EveTime/EveTime';
import Tooltip from '../Tooltip/Tooltip';

// The desktop nav needs ~1750px to lay out at full size, so it only appears at
// xl and scales up in three steps instead of switching on at lg and overflowing.
const NAV_ITEM = 'font-semibold text-white text-sm min-[1800px]:text-base';
const NAV_POPOVER_BUTTON = `flex items-center gap-x-1 ${NAV_ITEM}`;

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
          <Popover className="relative">
            <PopoverButton className={NAV_POPOVER_BUTTON}>
              UNIVERSE
              <ChevronDownIcon
                aria-hidden="true"
                className="flex-none text-gray-500 size-5"
              />
            </PopoverButton>
            <PopoverPanel
              transition
              className="absolute z-10 w-screen max-w-md mt-3 overflow-hidden transition -translate-x-1/2 bg-stone-900 left-1/2 outline-1 -outline-offset-1 outline-white/10 data-closed:translate-y-1 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
            >
              <div className="p-4">
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/regions"
                      className="block font-semibold text-white"
                    >
                      REGIONS
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      64 Regions across New Eden - High, Low, Null, and Wormhole
                      space
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/constellations"
                      className="block font-semibold text-white"
                    >
                      CONSTELLATIONS
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      1,090+ Constellations connecting solar systems
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/solar-systems"
                      className="block font-semibold text-white"
                    >
                      SOLAR SYSTEMS
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      8,000+ Solar Systems with security ratings and statistics
                    </p>
                  </div>
                </div>
              </div>
            </PopoverPanel>
          </Popover>
          <Popover className="relative">
            <PopoverButton className={NAV_POPOVER_BUTTON}>
              KILLMAILS
              <ChevronDownIcon
                aria-hidden="true"
                className="flex-none text-gray-500 size-5"
              />
            </PopoverButton>
            <PopoverPanel
              transition
              className="absolute z-10 w-screen max-w-md mt-3 overflow-hidden transition -translate-x-1/2 bg-stone-900 left-1/2 outline-1 -outline-offset-1 outline-white/10 data-closed:translate-y-1 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
            >
              <div className="p-4">
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/killmails?page=1&regionId=10000070"
                      className="block font-semibold text-white"
                    >
                      POCHVEN
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      Explore Pochven triglavian space killmails and statistics
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/killmails?page=1&securitySpace=wormhole"
                      className="block font-semibold text-white"
                    >
                      WORMHOLES
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      Explore wormhole space killmails and statistics
                    </p>
                  </div>
                </div>
              </div>
            </PopoverPanel>
          </Popover>
          <a href="/alliances" className={NAV_ITEM}>
            ALLIANCES
          </a>
          <a href="/corporations" className={NAV_ITEM}>
            CORPORATIONS
          </a>
          <a href="/characters" className={NAV_ITEM}>
            CHARACTERS
          </a>
          <a href="/leaderboards" className={NAV_ITEM}>
            LEADERBOARDS
          </a>
          <Popover className="relative">
            <PopoverButton className={NAV_POPOVER_BUTTON}>
              SOVEREIGNTY
              <ChevronDownIcon
                aria-hidden="true"
                className="flex-none text-gray-500 size-5"
              />
            </PopoverButton>
            <PopoverPanel
              transition
              className="absolute z-10 w-screen max-w-md mt-3 overflow-hidden transition -translate-x-1/2 bg-stone-900 left-1/2 outline-1 -outline-offset-1 outline-white/10 data-closed:translate-y-1 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
            >
              <div className="p-4">
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/sovereignty"
                      className="block font-semibold text-white"
                    >
                      OVERVIEW
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      Null-sec territory control, rankings, and active wars
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/sovereignty/structures"
                      className="block font-semibold text-white"
                    >
                      STRUCTURES &amp; TIMERS
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      IHub/TCU inventory and upcoming vulnerability windows
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/sovereignty/history"
                      className="block font-semibold text-white"
                    >
                      HISTORY
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      Resolved campaigns, outcomes, and top defenders
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/sovereignty/hotspots"
                      className="block font-semibold text-white"
                    >
                      HOT ZONES
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      Regions ranked by conflict intensity
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center p-4 group gap-x-6 text-sm/6 hover:bg-cyan-900/50">
                  <div className="flex-auto">
                    <a
                      href="/sovereignty/map"
                      className="block font-semibold text-white"
                    >
                      MAP
                      <span className="absolute inset-0" />
                    </a>
                    <p className="mt-1 text-gray-400">
                      Territory map colored by controlling alliance
                    </p>
                  </div>
                </div>
              </div>
            </PopoverPanel>
          </Popover>
          <a href="/workers" className={NAV_ITEM}>
            WORKERS
          </a>
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
        className="xl:hidden"
      >
        <div className="fixed inset-0 z-50" />
        <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full p-6 overflow-y-auto bg-stone-900 sm:max-w-sm sm:ring-1 sm:ring-gray-100/10">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="-m-1.5 p-1.5 text-gray-200 transition-colors hover:text-white"
            >
              <span className="sr-only">KillReport</span>
              <HomeIcon aria-hidden="true" className="size-7" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="-m-2.5 rounded-md p-2.5 text-gray-400"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden="true" className="size-6" />
            </button>
          </div>
          <div className="flow-root mt-6">
            <div className="-my-6 divide-y divide-white/5">
              <div className="py-6 space-y-2">
                <Disclosure as="div" className="-mx-3">
                  <DisclosureButton className="group flex w-full items-center justify-between py-2 pr-3.5 pl-3 text-base/7 font-semibold text-white hover:bg-white/5">
                    UNIVERSE
                    <ChevronDownIcon
                      aria-hidden="true"
                      className="flex-none size-5 group-data-open:rotate-180"
                    />
                  </DisclosureButton>
                  <DisclosurePanel className="mt-2 space-y-2">
                    <DisclosureButton
                      as="a"
                      href="/regions"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      REGIONS
                    </DisclosureButton>
                    <DisclosureButton
                      as="a"
                      href="/constellations"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      CONSTELLATIONS
                    </DisclosureButton>
                    <DisclosureButton
                      as="a"
                      href="/solar-systems"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      SOLAR SYSTEMS
                    </DisclosureButton>
                  </DisclosurePanel>
                </Disclosure>
                <Disclosure as="div" className="-mx-3">
                  <DisclosureButton className="group flex w-full items-center justify-between py-2 pr-3.5 pl-3 text-base/7 font-semibold text-white hover:bg-white/5">
                    KILLMAILS
                    <ChevronDownIcon
                      aria-hidden="true"
                      className="flex-none size-5 group-data-open:rotate-180"
                    />
                  </DisclosureButton>
                  <DisclosurePanel className="mt-2 space-y-2">
                    <DisclosureButton
                      as="a"
                      href="/killmails?page=1&regionId=10000070"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      POCHVEN
                    </DisclosureButton>
                    <DisclosureButton
                      as="a"
                      href="/killmails?page=1&securitySpace=wormhole"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      WORMHOLES
                    </DisclosureButton>
                  </DisclosurePanel>
                </Disclosure>
                <a
                  href="/alliances"
                  className="block px-3 py-2 -mx-3 font-semibold text-white text-base/7 hover:bg-white/5"
                >
                  ALLIANCES
                </a>
                <a
                  href="/corporations"
                  className="block px-3 py-2 -mx-3 font-semibold text-white text-base/7 hover:bg-white/5"
                >
                  CORPORATIONS
                </a>
                <a
                  href="/characters"
                  className="block px-3 py-2 -mx-3 font-semibold text-white text-base/7 hover:bg-white/5"
                >
                  CHARACTERS
                </a>
                <a
                  href="/leaderboards"
                  className="block px-3 py-2 -mx-3 font-semibold text-white text-base/7 hover:bg-white/5"
                >
                  LEADERBOARDS
                </a>
                <Disclosure as="div" className="-mx-3">
                  <DisclosureButton className="group flex w-full items-center justify-between py-2 pr-3.5 pl-3 text-base/7 font-semibold text-white hover:bg-white/5">
                    SOVEREIGNTY
                    <ChevronDownIcon
                      aria-hidden="true"
                      className="flex-none size-5 group-data-open:rotate-180"
                    />
                  </DisclosureButton>
                  <DisclosurePanel className="mt-2 space-y-2">
                    <DisclosureButton
                      as="a"
                      href="/sovereignty"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      OVERVIEW
                    </DisclosureButton>
                    <DisclosureButton
                      as="a"
                      href="/sovereignty/structures"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      STRUCTURES &amp; TIMERS
                    </DisclosureButton>
                    <DisclosureButton
                      as="a"
                      href="/sovereignty/history"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      HISTORY
                    </DisclosureButton>
                    <DisclosureButton
                      as="a"
                      href="/sovereignty/hotspots"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      HOT ZONES
                    </DisclosureButton>
                    <DisclosureButton
                      as="a"
                      href="/sovereignty/map"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      MAP
                    </DisclosureButton>
                  </DisclosurePanel>
                </Disclosure>
                <a
                  href="/workers"
                  className="block px-3 py-2 -mx-3 font-semibold text-white text-base/7 hover:bg-white/5"
                >
                  WORKERS
                </a>
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
