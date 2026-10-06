import Tooltip from '@/components/Tooltip/Tooltip';
import { FactionsQuery } from '@/generated/graphql';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import SovSystemBadge from '../SovSystemBadge/SovSystemBadge';
import TotalCorporationBadge from '../TotalCorporationMember/TotalCorporationBadge';
import TotalMemberBadge from '../TotalMemberBadge/TotalMemberBadge';
import EveImage from '../ui/EveImage';
import CardLogoBackdrop from './CardLogoBackdrop';

type Faction = FactionsQuery['factions'][number];

type FactionCardProps = {
  faction: Faction;
};

export default function FactionCard({ faction }: FactionCardProps) {
  const router = useRouter();
  const href = `/factions/${faction.id}?tab=killmails`;

  // The whole card opens the detail page, as on AllianceCard and
  // CorporationCard. A click that landed on a link is left to the link.
  const openDetail = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('a')) return;
    router.push(href);
  };

  return (
    // The emblem blurred into glass under the whole card, and the Most
    // Valuable card's hover, as on AllianceCard and CorporationCard.
    <div
      className="relative overflow-hidden transition-colors duration-200 cursor-pointer card group hover:border-white/25"
      onClick={openDetail}
    >
      {/* Faction emblems are served from the corporation path; see TopFactionsCard. */}
      <CardLogoBackdrop
        kind="corporation"
        id={faction.id}
        name={faction.name}
      />
      <div className="relative px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          <EveImage
            kind="corporation"
            id={faction.id}
            name={faction.name}
            size={128}
          />
          <Tooltip content="Show Faction Info">
            <Link href={href} className="alliance-name" prefetch={false}>
              {faction.name}
            </Link>
          </Tooltip>

          <div className="card-metrics">
            <TotalCorporationBadge count={faction.memberCorporationCount} />
            <TotalMemberBadge count={faction.memberCharacterCount} />
            <SovSystemBadge count={faction.sovereigntySystemCount} />
          </div>
        </div>
      </div>
    </div>
  );
}
