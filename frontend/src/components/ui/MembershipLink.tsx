import Link from 'next/link';
import type { ComponentPropsWithRef } from 'react';

import EveImage from '@/components/ui/EveImage';

type MembershipLinkProps = {
  kind: 'corporation' | 'alliance';
  entity: { id: number; name: string };
  /** 20 in the account menu, 32 on the wider victim card. */
  logoSize?: 20 | 32;
} & Omit<ComponentPropsWithRef<typeof Link>, 'href' | 'children' | 'className'>;

/**
 * A logo — 20px by default, fetched at 64 either way — and the name beside
 * it, linking to the entity's page. Drawn over a portrait's darkened bottom band,
 * in the account menu (UserMenu, which wraps it in CloseButton so the panel
 * shuts on the way) and on the killmail's victim card. Extra props, such as
 * CloseButton's onClick, pass through to the link.
 */
export default function MembershipLink({
  kind,
  entity,
  logoSize = 20,
  ...rest
}: MembershipLinkProps) {
  return (
    <Link
      href={`/${kind === 'corporation' ? 'corporations' : 'alliances'}/${entity.id}`}
      // The logo's alt text is the same name, so without this the link
      // would be announced twice over.
      aria-label={entity.name}
      className="flex items-center min-w-0 gap-2 text-sm text-gray-200 transition-colors hover:text-accent-link focus:outline-none focus-visible:text-accent-link"
      {...rest}
    >
      <EveImage
        kind={kind}
        id={entity.id}
        name={entity.name}
        size={logoSize}
        className="flex-none"
      />
      <span className="truncate">{entity.name}</span>
    </Link>
  );
}
