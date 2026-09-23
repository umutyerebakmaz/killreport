'use client';

import { Loader } from '@/components/Loader/Loader';
import { useSolarSystemStationsQuery } from '@/generated/graphql';
import { formatISK } from '@/utils/formatISK';
import Link from 'next/link';

interface StructuresTabProps {
  systemId: number;
}

export default function StructuresTab({ systemId }: StructuresTabProps) {
  const { data, loading, error } = useSolarSystemStationsQuery({
    variables: { id: systemId },
  });

  if (loading) return <Loader size="md" text="Loading structures..." />;

  if (error) {
    return (
      // tab-shell ground, not a card surface — see OverviewTab.tsx
      <div className="p-6 border bg-white/5 border-white/10 text-danger">
        Could not load structures: {error.message}
      </div>
    );
  }

  const stations = data?.solarSystem?.stations ?? [];

  if (stations.length === 0) {
    return (
      <div className="p-6 text-ink-muted border bg-white/5 border-white/10">
        This system has no NPC stations.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border bg-white/5 border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-surface-inset">
          <tr>
            <th className="text-left th-cell">Station</th>
            <th className="text-left th-cell">Type</th>
            <th className="text-left th-cell">Owner</th>
            <th className="text-right th-cell">Reprocessing</th>
            <th className="text-right th-cell">Station take</th>
            <th className="text-right th-cell">Office rent</th>
            <th className="text-left th-cell">Services</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((station) => (
            <tr
              key={station.id}
              className="border-b border-white/5 last:border-0"
            >
              <td className="px-4 py-3">
                {station.name ? (
                  <span className="text-gray-200">{station.name}</span>
                ) : (
                  <span className="italic text-ink-faint">
                    Station {station.id}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {station.type?.name ?? '—'}
              </td>
              <td className="px-4 py-3">
                {station.ownerCorporation ? (
                  <Link
                    href={`/corporations/${station.ownerCorporation.id}`}
                    prefetch={false}
                    className="text-ink-muted hover:text-blue-400"
                  >
                    {station.ownerCorporation.name}
                  </Link>
                ) : station.ownerCorporationId != null ? (
                  // Most station owners are NPC corporations, and those are not
                  // ingested: the ID is the whole truth we hold about them.
                  <span className="italic text-ink-faint">
                    Corporation {station.ownerCorporationId}
                  </span>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.reprocessingEfficiency != null
                  ? `${(station.reprocessingEfficiency * 100).toFixed(0)}%`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.reprocessingStationsTake != null
                  ? `${(station.reprocessingStationsTake * 100).toFixed(0)}%`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {station.officeRentalCost != null
                  ? formatISK(station.officeRentalCost)
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {station.services.map((service) => (
                    <span
                      key={service}
                      className="px-1.5 py-0.5 text-xs text-ink-muted border border-white/10"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
