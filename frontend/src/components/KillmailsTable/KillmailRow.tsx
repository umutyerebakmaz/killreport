"use client";

import SecurityStatus from "@/components/SecurityStatus/SecurityStatus";
import Tooltip from "@/components/Tooltip/Tooltip";
import { formatISK } from "@/utils/formatISK";
import Link from "next/link";
import { KillmailRowProps } from "./types";

export default function KillmailRow({
  killmail: km,
  isAnimating = false,
  characterId,
  corporationId,
  allianceId,
}: KillmailRowProps) {
  // Determine totalValue color based on character, corporation, or alliance involvement
  const totalValueColor = characterId
    ? km.victim?.character?.id === characterId
      ? "text-red-500" // Character is victim (loss)
      : "text-green-500" // Character is attacker (kill)
    : corporationId
      ? km.victim?.corporation?.id === corporationId
        ? "text-red-500" // Corporation is victim (loss)
        : "text-green-500" // Corporation is attacker (kill)
      : allianceId
        ? km.victim?.alliance?.id === allianceId
          ? "text-red-500" // Alliance is victim (loss)
          : "text-green-500" // Alliance is attacker (kill)
        : "text-orange-400"; // Default color when no characterId, corporationId, or allianceId
  return (
    <tr
      className={`transition-colors hover:bg-white/5 ${
        isAnimating ? "animate-slide-in-row" : ""
      }`}
      style={isAnimating ? { display: "table-row" } : undefined}
    >
      {/* Time & Value Column */}
      <td className="px-6 py-4 text-base align-top">
        <Tooltip
          content={`${new Date(km.killmailTime).toLocaleDateString("en-US", {
            timeZone: "UTC",
            year: "numeric",
            month: "long",
            day: "numeric",
          })} ${new Date(km.killmailTime).toLocaleTimeString("en-US", {
            timeZone: "UTC",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })} UTC`}
          position="top"
        >
          <div className="text-gray-400">
            {new Date(km.killmailTime).toLocaleTimeString("en-US", {
              timeZone: "UTC",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
          </div>
          {km.totalValue && (
            <div className={`font-medium tabular-nums ${totalValueColor}`}>
              {formatISK(km.totalValue)}
            </div>
          )}
        </Tooltip>
      </td>

      {/* Ship Column */}
      <td className="px-6 py-4 text-base align-top">
        <div className="flex items-start gap-3">
          {km.victim?.shipType && (
            <Tooltip content="View Killmail Details" position="top">
              <Link
                href={`/killmails/${km.id}`}
                className="relative block shrink-0"
                prefetch={false}
              >
                <img
                  src={`https://images.evetech.net/types/${km.victim.shipType?.id}/render?size=128`}
                  alt={km.victim?.shipType?.name || "Ship"}
                  className="transition-opacity border border-white/10 size-20 hover:opacity-80"
                  loading="lazy"
                />
                <div className="absolute w-3 h-3 bg-red-500 rounded-full -top-1 -right-1 animate-pulse" />
              </Link>
            </Tooltip>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-orange-400">
              {km.victim?.shipType?.name || "Unknown Ship"}
            </div>
            {km.victim?.shipType?.group && (
              <div className="text-base text-gray-500">
                {km.victim.shipType.group.name}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Victim Column */}
      <td className="px-6 py-4 text-base align-top">
        <div className="flex items-center gap-3">
          {/* Alliance logo if exists, otherwise corporation logo */}
          {(km.victim?.alliance?.id || km.victim?.corporation?.id) && (
            <img
              src={
                km.victim.alliance?.id
                  ? `https://images.evetech.net/alliances/${km.victim.alliance.id}/logo?size=128`
                  : `https://images.evetech.net/corporations/${km.victim?.corporation?.id}/logo?size=128`
              }
              alt={
                km.victim.alliance?.name ||
                km.victim?.corporation?.name ||
                "Logo"
              }
              className="size-20"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="font-medium text-red-500">
              {km.victim?.character ? (
                <Tooltip content="Show Character Info" position="top">
                  <Link
                    href={`/characters/${km.victim.character.id}`}
                    className="transition-colors hover:text-red-400"
                    prefetch={false}
                  >
                    {km.victim.character.name}
                  </Link>
                </Tooltip>
              ) : (
                "Unknown"
              )}
            </div>
            {km.victim?.corporation && (
              <div className="text-base text-gray-400">
                <Tooltip content="Show Corporation Info" position="top">
                  <Link
                    href={`/corporations/${km.victim.corporation?.id}`}
                    className="transition-colors hover:text-cyan-400"
                    prefetch={false}
                  >
                    {km.victim.corporation?.name}
                  </Link>
                </Tooltip>
              </div>
            )}
            {km.victim?.alliance && (
              <div className="text-base text-gray-500">
                <Tooltip content="Show Alliance Info" position="top">
                  <Link
                    href={`/alliances/${km.victim.alliance.id}`}
                    className="transition-colors hover:text-cyan-400"
                    prefetch={false}
                  >
                    {km.victim.alliance.name}
                  </Link>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Final Blow Column */}
      <td className="px-6 py-4 text-base align-top">
        {km.finalBlow && (
          <div className="flex items-center gap-3">
            {/* Alliance logo if exists, otherwise corporation logo */}
            {(km.finalBlow.alliance?.id || km.finalBlow.corporation?.id) && (
              <img
                src={
                  km.finalBlow.alliance?.id
                    ? `https://images.evetech.net/alliances/${km.finalBlow.alliance.id}/logo?size=128`
                    : `https://images.evetech.net/corporations/${km.finalBlow.corporation?.id}/logo?size=128`
                }
                alt={
                  km.finalBlow.alliance?.name ||
                  km.finalBlow.corporation?.name ||
                  "Logo"
                }
                className="size-20"
                loading="lazy"
              />
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="font-medium text-green-400">
                {km.finalBlow.character ? (
                  <Tooltip content="Show Character Info" position="top">
                    <Link
                      href={`/characters/${km.finalBlow.character.id}`}
                      className="transition-colors hover:text-green-300"
                      prefetch={false}
                    >
                      {km.finalBlow.character.name}
                    </Link>
                  </Tooltip>
                ) : (
                  "Unknown"
                )}
              </div>
              {km.finalBlow.corporation && (
                <div className="text-base text-gray-400">
                  <Tooltip content="Show Corporation Info" position="top">
                    <Link
                      href={`/corporations/${km.finalBlow.corporation.id}`}
                      className="transition-colors hover:text-cyan-400"
                      prefetch={false}
                    >
                      {km.finalBlow.corporation.name}
                    </Link>
                  </Tooltip>
                </div>
              )}
              {km.finalBlow.alliance && (
                <div className="text-base text-gray-500">
                  <Tooltip content="Show Alliance Info" position="top">
                    <Link
                      href={`/alliances/${km.finalBlow.alliance.id}`}
                      className="transition-colors hover:text-cyan-400"
                      prefetch={false}
                    >
                      {km.finalBlow.alliance.name}
                    </Link>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        )}
      </td>

      {/* System Column */}
      <td className="px-6 py-4 text-base align-top">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tooltip content="Show Solar System Info" position="top">
              <Link
                href={`/solar-systems/${km.solarSystem?.id}`}
                className="font-medium text-orange-400 transition-colors hover:text-orange-500"
                prefetch={false}
              >
                {km.solarSystem?.name || "Unknown"}
              </Link>
            </Tooltip>
            {km.solarSystem?.security_status !== null &&
              km.solarSystem?.security_status !== undefined && (
                <SecurityStatus
                  securityStatus={km.solarSystem.security_status}
                />
              )}
          </div>
          {km.solarSystem?.constellation && (
            <div className="text-base text-purple-500">
              <Tooltip content="Show Constellation Info" position="top">
                <Link
                  href={`/constellations/${km.solarSystem.constellation?.id}`}
                  className="transition-colors hover:text-purple-400"
                  prefetch={false}
                >
                  {km.solarSystem.constellation.name}
                </Link>
              </Tooltip>
            </div>
          )}
          {km.solarSystem?.constellation?.region && (
            <div className="text-base text-cyan-400">
              <Tooltip content="Show Region Info" position="top">
                <Link
                  href={`/regions/${km.solarSystem.constellation.region.id}`}
                  className="transition-colors hover:text-cyan-300"
                  prefetch={false}
                >
                  {km.solarSystem.constellation.region.name}
                </Link>
              </Tooltip>
            </div>
          )}
        </div>
      </td>

      {/* Attackers Column */}
      <td className="px-6 py-4 text-base align-top">
        <span className="font-medium text-purple-400">{km.attackerCount}</span>
      </td>

      {/* Damage Column */}
      <td className="px-6 py-4 text-base align-top">
        <span className="font-medium text-red-400">
          {km.victim?.damageTaken?.toLocaleString() || 0}
        </span>
      </td>
    </tr>
  );
}
