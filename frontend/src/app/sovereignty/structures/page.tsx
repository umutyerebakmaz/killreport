"use client";

import Loader from "@/components/Loader";
import { AllianceLink } from "@/components/Sovereignty/AllianceLink";
import { useSovereigntyStructuresPageQuery } from "@/generated/graphql";
import { formatRelativeTime } from "@/utils/date";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

function TypeBadge({ typeName }: { typeName: string }) {
  const cls =
    typeName === "IHub"
      ? "text-orange-400 bg-orange-400/10 border-orange-400/20"
      : typeName === "TCU"
        ? "text-purple-400 bg-purple-400/10 border-purple-400/20"
        : "text-gray-400 bg-gray-400/10 border-gray-400/20";
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs font-semibold border ${cls}`}>
      {typeName}
    </span>
  );
}

/** Live countdown to a future timestamp, re-rendering every second. */
function TimerCountdown({ target }: { target?: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return <span className="text-gray-600">—</span>;
  return <span className="text-yellow-400">{formatRelativeTime(target, true)}</span>;
}

function SystemCell({
  id,
  name,
  regionName,
}: {
  id: number;
  name?: string | null;
  regionName?: string | null;
}) {
  return (
    <div>
      <Link
        href={`/solar-systems/${id}`}
        prefetch={false}
        className="text-cyan-400 hover:text-cyan-300"
      >
        {name ?? id}
      </Link>
      <div className="text-xs text-gray-500">{regionName ?? "—"}</div>
    </div>
  );
}

function StructuresContent() {
  const { data, loading, error } = useSovereigntyStructuresPageQuery();

  if (loading) return <Loader fullHeight size="lg" text="Loading structures..." />;
  if (error) return <div className="p-8 text-red-400">Error: {error.message}</div>;

  const timers = data?.sovereigntyUpcomingTimers ?? [];
  const structures = data?.sovereigntyStructures ?? [];

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold text-white">Structures &amp; Timers</h1>
        <Link href="/sovereignty" prefetch={false} className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Sovereignty Overview
        </Link>
      </div>
      <h2 className="mt-2 text-xl text-white">Sovereignty structures and upcoming vulnerability windows</h2>

      {/* Next 24h timers */}
      <section className="mt-8">
        <h3 className="text-xl font-semibold text-white">
          Next 24h Timers <span className="text-gray-500">({timers.length})</span>
        </h3>
        <div className="mt-4 overflow-x-auto border border-white/10">
          <table className="table">
            <thead className="bg-neutral-800">
              <tr>
                <th className="text-left th-cell">System</th>
                <th className="text-left th-cell">Type</th>
                <th className="text-left th-cell">Owner</th>
                <th className="text-right th-cell">Opens in</th>
                <th className="text-right th-cell">Occupancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {timers.map((s) => (
                <tr key={s.structureId} className="transition-colors bg-neutral-950 hover:bg-neutral-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <SystemCell id={s.solarSystemId} name={s.solarSystemName} regionName={s.regionName} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TypeBadge typeName={s.structureTypeName} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AllianceLink id={s.allianceId} name={s.allianceName} ticker={s.allianceTicker} />
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                    <TimerCountdown target={s.vulnerableStartTime} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">
                    {s.occupancyLevel != null ? s.occupancyLevel.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
              {timers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No vulnerability windows opening in the next 24 hours.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* All structures */}
      <section className="mt-10">
        <h3 className="text-xl font-semibold text-white">
          All Structures <span className="text-gray-500">({structures.length})</span>
        </h3>
        <div className="mt-4 overflow-x-auto border border-white/10">
          <table className="table">
            <thead className="bg-neutral-800">
              <tr>
                <th className="text-left th-cell">System</th>
                <th className="text-left th-cell">Type</th>
                <th className="text-left th-cell">Owner</th>
                <th className="text-right th-cell">Occupancy</th>
                <th className="text-left th-cell">Vulnerable Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {structures.map((s) => (
                <tr key={s.structureId} className="transition-colors bg-neutral-950 hover:bg-neutral-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <SystemCell id={s.solarSystemId} name={s.solarSystemName} regionName={s.regionName} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TypeBadge typeName={s.structureTypeName} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AllianceLink id={s.allianceId} name={s.allianceName} ticker={s.allianceTicker} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">
                    {s.occupancyLevel != null ? s.occupancyLevel.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                    {s.vulnerableStartTime
                      ? `${formatRelativeTime(s.vulnerableStartTime, true)}`
                      : "—"}
                  </td>
                </tr>
              ))}
              {structures.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No tracked structures yet. They appear once the structures worker runs.
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

export default function SovereigntyStructuresPage() {
  return (
    <Suspense fallback={<Loader fullHeight size="lg" text="Loading structures..." />}>
      <StructuresContent />
    </Suspense>
  );
}
