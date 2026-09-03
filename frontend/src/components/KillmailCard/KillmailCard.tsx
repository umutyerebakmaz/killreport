'use client';

import SecurityStatus from '@/components/SecurityStatus/SecurityStatus';
import ShipTierBadge from '@/components/ShipTierBadge/ShipTierBadge';
import Tooltip from '@/components/Tooltip/Tooltip';
import { formatKillmailDate, formatKillmailDateTime } from '@/utils/date';
import { formatISK } from '@/utils/formatISK';
import { getShipTier } from '@/utils/shipTier';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Renders are square and the card is portrait, so `object-cover` scales to the
 * height and crops the sides. 512 is enough for a 420px-tall card; 1024 exists
 * but costs two and a half times the bytes for a shelf of twenty.
 */
const RENDER_SIZE = 512;
const ICON_SIZE = 128;

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
      group?: { name: string } | null;
      dogmaAttributes?: Array<{ attribute_id: number; value: number }> | null;
    } | null;
    damageTaken?: number | null;
  } | null;
  solarSystem?: {
    id: number;
    name: string;
    securityStatus?: number | null;
    constellation?: {
      id: number;
      name: string;
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

  // A type without a render falls back to its icon, which is transparent and
  // small — stretching that across the card looks broken, so the fallback is
  // centred at its own size instead of covering.
  const [usingIcon, setUsingIcon] = useState(false);

  return (
    <Link
      href={`/killmails/${km.id}`}
      className="group relative block h-[420px] w-full overflow-hidden border bg-neutral-900 border-white/10 transition-colors duration-200 hover:border-white/25"
      prefetch={false}
    >
      {shipTypeId && (
        <img
          src={`https://images.evetech.net/types/${shipTypeId}/${
            usingIcon ? `icon?size=${ICON_SIZE}` : `render?size=${RENDER_SIZE}`
          }`}
          alt={km.victim?.shipType?.name || 'Ship'}
          className={`absolute inset-0 size-full transition-transform duration-300 group-hover:scale-105 ${
            usingIcon ? 'object-contain p-10' : 'object-cover'
          }`}
          loading="lazy"
          onError={() => setUsingIcon(true)}
        />
      )}

      {/* Keeps the text legible over whatever the render happens to be. */}
      <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/70 to-transparent" />

      {shipTier && (
        <div className="absolute z-10 top-3 left-3 drop-shadow-lg">
          <ShipTierBadge tier={shipTier} />
        </div>
      )}
      {rank !== undefined && (
        <span className="absolute z-10 text-lg font-black text-white top-3 right-3 tabular-nums drop-shadow-lg">
          #{rank}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-4 space-y-3">
        <div>
          <Tooltip
            content={formatKillmailDateTime(km.killmailTime)}
            position="top"
          >
            <div className="text-sm text-gray-300">
              {formatKillmailDate(km.killmailTime)}
            </div>
          </Tooltip>
          {km.totalValue && (
            <div className="mt-1 text-xl font-bold text-yellow-400 tabular-nums">
              {formatISK(km.totalValue)}
            </div>
          )}
        </div>

        <div>
          <div className="font-semibold text-orange-400 truncate">
            {km.victim?.shipType?.name || 'Unknown Ship'}
          </div>
          {km.victim?.shipType?.group && (
            <div className="text-sm text-gray-400 truncate">
              {km.victim.shipType.group.name}
            </div>
          )}
          {km.victim?.damageTaken && (
            <div className="mt-1 text-sm text-red-400">
              {km.victim.damageTaken.toLocaleString()} damage
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            {km.solarSystem?.securityStatus !== null &&
              km.solarSystem?.securityStatus !== undefined && (
                <SecurityStatus
                  securityStatus={km.solarSystem.securityStatus}
                />
              )}
            <span className="font-medium text-orange-400 truncate">
              {km.solarSystem?.name || 'Unknown'}
            </span>
          </div>
          {km.solarSystem?.constellation && (
            <div className="text-sm text-purple-400 truncate">
              {km.solarSystem.constellation.name}
            </div>
          )}
          {km.solarSystem?.constellation?.region && (
            <div className="text-sm text-blue-400 truncate">
              {km.solarSystem.constellation.region.name}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {(km.victim?.alliance?.id || km.victim?.corporation?.id) && (
            <img
              src={
                km.victim.alliance?.id
                  ? `https://images.evetech.net/alliances/${km.victim.alliance.id}/logo?size=64`
                  : `https://images.evetech.net/corporations/${km.victim.corporation?.id}/logo?size=64`
              }
              alt={
                km.victim.alliance?.name ||
                km.victim.corporation?.name ||
                'Logo'
              }
              className="shadow-md size-12 shrink-0"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            {km.victim?.character ? (
              <div className="font-medium text-gray-200 truncate">
                {km.victim.character.name}
              </div>
            ) : (
              <div className="text-gray-400">Unknown Pilot</div>
            )}
            {km.victim?.corporation && (
              <div className="text-sm text-gray-400 truncate">
                {km.victim.corporation.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
