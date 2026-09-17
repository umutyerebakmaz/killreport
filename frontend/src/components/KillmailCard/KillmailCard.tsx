'use client';

import SecurityStatus from '@/components/SecurityStatus/SecurityStatus';
import ShipTierBadge from '@/components/ShipTierBadge/ShipTierBadge';
import SolarSystemMap from '@/components/SolarSystemMap/SolarSystemMap';
import Tooltip from '@/components/Tooltip/Tooltip';
import { formatKillmailDate, formatKillmailDateTime } from '@/utils/date';
import { formatISK } from '@/utils/formatISK';
import { getShipTier } from '@/utils/shipTier';
import Link from 'next/link';
import EveImage from '../ui/EveImage';

export interface KillmailCardData {
  id: string;
  killmailTime: string;
  totalValue?: number | null;
  victim?: {
    character?: { id: number; name: string } | null;
    corporation?: { id: number; name: string } | null;
    alliance?: { id: number; name: string } | null;
    shipType?: {
      id: number;
      name: string;
      dogmaAttributes?: Array<{ attribute_id: number; value: number }> | null;
    } | null;
  } | null;
  solarSystem?: {
    id: number;
    name: string;
    securityStatus?: number | null;
    /** Carried only for the region hanging off it. */
    constellation?: {
      id: number;
      region?: {
        id: number;
        name: string;
      } | null;
    } | null;
  } | null;
  finalBlow?: {
    character?: { id: number; name: string } | null;
    corporation?: { id: number; name: string } | null;
    alliance?: { id: number; name: string } | null;
  } | null;
}

export interface KillmailCardProps {
  killmail: KillmailCardData;
  rank?: number;
}

export default function KillmailCard({
  killmail: km,
  rank,
}: KillmailCardProps) {
  const shipTier = getShipTier(km.victim?.shipType?.dogmaAttributes);
  const shipTypeId = km.victim?.shipType?.id;

  return (
    <Link
      href={`/killmails/${km.id}`}
      className="group relative block w-full overflow-hidden border aspect-square bg-surface border-white/10 transition-colors duration-200 hover:border-white/25"
      prefetch={false}
    >
      {shipTypeId && (
        <EveImage
          kind="ship"
          id={shipTypeId}
          name={km.victim?.shipType?.name || 'Ship'}
          fill
          className="absolute inset-0 object-cover transition-transform duration-300 size-full group-hover:scale-105"
          fallbackClassName="absolute inset-0 object-contain p-10 transition-transform duration-300 size-full group-hover:scale-105"
        />
      )}

      {/* Keeps the text legible over whatever the render happens to be. */}
      <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/70 to-transparent" />

      {shipTier && (
        <div className="absolute z-10 top-3 left-3 drop-shadow-lg">
          <ShipTierBadge tier={shipTier} className="size-10" />
        </div>
      )}
      {rank !== undefined && (
        <span className="absolute z-10 text-lg font-black text-white top-3 right-3 tabular-nums drop-shadow-lg">
          #{rank}
        </span>
      )}

      {/*
       * Every measurement here is bought from the render above it: the card is
       * 256px tall now, and each pixel this block takes is one the ship does
       * not get. p-3 over p-4, space-y-2 over space-y-3, and the two smaller
       * type steps below come to 68px — the difference between a sliver of
       * hull and something you can recognise.
       */}
      <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
        <div>
          <Tooltip
            content={formatKillmailDateTime(km.killmailTime)}
            position="top"
          >
            <div className="text-xs text-gray-300">
              {formatKillmailDate(km.killmailTime)}
            </div>
          </Tooltip>
          {km.totalValue && (
            <div className="text-lg font-bold text-isk tabular-nums">
              {formatISK(km.totalValue)}
            </div>
          )}
        </div>

        <div className="font-semibold text-orange-400 truncate">
          {km.victim?.shipType?.name || 'Unknown Ship'}
        </div>

        {/* System and region read as one place, so they share a line. The
            truncation sits on the span holding both: put it on each name and
            a long region would keep its full width while the system clipped. */}
        <div className="flex items-center gap-2 min-w-0">
          {km.solarSystem && (
            <SolarSystemMap
              systemId={km.solarSystem.id}
              systemName={km.solarSystem.name}
              size={20}
              className="shrink-0"
            />
          )}
          {km.solarSystem?.securityStatus !== null &&
            km.solarSystem?.securityStatus !== undefined && (
              <SecurityStatus securityStatus={km.solarSystem.securityStatus} />
            )}
          <span className="truncate">
            <span className="font-medium text-orange-400">
              {km.solarSystem?.name || 'Unknown'}
            </span>
            {km.solarSystem?.constellation?.region && (
              <>
                {/* The separator belongs to neither name, so it takes neither
                    colour. */}
                <span className="text-ink-muted">{' · '}</span>
                <span className="font-medium text-blue-400">
                  {km.solarSystem.constellation.region.name}
                </span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(km.victim?.alliance?.id || km.victim?.corporation?.id) && (
            <EveImage
              kind={km.victim.alliance?.id ? 'alliance' : 'corporation'}
              id={km.victim.alliance?.id ?? km.victim.corporation?.id ?? 0}
              name={
                km.victim.alliance?.name ||
                km.victim.corporation?.name ||
                'Logo'
              }
              size={40}
              className="size-10 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            {km.victim?.character ? (
              <div className="font-medium text-gray-200 truncate">
                {km.victim.character.name}
              </div>
            ) : (
              <div className="text-ink-muted">Unknown Pilot</div>
            )}
            {km.victim?.corporation && (
              <div className="text-sm text-ink-muted truncate">
                {km.victim.corporation.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
