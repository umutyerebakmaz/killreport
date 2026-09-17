'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

import { isNavActive } from '@/utils/navActive';

import { NAV_ITEM } from './NavPopover';

/**
 * A desktop nav link that holds its accent line open while its own section is
 * the one on screen.
 *
 * `aria-current="page"` is doing two jobs: it is what a screen reader reads out
 * on the item you are already on, and it is the hook globals.css styles. A
 * separate `isActive` class would be a second thing to keep in step with it.
 *
 * The link reads the pathname itself rather than taking it as a prop, so
 * Header stays a list of destinations and nothing has to thread route state
 * through it.
 */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      className={NAV_ITEM}
      aria-current={isNavActive(pathname, [href]) ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}
