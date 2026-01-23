"use client";

import Loader from "@/components/Loader";
import { useMemo } from "react";
import KillmailRow from "./KillmailRow";
import { Killmail, KillmailsTableProps } from "./types";

export default function KillmailsTable({
  killmails,
  animatingKillmails = new Set(),
  loading = false,
  characterId,
  corporationId,
  allianceId,
  dateCountsMap,
}: KillmailsTableProps) {
  // Group killmails by date inside component
  const groupedKillmails = useMemo(() => {
    return killmails.reduce(
      (groups, km) => {
        const dateObj = new Date(km.killmailTime);
        const date = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD format
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(km);
        return groups;
      },
      {} as Record<string, Killmail[]>,
    );
  }, [killmails]);

  if (loading) {
    return <Loader size="md" text="Loading killmails..." className="py-12" />;
  }

  if (killmails.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">No killmails found</div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedKillmails).map(([date, dateKillmails]) => (
        <div key={date} className="space-y-3">
          {/* Date Header */}
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <span className="text-gray-200">{date}</span>
            <span className="text-sm font-normal text-gray-500">
              ({dateCountsMap?.get(date) ?? dateKillmails.length} killmail
              {(dateCountsMap?.get(date) ?? dateKillmails.length) !== 1 ? "s" : ""})
            </span>
          </h2>

          {/* Table for this date */}
          <div className="border border-white/10">
            <table className="table">
              <thead className="bg-white/5">
                <tr>
                  <th className="th-cell">Time</th>
                  <th className="th-cell">Ship</th>
                  <th className="th-cell">Victim</th>
                  <th className="th-cell">Final Blow</th>
                  <th className="th-cell">System</th>
                  <th className="th-cell">Attackers</th>
                  <th className="th-cell">Damage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {dateKillmails.map((km) => (
                  <KillmailRow
                    key={km.id}
                    killmail={km}
                    isAnimating={animatingKillmails.has(km.id)}
                    characterId={characterId}
                    corporationId={corporationId}
                    allianceId={allianceId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
