"use client";

import AttackersCard from "@/components/AttackersCard";
import FitScreen from "@/components/FitScreen/FitScreen";
import KillmailSummaryCard from "@/components/KillmailItemsCard/KillmailItemsCard";
import { Loader } from "@/components/Loader/Loader";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useKillmailQuery } from "@/generated/graphql";
import { formatISK } from "@/utils/formatISK";
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { use, useState } from "react";

export default function KillmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [copied, setCopied] = useState(false);
  const { data, loading, error } = useKillmailQuery({
    variables: { id },
  });

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/killmails/${id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading killmail..." />;
  }

  if (error || !data?.killmail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-400">
          Error: {error?.message || "Killmail not found"}
        </div>
      </div>
    );
  }

  const km = data.killmail;
  const victim = km.victim;
  const attackers = km.attackers || []; // final blow, top damage ve +8 toplam 10 ilk yuklemede.
  const fitting = km.fitting;

  // Check if victim is a structure
  const isStructure = victim?.shipType?.group?.category?.name === "Structure";

  // Backend'den gelen değerleri kullan
  const totalValue = km.totalValue || 0;
  const destroyedValue = km.destroyedValue || 0;
  const droppedValue = km.droppedValue || 0;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3">
        {/* Left Column: FitScreen (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Fit + Victim */}
          <div
            className={
              isStructure
                ? "flex flex-col gap-6 px-6 pt-6 pb-24 fit-and-victim"
                : "flex flex-col gap-6 p-6 fit-and-victim"
            }
          >
            <div className="victim-card">
              {/* Grid container: FitScreen (1/2) + Summary (1/2) */}
              <div className="grid grid-cols-3 gap-6">
                {/* FitScreen - Left (2/3) */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2 pb-6">
                      <a
                        href={`https://zkillboard.com/kill/${km.id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-300 transition-colors rounded bg-gray-800/50 hover:bg-gray-700/50 hover:text-white"
                      >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        zKillboard
                      </a>
                      <a
                        href={`https://kb.evetools.org/kill/${km.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-300 transition-colors rounded bg-gray-800/50 hover:bg-gray-700/50 hover:text-white"
                      >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        EVE Tools
                      </a>
                      <a
                        href={`https://esi.evetech.net/killmails/${km.id}/${km.killmailHash}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-300 transition-colors rounded bg-gray-800/50 hover:bg-gray-700/50 hover:text-white"
                      >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        ESI Verified
                      </a>
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-gray-300 transition-colors rounded bg-gray-800/50 hover:bg-gray-700/50 hover:text-white"
                      >
                        {copied ? (
                          <>
                            <CheckIcon className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                            Share
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <FitScreen
                    shipType={victim?.shipType}
                    fitting={fitting as any}
                  />
                </div>

                {/* Killmail Summary Card - Right (1/3) */}
                <div>
                  <div className="space-y-3">
                    {/* Character, Corp, Alliance Images */}
                    {victim?.character?.id && (
                      <div className="flex items-start">
                        {/* Character Portrait */}
                        <Tooltip content="Show Victim Info" position="top">
                          <a href={`/characters/${victim.character?.id}`}>
                            <img
                              src={`https://images.evetech.net/characters/${victim.character?.id}/portrait?size=128`}
                              alt={victim.character?.name || "Character"}
                              width={96}
                              height={96}
                              className="shadow-md"
                              loading="lazy"
                            />
                          </a>
                        </Tooltip>

                        <div className="flex flex-col">
                          {/* Alliance Portrait */}
                          <a href={`/alliances/${victim.alliance?.id}`}>
                            <img
                              src={`https://images.evetech.net/corporations/${victim.corporation?.id}/logo?size=64`}
                              alt={victim.corporation?.name || "Corporation"}
                              width={48}
                              height={48}
                              className="shadow-sm"
                              loading="lazy"
                            />
                          </a>
                          <a href={`/corporations/${victim.corporation?.id}`}>
                            {/* Corporation Portrait */}
                            <img
                              src={`https://images.evetech.net/alliances/${victim.alliance?.id}/logo?size=64`}
                              alt={victim.alliance?.name || "Alliance"}
                              width={48}
                              height={48}
                              className="shadow-sm"
                              loading="lazy"
                            />
                          </a>
                        </div>

                        <div className="flex flex-col items-start justify-start pl-4">
                          <Tooltip content="Show Victim Info" position="top">
                            <a
                              href={`/characters/${victim.character?.id}`}
                              className="text-gray-400 transition-colors hover:text-blue-400"
                            >
                              {victim.character?.name}
                            </a>
                          </Tooltip>

                          <Tooltip
                            content="Show Corporation Info"
                            position="top"
                          >
                            <a
                              href={`/corporations/${victim.corporation?.id}`}
                              className="text-gray-400 transition-colors hover:text-blue-400"
                            >
                              {victim.corporation?.name}
                            </a>
                          </Tooltip>

                          <Tooltip content="Show Alliance Info" position="top">
                            <a
                              href={`/alliances/${victim.alliance?.id}`}
                              className="text-gray-400 transition-colors hover:text-blue-400"
                            >
                              {victim.alliance?.name}
                            </a>
                          </Tooltip>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-400">Ship</span>
                      <span className="text-right">
                        <span className="text-gray-400">
                          {victim?.shipType?.name}
                        </span>
                        {victim?.shipType?.group && (
                          <span className="text-gray-500">
                            {" "}
                            ({victim.shipType.group.name})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">System</span>
                      <span className="text-right">
                        <span className="text-gray-400">
                          {km.solarSystem?.name}
                        </span>
                        {km.solarSystem?.security_status !== undefined &&
                          km.solarSystem.security_status !== null && (
                            <span
                              className={
                                km.solarSystem.security_status >= 0.5
                                  ? "text-green-400"
                                  : km.solarSystem.security_status > 0
                                    ? "text-yellow-400"
                                    : "text-red-400"
                              }
                            >
                              {" "}
                              ({km.solarSystem.security_status.toFixed(1)})
                            </span>
                          )}
                        {km.solarSystem?.constellation?.region && (
                          <span className="text-gray-500">
                            {" "}
                            / {km.solarSystem.constellation.region.name}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Time</span>
                      <span className="text-gray-400">
                        {new Date(km.killmailTime).toLocaleString("en-US", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Damage</span>
                      <span className="text-red-400 tabular-nums">
                        {victim?.damageTaken?.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Destroyed</span>
                        <span className="text-red-400 tabular-nums">
                          {formatISK(destroyedValue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Dropped</span>
                        <span className="text-green-400 tabular-nums">
                          {formatISK(droppedValue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total</span>
                        <span className="font-bold text-yellow-400 tabular-nums">
                          {formatISK(totalValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Attackers (1/3 width) */}
        <div className="space-y-6 lg:col-span-1">
          <AttackersCard attackers={attackers} killmail={km} />
        </div>

        {/* Killmail Summary Card */}
        <div className="lg:col-span-2">
          <KillmailSummaryCard
            victim={victim}
            fitting={fitting}
            isStructure={isStructure}
            destroyedValue={destroyedValue}
            droppedValue={droppedValue}
            totalValue={totalValue}
          />
        </div>
      </div>
    </>
  );
}
