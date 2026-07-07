"use client";

import Loader from "@/components/Loader";
import { ConflictTreemap } from "@/components/Sovereignty/ConflictTreemap";
import { useConflictHotspotsQuery } from "@/generated/graphql";
import { formatISK } from "@/utils/formatISK";
import Link from "next/link";
import { Suspense } from "react";

function HotspotsContent() {
  const { data, loading, error } = useConflictHotspotsQuery();

  if (loading) return <Loader fullHeight size="lg" text="Loading hot zones..." />;
  if (error) return <div className="p-8 text-red-400">Error: {error.message}</div>;

  const hotspots = data?.conflictHotspots ?? [];

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold text-white">Conflict Hot Zones</h1>
        <Link href="/sovereignty" prefetch={false} className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Sovereignty Overview
        </Link>
      </div>
      <h2 className="mt-2 text-xl text-white">
        Null-sec regions ranked by sovereignty conflict intensity
      </h2>

      {/* Treemap */}
      <section className="mt-6">
        <ConflictTreemap hotspots={hotspots} />
        <p className="mt-2 text-xs text-gray-500">
          Rectangle size = intensity (active campaigns ×3 + war kills); redder = more war kills.
        </p>
      </section>

      {/* Ranked table */}
      <section className="mt-8">
        <div className="overflow-x-auto border border-white/10">
          <table className="table">
            <thead className="bg-neutral-800">
              <tr>
                <th className="text-left th-cell">Region</th>
                <th className="text-right th-cell">Active Campaigns</th>
                <th className="text-right th-cell">War Kills</th>
                <th className="text-right th-cell">ISK Destroyed</th>
                <th className="text-right th-cell">Intensity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {hotspots.map((h) => (
                <tr key={h.regionId} className="transition-colors bg-neutral-950 hover:bg-neutral-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/regions/${h.regionId}`}
                      prefetch={false}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      {h.regionName ?? `#${h.regionId}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">
                    {h.activeCampaigns}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {h.warKills > 0 ? (
                      <span className="text-red-400">{h.warKills}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {h.iskDestroyed > 0 ? (
                      <span className="text-red-400">{formatISK(h.iskDestroyed)}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-right text-white whitespace-nowrap">
                    {h.intensityScore}
                  </td>
                </tr>
              ))}
              {hotspots.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No active conflicts right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function SovereigntyHotspotsPage() {
  return (
    <Suspense fallback={<Loader fullHeight size="lg" text="Loading hot zones..." />}>
      <HotspotsContent />
    </Suspense>
  );
}
