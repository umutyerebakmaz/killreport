import Tooltip from '@/components/Tooltip/Tooltip';
import { AlliancesQuery } from '@/generated/graphql';
import { UsersIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type MouseEvent } from 'react';
import MemberDeltaBadge from '../MemberDeltaBadge/MemberDeltaBadge';
import SovSystemBadge from '../SovSystemBadge/SovSystemBadge';
import TotalCorporationBadge from '../TotalCorporationMember/TotalCorporationBadge';
import TotalMemberBadge from '../TotalMemberBadge/TotalMemberBadge';
import EveImage from '../ui/EveImage';
import CardLogoBackdrop from './CardLogoBackdrop';

// Extract the Alliance type returned by useAlliancesQuery
type Alliance = AlliancesQuery['alliances']['items'][number];

type AllianceCardProps = {
  alliance: Alliance;
};

export default function AllianceCard({ alliance }: AllianceCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const router = useRouter();
  const href = `/alliances/${alliance.id}?tab=killmails`;

  // The whole card opens the detail page. A link inside it — the name, or
  // another entity — keeps its own destination, so a click that landed on
  // one is left alone. Keyboard users reach the page through the name link.
  const openDetail = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('a')) return;
    router.push(href);
  };

  // Member deltas (weekly change)
  const memberDelta7d = alliance.metrics?.memberCountDelta7d ?? null;
  const memberGrowthRate7d = alliance.metrics?.memberCountGrowthRate7d ?? null;
  // Format the founding date
  const foundedDate = alliance.date_founded
    ? new Date(alliance.date_founded).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    // FactionCard's layout: one card surface under everything, the metrics
    // and the founding date set off by their own top borders, over the
    // entity's own logo blurred into glass. The div is .card rather than
    // <Card> because it takes the click.
    <div
      className="relative overflow-hidden transition-colors duration-200 cursor-pointer card group hover:border-white/25"
      onClick={openDetail}
    >
      <CardLogoBackdrop kind="alliance" id={alliance.id} name={alliance.name} />
      <div className="relative flex flex-col items-center gap-4 px-4 py-5 sm:p-6">
        <div className="relative w-32 h-32">
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-surface-inset/50">
              <div className="flex items-center justify-center w-full h-full">
                <UsersIcon className="w-12 h-12 text-gray-700" />
              </div>
            </div>
          )}
          <EveImage
            kind="alliance"
            id={alliance.id}
            name={alliance.name}
            size={128}
            className={`transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        </div>
        {/* Name and ticker on one line. A long name truncates; the ticker
            never does. Not .alliance-name: it centres two lines in a fixed
            h-12 box, and globals.css is unlayered, so a utility cannot
            override it. */}
        <div className="flex items-center justify-center w-full min-w-0 gap-2">
          <Tooltip content="Show Alliance Info" className="min-w-0">
            <Link
              href={href}
              className="block text-base font-medium text-gray-200 truncate hover:text-accent-link"
              prefetch={false}
            >
              {alliance.name}
            </Link>
          </Tooltip>
          <Tooltip
            content="Alliance Ticker"
            position="top"
            className="flex-none"
          >
            <span className="text-base font-bold text-gray-200">
              [{alliance.ticker}]
            </span>
          </Tooltip>
        </div>

        <div className="card-metrics">
          {/*  member count */}
          <TotalMemberBadge count={alliance.memberCount} />
          {/* corporation count */}
          <TotalCorporationBadge count={alliance.corporationCount} />
          {/* member delta 7d */}
          <MemberDeltaBadge
            memberDelta={memberDelta7d}
            memberGrowthRate={memberGrowthRate7d}
          />
          {/* sovereignty systems */}
          <SovSystemBadge count={alliance.sovereigntySystemCount} />
        </div>

        {/* Founded date section */}
        <div className="date-founded-section">
          <Tooltip content="Date Founded" position="top">
            <div className="text-xs text-ink-muted">{foundedDate}</div>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
