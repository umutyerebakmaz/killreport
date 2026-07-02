"use client";

import Loader from "@/components/Loader";
import { useSovereigntyDashboardQuery } from "@/generated/graphql";
import { formatTimeAgo } from "@/utils/date";
import { formatISK } from "@/utils/formatISK";
import Link from "next/link";
import { Suspense } from "react";

const EVENT_LABELS: Record<string, string> = {
  tcu_defense: "TCU Defense",
  ihub_defense: "IHub Defense",
  station_defense: "Station Defense",
  station_freeport: "Station Freeport",
};

const CHANGE_STYLES: Record<string, string> = {
  captured: "text-green-400",
  lost: "text-red-400",
  transferred: "text-yellow-400",
  faction_change: "text-gray-400",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 border border-white/10 bg-neutral-900">
      <div className="text-2xl font-semibold text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-sm text-gray-400">{label}</div>
    </div>
  );
}

function AllianceLink({
  id,
  name,
  ticker,
}: {
  id?: number | null;
  name?: string | null;
  ticker?: string | null;
}) {
  if (!id) return <span className="text-gray-500">Unknown</span>;
  return (
    <span>
      <Link
        href={`/alliances/${id}`}
        prefetch={false}
        className="text-cyan-400 hover:text-cyan-300"
      >
        {name ?? `#${id}`}
      </Link>
      {ticker && <span className="ml-2 text-sm text-yellow-400">[{ticker}]</span>}
    </span>
  );
}

function ScoreBar({
  defender,
  attackers,
}: {
  defender?: number | null;
  attackers?: number | null;
}) {
  const d = defender ?? 0;
  const a = attackers ?? 0;
  const total = d + a || 1;
  const dPct = Math.round((d / total) * 100);
  return (
    <div className="w-40">
      <div className="flex h-2 overflow-hidden rounded bg-neutral-800">
        <div className="bg-cyan-500" style={{ width: `${dPct}%` }} />
        <div className="bg-red-500" style={{ width: `${100 - dPct}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-xs">
        <span className="text-cyan-400">{Math.round(d * 100)}% def</span>
        <span className="text-red-400">{Math.round(a * 100)}% atk</span>
      </div>
    </div>
  );
}

function SovereigntyContent() {
  const { data, loading, error } = useSovereigntyDashboardQuery();

  if (loading) return <Loader fullHeight size="lg" text="Loading sovereignty data..." />;
  if (error) return <div className="p-8 text-red-400">Error: {error.message}</div>;

  const overview = data?.sovereigntyOverview;
  const rankings = data?.allianceTerritoryRankings ?? [];
  const campaigns = data?.sovereigntyActiveCampaigns ?? [];
  const changes = data?.recentTerritoryChanges ?? [];

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <h1 className="text-3xl font-semibold text-white">Sovereignty</h1>
      <h2 className="mt-2 text-xl text-white">Null-sec territory control &amp; active wars across New Eden</h2>

      {/* Overview */}
      {overview && (
        <div className="grid grid-cols-2 gap-4 mt-6 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Owned systems" value={overview.ownedSystems} />
          <StatCard label="Active campaigns" value={overview.activeCampaigns} />
          <StatCard label="Tracked structures" value={overview.trackedStructures} />
          <StatCard label="Alliances holding sov" value={overview.trackedAlliances} />
          <StatCard label="War kills" value={overview.warKills} />
          <StatCard label="ISK destroyed" value={formatISK(overview.iskDestroyed)} />
        </div>
      )}

      {/* Alliance territory rankings */}
      <section className="mt-10">
        <h3 className="text-xl font-semibold text-white">Alliance Territory Rankings</h3>
        <div className="mt-4 overflow-x-auto border border-white/10">
          <table className="table">
            <thead className="bg-neutral-800">
              <tr>
                <th className="text-left th-cell">#</th>
                <th className="text-left th-cell">Alliance</th>
                <th className="text-right th-cell">Systems</th>
                <th className="text-right th-cell">IHubs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rankings.map((r) => (
                <tr key={r.allianceId} className="transition-colors bg-neutral-950 hover:bg-neutral-900">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.rank}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AllianceLink id={r.allianceId} name={r.allianceName} ticker={r.allianceTicker} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-right text-white whitespace-nowrap">
                    {r.systemsControlled.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">{r.ihubCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active campaigns */}
      <section className="mt-10">
        <h3 className="text-xl font-semibold text-white">
          Active Campaigns <span className="text-gray-500">({campaigns.length})</span>
        </h3>
        <div className="mt-4 overflow-x-auto border border-white/10">
          <table className="table">
            <thead className="bg-neutral-800">
              <tr>
                <th className="text-left th-cell">System</th>
                <th className="text-left th-cell">Region</th>
                <th className="text-left th-cell">Type</th>
                <th className="text-left th-cell">Defender</th>
                <th className="text-left th-cell">Progress</th>
                <th className="text-right th-cell">Kills</th>
                <th className="text-right th-cell">ISK Lost</th>
                <th className="text-right th-cell">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaigns.map((c) => (
                <tr key={c.campaignId} className="transition-colors bg-neutral-950 hover:bg-neutral-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/solar-systems/${c.solarSystemId}`}
                      prefetch={false}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      {c.solarSystemName ?? c.solarSystemId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{c.regionName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {EVENT_LABELS[c.eventType] ?? c.eventType}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AllianceLink id={c.defenderId} name={c.defenderName} ticker={c.defenderTicker} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ScoreBar defender={c.defenderScore} attackers={c.attackersScore} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {c.warKills > 0 ? (
                      <span className="text-red-400">{c.warKills}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {c.iskDestroyed > 0 ? (
                      <span className="text-red-400">{formatISK(c.iskDestroyed)}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400 whitespace-nowrap">
                    {formatTimeAgo(c.startTime)}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No active sovereignty campaigns right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent territory changes */}
      <section className="mt-10">
        <h3 className="text-xl font-semibold text-white">Recent Territory Changes</h3>
        <div className="mt-4 overflow-x-auto border border-white/10">
          <table className="table">
            <thead className="bg-neutral-800">
              <tr>
                <th className="text-left th-cell">System</th>
                <th className="text-left th-cell">Change</th>
                <th className="text-left th-cell">From</th>
                <th className="text-left th-cell">To</th>
                <th className="text-right th-cell">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {changes.map((c) => (
                <tr key={c.id} className="transition-colors bg-neutral-950 hover:bg-neutral-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/solar-systems/${c.solarSystemId}`}
                      prefetch={false}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      {c.solarSystemName ?? c.solarSystemId}
                    </Link>
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap font-semibold ${CHANGE_STYLES[c.changeType] ?? "text-gray-300"}`}>
                    {c.changeType}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AllianceLink id={c.previousOwnerId} name={c.previousOwnerName} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AllianceLink id={c.newOwnerId} name={c.newOwnerName} />
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400 whitespace-nowrap">
                    {formatTimeAgo(c.detectedAt)}
                  </td>
                </tr>
              ))}
              {changes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No territory changes detected yet. Changes appear here once the map worker observes an
                    ownership shift.
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

export default function SovereigntyPage() {
  return (
    <Suspense fallback={<Loader fullHeight size="lg" text="Loading sovereignty..." />}>
      <SovereigntyContent />
    </Suspense>
  );
}
