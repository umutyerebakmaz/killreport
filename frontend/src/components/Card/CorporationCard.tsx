import Tooltip from '@/components/Tooltip/Tooltip';
import { CorporationsQuery } from '@/generated/graphql';
import { BuildingOffice2Icon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type MouseEvent } from 'react';
import MemberDeltaBadge from '../MemberDeltaBadge/MemberDeltaBadge';
import TotalMemberBadge from '../TotalMemberBadge/TotalMemberBadge';
import EveImage from '../ui/EveImage';
import CardLogoBackdrop from './CardLogoBackdrop';

// Extract the Corporation type returned by useCorporationsQuery
type Corporation = CorporationsQuery['corporations']['items'][number];

type CorporationCardProps = {
  corporation: Corporation;
};

export default function CorporationCard({ corporation }: CorporationCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const router = useRouter();
  const href = `/corporations/${corporation.id}`;

  // The whole card opens the detail page. A link inside it — the name, or
  // another entity — keeps its own destination, so a click that landed on
  // one is left alone. Keyboard users reach the page through the name link.
  const openDetail = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('a')) return;
    router.push(href);
  };

  // Member deltas (weekly change)
  const memberDelta7d = corporation.metrics?.memberCountDelta7d ?? null;
  const memberGrowthRate7d =
    corporation.metrics?.memberCountGrowthRate7d ?? null;

  // Pick the delta colour (currently unused — see MemberDeltaBadge for the live
  // version of this same pattern; this Card is also bg-surface, where EVE's
  // red measures 3.93:1, accepted per the spec).
  const deltaColor =
    memberDelta7d && memberDelta7d >= 0 ? 'text-success' : 'text-red-400';

  // Tooltip content
  const tooltipContent =
    memberDelta7d !== null
      ? `Member Change (7 Days): ${
          memberDelta7d >= 0 ? '+' : ''
        }${memberDelta7d}${
          memberGrowthRate7d !== null
            ? ` (${
                memberGrowthRate7d >= 0 ? '+' : ''
              }${memberGrowthRate7d.toFixed(1)}%)`
            : ''
        }`
      : 'No data available';

  // Format the founding date
  const foundedDate = corporation.date_founded
    ? new Date(corporation.date_founded).toLocaleDateString('en-US', {
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
      <CardLogoBackdrop
        kind="corporation"
        id={corporation.id}
        name={corporation.name}
      />
      <div className="relative flex flex-col items-center gap-4 px-4 py-5 sm:p-6">
        <div className="relative w-32 h-32">
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-surface-inset/50">
              <div className="flex items-center justify-center w-full h-full">
                <BuildingOffice2Icon className="w-12 h-12 text-gray-700" />
              </div>
            </div>
          )}
          <EveImage
            kind="corporation"
            id={corporation.id}
            name={corporation.name}
            size={128}
            className={`transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
          />
        </div>

        {/* The name row and the alliance row as one group, so the card's
            gap-4 falls around the pair rather than between them. */}
        <div className="flex flex-col items-center w-full">
          {/* Name and ticker on one line, as on AllianceCard. A long name
              truncates; the ticker never does. */}
          <div className="flex items-center justify-center w-full min-w-0 gap-2">
            <Tooltip content="Show Corporation Info" className="min-w-0">
              <Link
                href={href}
                className="block text-base font-medium text-gray-200 truncate hover:text-accent-link"
                prefetch={false}
              >
                {corporation.name}
              </Link>
            </Tooltip>
            <Tooltip
              content="Corporation Ticker"
              position="top"
              className="flex-none"
            >
              <span className="text-base font-bold text-gray-200">
                [{corporation.ticker}]
              </span>
            </Tooltip>
          </div>

          {/* The alliance name in the standard text colour. The h-5 row stays
              when there is no alliance, so the cards keep one height. */}
          <div className="h-5 max-w-full">
            {corporation.alliance && (
              <Tooltip content="Show Alliance Info" position="top">
                <Link
                  href={`/alliances/${corporation.alliance.id}`}
                  className="flex items-center gap-2 text-gray-200 hover:text-accent-link"
                  prefetch={false}
                >
                  <span className="text-base line-clamp-1">
                    {corporation.alliance.name}
                  </span>
                </Link>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="card-metrics">
          {/* Member count */}
          <TotalMemberBadge count={corporation.member_count} />
          {/* Member delta 7d */}
          <MemberDeltaBadge
            memberDelta={memberDelta7d}
            memberGrowthRate={memberGrowthRate7d}
          />
        </div>

        <div className="date-founded-section">
          {/* Founded date */}
          <Tooltip content="Date Founded" position="top">
            <div className="text-xs text-ink-muted">{foundedDate}</div>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
