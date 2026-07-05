"use client";

import Loader from "@/components/Loader";
import { AllianceLink } from "@/components/Sovereignty/AllianceLink";
import { ScoreBar } from "@/components/Sovereignty/ScoreBar";
import { useSovereigntyDashboardQuery } from "@/generated/graphql";
import { formatTimeAgo, formatRelativeTime } from "@/utils/date";
import { formatISK } from "@/utils/formatISK";
import Link from "next/link";
import { Fragment, Suspense, useState } from "react";

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

function SovereigntyContent() {
  const { data, loading, error } = useSovereigntyDashboardQuery();
  const [expandedCampaignId, setExpandedCampaignId] = useState<number | null>(null);

  if (loading) return <Loader fullHeight size="lg" text="Loading sovereignty data..." />;
  if (error) return <div className="p-8 text-red-400">Error: {error.message}</div>;

  const overview = data?.sovereigntyOverview;
  const rankings = data?.allianceTerritoryRankings ?? [];
  const campaigns = data?.sovereigntyActiveCampaigns ?? [];
  const changes = data?.recentTerritoryChanges ?? [];
  const aggressive = data?.mostAggressiveAlliances ?? [];
  const defensive = data?.mostDefensiveAlliances ?? [];
  const hotRegions = data?.activeCampaignsByRegion ?? [];
  const maxRegionCount = hotRegions.reduce((m, r) => Math.max(m, r.campaignCount), 0) || 1;

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold text-white">Sovereignty</h1>
        <Link
          href="/sovereignty/structures"
          prefetch={false}
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          Structures &amp; Timers →
        </Link>
      </div>
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
                <th className="text-right th-cell">Attacking</th>
                <th className="text-right th-cell">Defending</th>
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
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.campaignsAttacking > 0 ? (
                      <span className="text-red-400">{r.campaignsAttacking}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.campaignsDefending > 0 ? (
                      <span className="text-cyan-400">{r.campaignsDefending}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Activity leaderboards + hottest regions */}
      <section className="grid grid-cols-1 gap-4 mt-10 lg:grid-cols-3">
        <div className="border border-white/10 bg-neutral-900">
          <h3 className="px-4 py-3 text-lg font-semibold text-white border-b border-white/10">
            Most Aggressive
          </h3>
          <ul className="divide-y divide-white/5">
            {aggressive.map((a) => (
              <li key={a.allianceId} className="flex items-center justify-between px-4 py-2 text-sm">
                <AllianceLink id={a.allianceId} name={a.allianceName} ticker={a.allianceTicker} />
                <span className="text-red-400">{a.campaignsAttacking} atk</span>
              </li>
            ))}
            {aggressive.length === 0 && (
              <li className="px-4 py-6 text-sm text-center text-gray-500">No attacking activity today.</li>
            )}
          </ul>
        </div>

        <div className="border border-white/10 bg-neutral-900">
          <h3 className="px-4 py-3 text-lg font-semibold text-white border-b border-white/10">
            Most Defensive
          </h3>
          <ul className="divide-y divide-white/5">
            {defensive.map((d) => (
              <li key={d.allianceId} className="flex items-center justify-between px-4 py-2 text-sm">
                <AllianceLink id={d.allianceId} name={d.allianceName} ticker={d.allianceTicker} />
                <span className="text-cyan-400">{d.campaignsDefending} def</span>
              </li>
            ))}
            {defensive.length === 0 && (
              <li className="px-4 py-6 text-sm text-center text-gray-500">No defending activity today.</li>
            )}
          </ul>
        </div>

        <div className="border border-white/10 bg-neutral-900">
          <h3 className="px-4 py-3 text-lg font-semibold text-white border-b border-white/10">
            Hottest Regions Right Now
          </h3>
          <ul className="px-4 py-2 space-y-2">
            {hotRegions.map((r) => (
              <li key={r.regionId} className="text-sm">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/regions/${r.regionId}`}
                    prefetch={false}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    {r.regionName ?? `#${r.regionId}`}
                  </Link>
                  <span className="text-gray-300">{r.campaignCount}</span>
                </div>
                <div className="h-1.5 mt-1 overflow-hidden rounded bg-neutral-800">
                  <div
                    className="h-full bg-orange-500"
                    style={{ width: `${(r.campaignCount / maxRegionCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {hotRegions.length === 0 && (
              <li className="px-4 py-6 text-sm text-center text-gray-500">No active campaigns right now.</li>
            )}
          </ul>
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
                <th className="th-cell w-8"></th>
                <th className="text-left th-cell">System</th>
                <th className="text-left th-cell">Region</th>
                <th className="text-left th-cell">Type</th>
                <th className="text-left th-cell">Defender</th>
                <th className="text-left th-cell">Progress</th>
                <th className="text-right th-cell">Kills</th>
                <th className="text-right th-cell">ISK Lost</th>
                <th className="text-right th-cell">Timer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaigns.map((c) => {
                const expanded = expandedCampaignId === c.campaignId;
                const hasParticipants = c.participants.length > 0;
                return (
                  <Fragment key={c.campaignId}>
                    <tr
                      className={`transition-colors bg-neutral-950 ${hasParticipants ? "cursor-pointer hover:bg-neutral-900" : ""}`}
                      onClick={
                        hasParticipants
                          ? () => setExpandedCampaignId(expanded ? null : c.campaignId)
                          : undefined
                      }
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {hasParticipants ? (expanded ? "▾" : "▸") : ""}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/solar-systems/${c.solarSystemId}`}
                          prefetch={false}
                          className="text-cyan-400 hover:text-cyan-300"
                          onClick={(e) => e.stopPropagation()}
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
                        {formatRelativeTime(c.startTime)}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-neutral-900">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="text-xs tracking-wider text-gray-400 uppercase">Participants</div>
                          <ul className="mt-2 space-y-1">
                            {c.participants.slice(0, 8).map((p) => (
                              <li key={p.allianceId} className="flex items-center justify-between max-w-md text-sm">
                                <AllianceLink id={p.allianceId} name={p.allianceName} ticker={p.allianceTicker} />
                                <span className="text-gray-400">{Math.round(p.score * 100)}%</span>
                              </li>
                            ))}
                          </ul>
                          {c.participants.length > 8 && (
                            <div className="mt-1 text-xs text-gray-500">
                              +{c.participants.length - 8} more
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
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
