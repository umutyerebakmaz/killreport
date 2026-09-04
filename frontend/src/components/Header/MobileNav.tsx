'use client';

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { ReactNode } from 'react';

const MOBILE_NAV_LINK =
  'block px-3 py-2 -mx-3 font-semibold text-white text-base/7 hover:bg-white/5';
const MOBILE_NAV_SUB_LINK =
  'block py-2 pl-6 pr-3 font-semibold text-white text-sm/7 hover:bg-white/5';
const MOBILE_NAV_DISCLOSURE_BUTTON =
  'group flex w-full items-center justify-between py-2 pr-3.5 pl-3 text-base/7 font-semibold text-white hover:bg-white/5';

// Sliding the rows rather than animating height: a height transition needs a
// grid-rows trick to get away from a hardcoded max-height, and the drawer does
// not earn that.
const MOBILE_NAV_DISCLOSURE_PANEL =
  'mt-2 space-y-2 origin-top transition duration-200 ease-out data-closed:-translate-y-2 data-closed:opacity-0';

const CHEVRON =
  'flex-none size-5 transition-transform duration-200 group-data-open:rotate-180';

/**
 * A drawer link. `onNavigate` closes the drawer: navigation is client-side, so
 * without it the drawer would stay open over the page that was just opened —
 * the full page reload used to take it away.
 */
export function MobileNavLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link href={href} onClick={onNavigate} className={MOBILE_NAV_LINK}>
      {children}
    </Link>
  );
}

/** A collapsible group of drawer links, with a chevron that eases round. */
export function MobileNavDisclosure({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Disclosure as="div" className="-mx-3">
      <DisclosureButton className={MOBILE_NAV_DISCLOSURE_BUTTON}>
        {label}
        <ChevronDownIcon aria-hidden="true" className={CHEVRON} />
      </DisclosureButton>
      <DisclosurePanel transition className={MOBILE_NAV_DISCLOSURE_PANEL}>
        {children}
      </DisclosurePanel>
    </Disclosure>
  );
}

/**
 * One link inside a `MobileNavDisclosure`. `CloseButton` is no use here — it
 * closes the nearest closable ancestor, which is the disclosure rather than
 * the drawer around it, so the drawer is closed explicitly.
 */
export function MobileNavSubLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <DisclosureButton
      as={Link}
      href={href}
      onClick={onNavigate}
      className={MOBILE_NAV_SUB_LINK}
    >
      {children}
    </DisclosureButton>
  );
}
