import AttackerRow from "@/components/AttackersCard/AttackerRow";
import { KillmailQuery } from "@/generated/graphql";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useState } from "react";

interface AttackersCardProps {
  attackers: NonNullable<KillmailQuery["killmail"]>["attackers"];
  killmail: NonNullable<KillmailQuery["killmail"]>;
}

export default function AttackersCard({
  attackers,
  killmail,
}: AttackersCardProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedAlliances, setExpandedAlliances] = useState<Set<number>>(
    new Set(),
  );
  const initialCount = 10;

  // Calculate total damage from all attackers
  const totalDamage = attackers.reduce(
    (sum, attacker) => sum + attacker.damageDone,
    0,
  );

  // Find top damage amount to identify top damage attacker
  const topDamageAmount = Math.max(...attackers.map((a) => a.damageDone));

  // Sort attackers: Final Blow first, then by damage descending
  const sortedAttackers = [...attackers].sort((a, b) => {
    if (a.finalBlow && !b.finalBlow) return -1;
    if (!a.finalBlow && b.finalBlow) return 1;
    return b.damageDone - a.damageDone;
  });

  // Group attackers by alliance with nested corporations
  const allianceGroups: Record<
    number,
    {
      id: number;
      name: string;
      totalCount: number;
      corporations: Record<number, { id: number; name: string; count: number }>;
    }
  > = {};

  const independentCorps: Record<
    number,
    { id: number; name: string; count: number }
  > = {};

  sortedAttackers.forEach((attacker) => {
    const allianceId = attacker.alliance?.id;
    const allianceName = attacker.alliance?.name;
    const corporationId = attacker.corporation?.id;
    const corporationName = attacker.corporation?.name;

    if (allianceId && allianceName && corporationId && corporationName) {
      // Has alliance - group under alliance
      if (!allianceGroups[allianceId]) {
        allianceGroups[allianceId] = {
          id: allianceId,
          name: allianceName,
          totalCount: 0,
          corporations: {},
        };
      }
      allianceGroups[allianceId].totalCount += 1;

      if (!allianceGroups[allianceId].corporations[corporationId]) {
        allianceGroups[allianceId].corporations[corporationId] = {
          id: corporationId,
          name: corporationName,
          count: 0,
        };
      }
      allianceGroups[allianceId].corporations[corporationId].count += 1;
    } else if (corporationId && corporationName) {
      // No alliance - independent corporation
      if (!independentCorps[corporationId]) {
        independentCorps[corporationId] = {
          id: corporationId,
          name: corporationName,
          count: 0,
        };
      }
      independentCorps[corporationId].count += 1;
    }
  });

  // Convert to arrays and sort by count
  const allianceArray = Object.values(allianceGroups).sort(
    (a, b) => b.totalCount - a.totalCount,
  );
  const independentCorpsArray = Object.values(independentCorps).sort(
    (a, b) => b.count - a.count,
  );

  const toggleAlliance = (allianceId: number) => {
    setExpandedAlliances((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(allianceId)) {
        newSet.delete(allianceId);
      } else {
        newSet.add(allianceId);
      }
      return newSet;
    });
  };

  const displayedAttackers = showAll
    ? sortedAttackers
    : sortedAttackers.slice(0, initialCount);
  const remainingCount = sortedAttackers.length - initialCount;

  return (
    <div className="p-6 bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10">
      <div className="flex justify-end">
        <span className="px-2 py-0.5 text-xs font-medium text-gray-400  bg-white/5">
          {killmail.attackerCount} ATTACKERS
        </span>
      </div>

      {/* All Attackers */}
      <div className="mt-4 space-y-3">
        {displayedAttackers.map((attacker, index) => (
          <AttackerRow
            key={index}
            attacker={attacker}
            totalDamage={totalDamage}
            isFinalBlow={attacker.finalBlow}
            isTopDamage={
              attacker.damageDone === topDamageAmount && !attacker.finalBlow
            }
            killmail={killmail}
          />
        ))}
      </div>

      {/* Show More Button */}
      {remainingCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="flex items-center justify-center w-full gap-2 px-4 py-3 mt-3 font-medium text-gray-300 transition-all bg-white/5 hover:bg-white/10 inset-ring inset-ring-white/10 hover:inset-ring-white/20"
        >
          <ChevronDownIcon className="w-5 h-5" />
          <span>Show other {remainingCount} participants</span>
        </button>
      )}

      {/* Show Less Button */}
      {showAll && sortedAttackers.length > initialCount && (
        <button
          onClick={() => setShowAll(false)}
          className="flex items-center justify-center w-full gap-2 px-4 py-3 mt-3 font-medium text-gray-300 transition-all bg-white/5 hover:bg-white/10 inset-ring inset-ring-white/10 hover:inset-ring-white/20"
        >
          <ChevronUpIcon className="w-5 h-5" />
          <span>Show less</span>
        </button>
      )}

      {/* Involved Alliances and Corps */}
      {(allianceArray.length > 0 || independentCorpsArray.length > 0) && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-300">
            Involved Alliances and Corps
          </h3>
          <div className="space-y-1">
            {/* Alliances with nested corporations */}
            {allianceArray.map((alliance) => {
              const isExpanded = expandedAlliances.has(alliance.id);
              const corporationsArray = Object.values(
                alliance.corporations,
              ).sort((a, b) => b.count - a.count);

              return (
                <div key={`alliance-${alliance.id}`}>
                  {/* Alliance Row */}
                  <div
                    onClick={() => toggleAlliance(alliance.id)}
                    className="flex items-center gap-2 px-3 py-2 transition-all cursor-pointer hover:bg-white/10 inset-ring inset-ring-white/10 hover:inset-ring-white/20"
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                    )}
                    <img
                      src={`https://images.evetech.net/Alliance/${alliance.id}_64.png`}
                      alt={alliance.name}
                      width={24}
                      height={24}
                      className="shadow-sm"
                      loading="lazy"
                    />
                    <Link
                      href={`/alliances/${alliance.id}`}
                      className="flex-1 text-sm text-gray-300 hover:text-blue-400"
                      prefetch={false}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {alliance.name}
                    </Link>
                    <span className="px-2 py-0.5 text-xs font-medium text-gray-400">
                      {alliance.totalCount}
                    </span>
                  </div>

                  {/* Nested Corporations */}
                  {isExpanded && (
                    <div className="mt-1 ml-6 space-y-1">
                      {corporationsArray.map((corp) => (
                        <Link
                          key={`corp-${corp.id}`}
                          href={`/corporations/${corp.id}`}
                          className="flex items-center gap-2 px-3 py-1.5 transition-all hover:bg-white/10 inset-ring inset-ring-white/10 hover:inset-ring-white/20"
                          prefetch={false}
                        >
                          <img
                            src={`https://images.evetech.net/corporations/${corp.id}/logo?size=64`}
                            alt={corp.name}
                            width={20}
                            height={20}
                            className="shadow-sm"
                            loading="lazy"
                          />
                          <span className="flex-1 text-xs text-gray-400">
                            {corp.name}
                          </span>
                          <span className="px-1.5 py-0.5 text-xs font-medium text-gray-500">
                            {corp.count}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Independent Corporations (no alliance) */}
            {independentCorpsArray.map((corp) => (
              <Link
                key={`independent-corp-${corp.id}`}
                href={`/corporations/${corp.id}`}
                className="flex items-center gap-2 px-3 py-2 transition-all hover:bg-white/10 inset-ring inset-ring-white/10 hover:inset-ring-white/20"
                prefetch={false}
              >
                <div className="w-4" /> {/* Spacer for alignment */}
                <img
                  src={`https://images.evetech.net/corporations/${corp.id}/logo?size=64`}
                  alt={corp.name}
                  width={24}
                  height={24}
                  className="shadow-sm"
                  loading="lazy"
                />
                <span className="flex-1 text-sm text-gray-300">
                  {corp.name}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium text-gray-400">
                  {corp.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
