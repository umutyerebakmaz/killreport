"use client";

import SecurityStatus from "@/components/SecurityStatus/SecurityStatus";
import ShipTierBadge from "@/components/ShipTierBadge/ShipTierBadge";
import Tooltip from "@/components/Tooltip/Tooltip";
import { formatKillmailDate, formatKillmailDateTime } from "@/utils/date";
import { formatISK } from "@/utils/formatISK";
import { getShipTier } from "@/utils/shipTier";
import Link from "next/link";

export interface KillmailCardData {
  id: string;
  killmailTime: string;
  totalValue?: number | null;
  solo: boolean;
  npc: boolean;
  victim: {
    character?: { id: number; name: string } | null;
    corporation?: { id: number; name: string; ticker: string } | null;
    alliance?: { id: number; name: string; ticker: string } | null;
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
    securityStatus: number;
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

  return (
    <Link
      href={`/killmails/${km.id}`}
      className="block w-full transition-all duration-200 border bg-neutral-900 border-white/10 hover:bg-neutral-800 hover:border-white/5"
      prefetch={false}
    >
      <div className="p-4">
        {/* Header: Time, Value, Rank */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <Tooltip
              content={formatKillmailDateTime(km.killmailTime)}
              position="top"
            >
              <div className="text-sm text-gray-400">
                {formatKillmailDate(km.killmailTime)}
              </div>
            </Tooltip>
            {km.totalValue && (
              <div className="mt-1 text-xl font-bold text-yellow-400 tabular-nums">
                {formatISK(km.totalValue)}
              </div>
            )}
          </div>
          {rank !== undefined && (
            <div className="flex items-center justify-center">
              <span
                className={`text-lg font-black tabular-nums ${
                  rank === 1
                    ? "text-yellow-400"
                    : rank === 2
                      ? "text-gray-300"
                      : rank === 3
                        ? "text-amber-600"
                        : "text-gray-500"
                }`}
              >
                #{rank}
              </span>
            </div>
          )}
        </div>

        {/* Ship Section */}
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-white/5">
          {km.victim?.shipType && (
            <div className="relative shrink-0">
              {shipTier && (
                <div className="absolute top-0 left-0 z-10">
                  <ShipTierBadge tier={shipTier} />
                </div>
              )}
              <img
                src={`https://images.evetech.net/types/${km.victim.shipType.id}/render?size=128`}
                alt={km.victim.shipType.name || "Ship"}
                className="size-32"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (
                    target.src.includes("/render?") &&
                    km.victim?.shipType?.id
                  ) {
                    target.src = `https://images.evetech.net/types/${km.victim.shipType.id}/icon?size=128`;
                  }
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-orange-400 truncate">
              {km.victim?.shipType?.name || "Unknown Ship"}
            </div>
            {km.victim?.shipType?.group && (
              <div className="text-sm text-gray-500 truncate">
                {km.victim.shipType.group.name}
              </div>
            )}
            {km.victim?.damageTaken && (
              <div className="mt-1 text-sm text-red-400">
                {km.victim.damageTaken.toLocaleString()} damage
              </div>
            )}
          </div>
        </div>

        {/* System Section */}
        <div className="pb-3 mb-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            {km.solarSystem?.securityStatus !== null &&
              km.solarSystem?.securityStatus !== undefined && (
                <SecurityStatus
                  securityStatus={km.solarSystem.securityStatus}
                />
              )}
            <span className="font-medium text-orange-400 truncate">
              {km.solarSystem?.name || "Unknown"}
            </span>
          </div>
          {km.solarSystem?.constellation && (
            <div className="text-sm text-purple-500 truncate">
              {km.solarSystem.constellation.name}
            </div>
          )}
          {km.solarSystem?.constellation?.region && (
            <div className="text-sm text-blue-400 truncate">
              {km.solarSystem.constellation.region.name}
            </div>
          )}
        </div>

        {/* Victim Section */}
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
                "Logo"
              }
              className="shadow-md size-12 shrink-0"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            {km.victim?.character ? (
              <div className="font-medium text-gray-300 truncate">
                {km.victim.character.name}
              </div>
            ) : (
              <div className="text-gray-500">Unknown Pilot</div>
            )}
            {km.victim?.corporation && (
              <div className="text-sm text-gray-500 truncate">
                {km.victim.corporation.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
