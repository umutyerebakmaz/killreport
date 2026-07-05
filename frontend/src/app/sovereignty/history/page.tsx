"use client";

import Loader from "@/components/Loader";
import { AllianceLink } from "@/components/Sovereignty/AllianceLink";
import { ScoreBar } from "@/components/Sovereignty/ScoreBar";
import { useSovereigntyHistoryPageQuery } from "@/generated/graphql";
import { formatISK } from "@/utils/formatISK";
import Link from "next/link";
import { Suspense, useState } from "react";

const PAGE_SIZE = 25;

const EVENT_LABELS: Record<string, string> = {
  tcu_defense: "TCU Defense",
  ihub_defense: "IHub Defense",
  station_defense: "Station Defense",
  station_freeport: "Station Freeport",
};

const OUTCOME_LABELS: Record<string, string> = {
  defender_won: "Defender won",
  attacker_won: "Attacker won",
  abandoned: "Abandoned",
};

const OUTCOME_STYLES: Record<string, string> = {
  defender_won: "text-cyan-400",
  attacker_won: "text-red-400",
  abandoned: "text-gray-400",
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

function OutcomeBar({
  defenderWon,
  attackerWon,
  abandoned,
}: {
  defenderWon: number;
  attackerWon: number;
  abandoned: number;
}) {
  const total = defenderWon + attackerWon + abandoned || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2 max-w-2xl overflow-hidden rounded bg-neutral-800">
      <div className="bg-cyan-500" style={{ width: pct(defenderWon) }} />
      <div className="bg-red-500" style={{ width: pct(attackerWon) }} />
      <div className="bg-gray-600" style={{ width: pct(abandoned) }} />
    </div>
  );
}

function HistoryContent() {
  const [page, setPage] = useState(0);
  const { data, loading, error } = useSovereigntyHistoryPageQuery({
    variables: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
  });

  if (loading) return <Loader fullHeight size="lg" text="Loading history..." />;
  if (error) return <div className="p-8 text-red-400">Error: {error.message}</div>;

  const stats = data?.sovereigntyOutcomeStats;
  const defenders = data?.topDefenders ?? [];
  const history = data?.sovereigntyCampaignHistory;
  const campaigns = history?.items ?? [];
  const totalCount = history?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold text-white">Campaign History</h1>
        <Link href="/sovereignty" prefetch={false} className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Sovereignty Overview
        </Link>
      </div>
      <h2 className="mt-2 text-xl text-white">Resolved sovereignty campaigns and their outcomes</h2>

      {/* Outcome distribution */}
      {stats && (
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Defender wins" value={stats.defenderWon} />
            <StatCard label="Attacker wins" value={stats.attackerWon} />
            <StatCard label="Abandoned" value={stats.abandoned} />
            <StatCard label="Total resolved" value={stats.totalResolved} />
          </div>
          {stats.totalResolved > 0 && (
            <div className="mt-4">
              <OutcomeBar
                defenderWon={stats.defenderWon}
                attackerWon={stats.attackerWon}
                abandoned={stats.abandoned}
              />
            </div>
          )}
        </section>
      )}

      {/* Top defenders */}
      <section className="mt-10">
        <h3 className="text-xl font-semibold text-white">Top Defenders</h3>
        <div className="mt-4 overflow-x-auto border border-white/10">
          <table className="table">
            <thead className="bg-neutral-800">
              <tr>
                <th className="text-left th-cell">#</th>
                <th className="text-left th-cell">Alliance</th>
                <th className="text-right th-cell">Defenses Won</th>
                <th className="text-right th-cell">Total</th>
                <th className="text-right th-cell">Success</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {defenders.map((d) => (
                <tr key={d.allianceId} className="transition-colors bg-neutral-950 hover:bg-neutral-900">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{d.rank}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AllianceLink id={d.allianceId} name={d.allianceName} ticker={d.allianceTicker} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-right text-cyan-400 whitespace-nowrap">
                    {d.defensesWon}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">{d.defensesTotal}</td>
                  <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">
                    {Math.round(d.defenseSuccessRate * 100)}%
                  </td>
                </tr>
              ))}
              {defenders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No resolved defenses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Campaign archive */}
      <section className="mt-10">
        <h3 className="text-xl font-semibold text-white">
          Campaign Archive <span className="text-gray-500">({totalCount})</span>
        </h3>
        <div className="mt-4 overflow-x-auto border border-white/10">
          <table className="table">
            <thead className="bg-neutral-800">
              <tr>
                <th className="text-left th-cell">System</th>
                <th className="text-left th-cell">Region</th>
                <th className="text-left th-cell">Type</th>
                <th className="text-left th-cell">Defender</th>
                <th className="text-left th-cell">Outcome</th>
                <th className="text-left th-cell">Final</th>
                <th className="text-right th-cell">Duration</th>
                <th className="text-right th-cell">ISK Lost</th>
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
                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${OUTCOME_STYLES[c.outcome ?? ""] ?? "text-gray-300"}`}>
                    {OUTCOME_LABELS[c.outcome ?? ""] ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ScoreBar defender={c.defenderScore} attackers={c.attackersScore} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 whitespace-nowrap">
                    {c.durationHours != null ? `${c.durationHours}h` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {c.iskDestroyed > 0 ? (
                      <span className="text-red-400">{formatISK(c.iskDestroyed)}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No resolved campaigns yet. They appear here once campaigns end.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-neutral-900"
            >
              ← Prev
            </button>
            <span className="text-gray-500">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1 border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-neutral-900"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function SovereigntyHistoryPage() {
  return (
    <Suspense fallback={<Loader fullHeight size="lg" text="Loading history..." />}>
      <HistoryContent />
    </Suspense>
  );
}
