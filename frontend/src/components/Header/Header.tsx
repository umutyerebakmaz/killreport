"use client";

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
} from "@headlessui/react";
import {
  ChevronDownIcon,
  PhoneIcon,
  PlayCircleIcon,
} from "@heroicons/react/20/solid";
import {
  Bars3Icon,
  GlobeAltIcon,
  MapIcon,
  MapPinIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React, { useState } from "react";
import AuthButton from "../AuthButton/AuthButton";
import EveStatus from "../EveStatus/EveStatus";
import EveTime from "../EveTime/EveTime";
import Tooltip from "../Tooltip/Tooltip";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [status, setStatus] = useState<{ players?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sunucu durumu verisini çek
  React.useEffect(() => {
    fetch("https://esi.evetech.net/latest/status/?datasource=tranquility")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch server status");
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
    <header className="sticky top-0 z-50 bg-custom-dark-90 backdrop-blur-sm">
      <nav
        aria-label="Global"
        className="flex items-center justify-between p-6 mx-auto lg:px-8 xl:px-12 2xl:px-16 max-w-480"
      >
        <div className="flex lg:flex-1">
          <a href="/" className="-m-1.5 p-1.5">
            <span className="sr-only">KillReport</span>
            <span className="text-2xl font-semibold tracking-tight text-gray-200">
              KILLREPORT
            </span>
          </a>
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-400"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon aria-hidden="true" className="size-6" />
          </button>
        </div>
        <PopoverGroup className="hidden lg:flex lg:gap-x-12">
          <Popover className="relative">
            <PopoverButton className="flex items-center font-semibold text-white cursor-pointer gap-x-1">
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
                  <div className="flex items-center justify-center flex-none size-11 bg-gray-700/50 group-hover:bg-gray-700">
                    <GlobeAltIcon
                      aria-hidden="true"
                      className="text-gray-400 size-6 group-hover:text-cyan-400"
                    />
                  </div>
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
                  <div className="flex items-center justify-center flex-none size-11 bg-gray-700/50 group-hover:bg-gray-700">
                    <MapIcon
                      aria-hidden="true"
                      className="text-gray-400 size-6 group-hover:text-cyan-400"
                    />
                  </div>
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
                  <div className="flex items-center justify-center flex-none size-11 bg-gray-700/50 group-hover:bg-gray-700">
                    <MapPinIcon
                      aria-hidden="true"
                      className="text-gray-400 size-6 group-hover:text-cyan-400"
                    />
                  </div>
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
              <div className="grid grid-cols-2 divide-x divide-white/10 bg-gray-700/50">
                <a
                  href="/killmails"
                  className="flex items-center justify-center gap-x-2.5 p-3 text-base font-semibold text-white hover:bg-cyan-900/50"
                >
                  <PlayCircleIcon
                    aria-hidden="true"
                    className="flex-none text-gray-500 size-5"
                  />
                  Browse Killmails
                </a>
                <a
                  href="/stats"
                  className="flex items-center justify-center gap-x-2.5 p-3 text-base font-semibold text-white hover:bg-cyan-900/50"
                >
                  <PhoneIcon
                    aria-hidden="true"
                    className="flex-none text-gray-500 size-5"
                  />
                  View Statistics
                </a>
              </div>
            </PopoverPanel>
          </Popover>
          <a href="/killmails" className="font-semibold text-white">
            KILLMAILS
          </a>
          <a href="/alliances" className="font-semibold text-white">
            ALLIANCES
          </a>
          <a href="/corporations" className="font-semibold text-white">
            CORPORATIONS
          </a>
          <a href="/characters" className="font-semibold text-white">
            CHARACTERS
          </a>
          <a href="/workers" className="font-semibold text-white">
            WORKERS
          </a>
        </PopoverGroup>

        <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:items-center lg:gap-6">
          <div className="flex items-center gap-4">
            <Tooltip
              content={`Tranquility ${
                status?.players?.toLocaleString() ?? "-"
              } online players`}
              position="bottom"
            >
              <EveStatus players={status?.players} />
            </Tooltip>
            <Tooltip content="Current Eve Online ingame time" position="bottom">
              <EveTime />
            </Tooltip>
          </div>
          <AuthButton />
        </div>
      </nav>
      <Dialog
        open={mobileMenuOpen}
        onClose={setMobileMenuOpen}
        className="lg:hidden"
      >
        <div className="fixed inset-0 z-50" />
        <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full p-6 overflow-y-auto bg-gray-900 sm:max-w-sm sm:ring-1 sm:ring-gray-100/10">
          <div className="flex items-center justify-between">
            <a href="#" className="-m-1.5 p-1.5">
              <span className="sr-only">KILLREPORT</span>
              <span className="text-2xl font-semibold tracking-tight text-gray-200">
                KILLREPORT
              </span>
            </a>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="-m-2.5 rounded-md p-2.5 text-gray-400"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden="true" className="size-6" />
            </button>
          </div>
          <div className="flow-root mt-6">
            <div className="-my-6 divide-y divide-white/10">
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
                    <DisclosureButton
                      as="a"
                      href="/killmails"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      Browse Killmails
                    </DisclosureButton>
                    <DisclosureButton
                      as="a"
                      href="/stats"
                      className="block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5"
                    >
                      View Statistics
                    </DisclosureButton>
                  </DisclosurePanel>
                </Disclosure>
                <a
                  href="/killmails"
                  className="block px-3 py-2 -mx-3 font-semibold text-white text-base/7 hover:bg-white/5"
                >
                  KILLMAILS
                </a>
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
