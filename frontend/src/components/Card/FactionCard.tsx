import Tooltip from '@/components/Tooltip/Tooltip';
import Card from '@/components/ui/Card';
import { FactionsQuery } from '@/generated/graphql';
import Link from 'next/link';
import SovSystemBadge from '../SovSystemBadge/SovSystemBadge';
import TotalCorporationBadge from '../TotalCorporationMember/TotalCorporationBadge';
import TotalMemberBadge from '../TotalMemberBadge/TotalMemberBadge';
import EveImage from '../ui/EveImage';

type Faction = FactionsQuery['factions'][number];

type FactionCardProps = {
  faction: Faction;
};

export default function FactionCard({ faction }: FactionCardProps) {
  return (
    <Card>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Faction emblems are served from the corporation path; see TopFactionsCard. */}
          <EveImage
            kind="corporation"
            id={faction.id}
            name={faction.name}
            size={128}
          />
          <Tooltip content="Show Faction Info">
            <Link
              href={`/factions/${faction.id}?tab=killmails`}
              className="alliance-name"
              prefetch={false}
            >
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
    </Card>
  );
}
