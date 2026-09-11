'use client';

import ConstellationMap from '@/components/ConstellationMap/ConstellationMap';
import RegionMap from '@/components/RegionMap/RegionMap';
import SecurityBadge from '@/components/SecurityStatus/SecurityStatus';
import SolarSystemMap from '@/components/SolarSystemMap/SolarSystemMap';
import { useConstellationQuery } from '@/generated/graphql';
import { MapPinIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { use } from 'react';

interface ConstellationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ConstellationDetailPage({
  params,
}: ConstellationDetailPageProps) {
  const { id } = use(params);

  const { data, loading, error } = useConstellationQuery({
    variables: { id: parseInt(id) },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 rounded-full animate-spin border-cyan-500 border-t-transparent" />
          <span className="text-lg">Loading constellation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const constellation = data?.constellation;

  if (!constellation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Constellation not found</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card p-6 flex flex-col">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-24 h-24 sm:w-64 sm:h-64 shrink-0">
              <ConstellationMap
                constellationId={constellation.id}
                constellationName={constellation.name}
                size={256}
                className="w-full h-full"
              />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">
                {constellation.name}
              </h1>
              {constellation.region && (
                <div className="flex items-center gap-2 mt-2 text-gray-400">
                  <RegionMap
                    regionId={constellation.region.id}
                    regionName={constellation.region.name}
                    size={20}
                    className="shrink-0"
                  />
                  <span>Region:</span>
                  <Link
                    href={`/regions/${constellation.region.id}`}
                    prefetch={false}
                    className="transition-colors text-gray-400 hover:text-blue-400"
                  >
                    {constellation.region.name}
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-orange-400" />
                  <span className="font-medium text-orange-300">
                    {constellation.solarSystemCount}
                  </span>
                  <span className="text-gray-500">Solar Systems</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* One panel left, so no tab bar: the systems table stands on its own. */}
      <div className="mt-6">
        <div className="overflow-hidden border border-white/10">
          <table className="table">
            <thead className="bg-surface-inset">
              <tr>
                <th className="th-cell">Solar System</th>
                <th className="th-cell">Security Status</th>
                <th className="th-cell">Security Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {constellation.solarSystems &&
              constellation.solarSystems.length > 0 ? (
                constellation.solarSystems.map((system) => (
                  <tr key={system.id} className="tr-row">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <SolarSystemMap
                          systemId={system.id}
                          systemName={system.name}
                          size={24}
                          className="shrink-0"
                        />
                        <Link
                          href={`/solar-systems/${system.id}`}
                          prefetch={false}
                          className="font-medium transition-colors text-gray-400 hover:text-blue-400"
                        >
                          {system.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SecurityBadge securityStatus={system.securityStatus} />
                    </td>
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                      {system.security_class || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No solar systems found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
