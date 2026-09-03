'use client';

import { Loader } from '@/components/Loader/Loader';
import { useSolarSystemSovereigntyQuery } from '@/generated/graphql';
import { formatKillmailDateTime } from '@/utils/date';
import Link from 'next/link';

interface SovereigntyTabProps {
  systemId: number;
}

export default function SovereigntyTab({ systemId }: SovereigntyTabProps) {
  const { data, loading, error } = useSolarSystemSovereigntyQuery({
    variables: { systemId },
  });

  if (loading) return <Loader size="md" text="Loading sovereignty..." />;

  if (error) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 text-red-400">
        Could not load sovereignty: {error.message}
      </div>
    );
  }

  const structures = data?.sovereigntyStructures ?? [];
  const campaigns = data?.sovereigntyActiveCampaigns ?? [];

  if (structures.length === 0 && campaigns.length === 0) {
    // The tab stays visible even when empty — it was explicitly requested.
    return (
      <div className="p-6 text-gray-400 border bg-white/5 border-white/10">
        This system is not held under sovereignty.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {structures.length > 0 && (
        <div className="overflow-x-auto border bg-white/5 border-white/10">
          <table className="w-full text-sm">
            <thead className="text-xs tracking-wide text-gray-400 uppercase border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left">Structure</th>
                <th className="px-4 py-3 text-left">Owner</th>
                <th className="px-4 py-3 text-right">ADM</th>
                <th className="px-4 py-3 text-left">Vulnerable from</th>
                <th className="px-4 py-3 text-left">Vulnerable to</th>
              </tr>
            </thead>
            <tbody>
              {structures.map((structure) => (
                <tr
                  key={structure.structureId}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3 text-gray-200">
                    {structure.structureTypeName ??
                      `Type ${structure.structureTypeId}`}
                  </td>
                  <td className="px-4 py-3">
                    {structure.allianceId ? (
                      <Link
                        href={`/alliances/${structure.allianceId}`}
                        prefetch={false}
                        className="text-cyan-400 hover:underline"
                      >
                        {structure.allianceName ?? structure.allianceId}
                        {structure.allianceTicker && (
                          <span className="ml-1 text-gray-500">
                            [{structure.allianceTicker}]
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {structure.occupancyLevel != null
                      ? structure.occupancyLevel.toFixed(1)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {structure.vulnerableStartTime
                      ? formatKillmailDateTime(structure.vulnerableStartTime)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {structure.vulnerableEndTime
                      ? formatKillmailDateTime(structure.vulnerableEndTime)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="p-6 border bg-white/5 border-white/10">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-gray-300 uppercase">
            Active campaigns
          </h3>
          <ul className="space-y-3">
            {campaigns.map((campaign) => (
              <li
                key={campaign.campaignId}
                className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 last:border-0 last:pb-0"
              >
                <span className="text-gray-200">{campaign.eventType}</span>
                <span className="text-sm text-gray-400">
                  Defender:{' '}
                  {campaign.defenderId ? (
                    <Link
                      href={`/alliances/${campaign.defenderId}`}
                      prefetch={false}
                      className="text-cyan-400 hover:underline"
                    >
                      {campaign.defenderName ?? campaign.defenderId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </span>
                <span className="text-sm text-gray-400">
                  {campaign.defenderScore ?? 0} vs{' '}
                  {campaign.attackersScore ?? 0}
                </span>
                <span className="text-sm text-gray-500">
                  {campaign.startTime
                    ? formatKillmailDateTime(campaign.startTime)
                    : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
