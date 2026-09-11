'use client';

import RegionMap from '@/components/RegionMap/RegionMap';
import ConstellationMap from '@/components/ConstellationMap/ConstellationMap';
import SolarSystemMap from '@/components/SolarSystemMap/SolarSystemMap';
import SecurityBadge from '@/components/SecurityStatus/SecurityStatus';
import { useConstellationQuery } from '@/generated/graphql';
import { useTabList } from '@/hooks/useTabList';
import { MapPinIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { use, useState } from 'react';

interface ConstellationDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'overview' | 'systems';

const TAB_IDS: TabType[] = ['overview', 'systems'];

export default function ConstellationDetailPage({
  params,
}: ConstellationDetailPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { onKeyDown } = useTabList(TAB_IDS, activeTab, setActiveTab);

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

  const tabLabels: Record<TabType, string> = {
    overview: 'Overview',
    systems: `Solar Systems (${constellation.solarSystemCount})`,
  };

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

      <div className="tab-shell mt-6">
        <nav
          className="flex gap-1 mb-3 overflow-x-auto"
          aria-label="Tabs"
          role="tablist"
        >
          {TAB_IDS.map((tabId) => (
            <button
              key={tabId}
              role="tab"
              id={`tab-${tabId}`}
              aria-controls={`panel-${tabId}`}
              aria-selected={activeTab === tabId}
              tabIndex={activeTab === tabId ? 0 : -1}
              onClick={() => setActiveTab(tabId)}
              onKeyDown={onKeyDown}
              className="button button-secondary button-sm"
            >
              {tabLabels[tabId]}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && (
          <div
            role="tabpanel"
            id="panel-overview"
            aria-labelledby="tab-overview"
            className="grid gap-6 md:grid-cols-2"
          >
            {/* Constellation Info */}
            <div className="p-6 border bg-white/5 border-white/10">
              <h2 className="mb-4 text-xl font-bold">
                Constellation Information
              </h2>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-400">Constellation ID</dt>
                  <dd className="text-gray-200">{constellation.id}</dd>
                </div>
                {constellation.region && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Region</dt>
                    <dd>
                      <Link
                        href={`/regions/${constellation.region.id}`}
                        prefetch={false}
                        className="text-gray-400 hover:text-blue-400"
                      >
                        {constellation.region.name}
                      </Link>
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-400">Solar Systems</dt>
                  <dd className="font-medium text-orange-300">
                    {constellation.solarSystemCount}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Position Info */}
            {constellation.position && (
              <div className="p-6 border bg-white/5 border-white/10">
                <h2 className="mb-4 text-xl font-bold">Position in Space</h2>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-gray-400">X</div>
                    <div className="text-gray-200">
                      {constellation.position.x.toExponential(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Y</div>
                    <div className="text-gray-200">
                      {constellation.position.y.toExponential(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Z</div>
                    <div className="text-gray-200">
                      {constellation.position.z.toExponential(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'systems' && (
          <div
            role="tabpanel"
            id="panel-systems"
            aria-labelledby="tab-systems"
            className="overflow-hidden border border-white/10"
          >
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
        )}
      </div>
    </div>
  );
}
