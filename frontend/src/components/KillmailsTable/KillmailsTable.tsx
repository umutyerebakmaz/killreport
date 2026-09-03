'use client';

import Loader from '@/components/Loader';
import { useMemo } from 'react';
import KillmailRow from './KillmailRow';
import { Killmail, KillmailsTableProps } from './types';

export default function KillmailsTable({
  killmails,
  animatingKillmails = new Set(),
  loading = false,
  characterId,
  corporationId,
  allianceId,
  dateCountsMap,
  totalCount,
  variant = 'list',
}: KillmailsTableProps) {
  // Group killmails by date inside component
  const groupedKillmails = useMemo(() => {
    return killmails.reduce(
      (groups, km) => {
        const dateObj = new Date(km.killmailTime);
        const date = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
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
      {Object.entries(groupedKillmails).map(([date, dateKillmails], index) => {
        const rows = dateKillmails as Killmail[];
        const dayCount = dateCountsMap?.get(date) ?? rows.length;

        return (
          <div key={date} className="space-y-3">
            {/* Date Header. items-baseline, not items-center: the count is
                text-sm next to a text-xl date, and centring the two boxes
                leaves the smaller one floating off the date's baseline. */}
            <h2 className="flex items-baseline gap-2 text-xl font-semibold">
              <span className="text-gray-200">{date}</span>
              <span className="text-sm font-normal text-gray-400">
                ({dayCount.toLocaleString()}{' '}
                {dayCount === 1 ? 'killmail' : 'killmails'})
              </span>
              {index === 0 && totalCount !== undefined && totalCount > 0 && (
                <span className="ml-auto text-sm font-normal text-gray-400">
                  Total: {totalCount.toLocaleString()} killmails
                </span>
              )}
            </h2>

            {/* Table for this date */}
            <div className="border border-neutral-800">
              <table className="table w-full table-fixed">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-30" />
                  <col className="w-16" />
                  <col className="w-30" />
                  <col className="w-30" />
                  <col className="w-12" />
                </colgroup>
                <thead className="bg-neutral-800">
                  <tr>
                    <th className="text-left th-cell">Time</th>
                    <th className="text-left th-cell">Ship</th>
                    <th className="text-left th-cell">System</th>
                    <th className="text-left th-cell">Victim</th>
                    <th className="text-left th-cell">Final Blow</th>
                    <th className="text-left th-cell">Attackers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((km) => (
                    <KillmailRow
                      key={km.id}
                      killmail={km}
                      isAnimating={animatingKillmails.has(km.id)}
                      characterId={characterId}
                      corporationId={corporationId}
                      allianceId={allianceId}
                      variant={variant}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
