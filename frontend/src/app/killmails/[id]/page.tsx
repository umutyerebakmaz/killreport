"use client";

import AttackersCard from "@/components/AttackersCard";
import FitScreen from "@/components/FitScreen/FitScreen";
import KillmailSummaryCard from "@/components/KillmailItemsCard/KillmailItemsCard";
import { Loader } from "@/components/Loader/Loader";
import { useKillmailQuery } from "@/generated/graphql";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { use } from "react";

export default function KillmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, loading, error } = useKillmailQuery({
    variables: { id },
  });

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
  const attackers = km.attackers || [];
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
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: FitScreen (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Fit + Victim */}
          <div className="flex flex-col gap-6 p-6 fit-and-victim">
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
                    </div>
                  </div>
                  <FitScreen
                    shipType={victim?.shipType}
                    fitting={fitting as any}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Killmail Summary Card */}
          <KillmailSummaryCard
            victim={victim}
            fitting={fitting}
            isStructure={isStructure}
            destroyedValue={destroyedValue}
            droppedValue={droppedValue}
            totalValue={totalValue}
          />
        </div>

        {/* Right Column: Attackers (1/3 width) */}
        <div className="space-y-6 lg:col-span-1">
          <AttackersCard attackers={attackers} />
        </div>
      </div>
    </>
  );
}
