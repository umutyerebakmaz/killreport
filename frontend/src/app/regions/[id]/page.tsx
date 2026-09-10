'use client';

import ConstellationMap from '@/components/ConstellationMap/ConstellationMap';
import EveHtmlRenderer from '@/components/EveHtmlRenderer';
import Loader from '@/components/Loader';
import { useRegionQuery } from '@/generated/graphql';
import RegionMap from '@/components/RegionMap/RegionMap';
import { useTabList } from '@/hooks/useTabList';
import { MapIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { use, useState } from 'react';

interface RegionDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'overview' | 'constellations';

const TAB_IDS: TabType[] = ['overview', 'constellations'];

export default function RegionDetailPage({ params }: RegionDetailPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { onKeyDown } = useTabList(TAB_IDS, activeTab, setActiveTab);

  const { data, loading, error } = useRegionQuery({
    variables: { id: parseInt(id) },
  });

  if (loading) {
    return <Loader size="lg" text="Loading region..." fullHeight />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const region = data?.region;

  if (!region) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Region not found</div>
      </div>
    );
  }

  const tabLabels: Record<TabType, string> = {
    overview: 'Overview',
    constellations: `Constellations (${region.constellationCount})`,
  };

  return (
    <div>
      <div className="card p-6 flex flex-col">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-24 h-24 sm:w-64 sm:h-64 shrink-0">
              <RegionMap
                regionId={region.id}
                regionName={region.name}
                size={256}
                className="w-full h-full"
              />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">{region.name}</h1>
              {region.description && (
                <EveHtmlRenderer
                  html={region.description}
                  className="max-w-2xl mt-2 text-gray-400"
                />
              )}
              <div className="flex items-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapIcon className="w-5 h-5 text-purple-400" />
                  <span className="font-medium text-purple-300">
                    {region.constellationCount}
                  </span>
                  <span className="text-gray-500">Constellations</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-orange-400" />
                  <span className="font-medium text-orange-300">
                    {region.solarSystemCount}
                  </span>
                  <span className="text-gray-500">Systems</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 border-b border-white/10">
          <nav className="flex gap-4" aria-label="Tabs" role="tablist">
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
                className="tab"
              >
                {tabLabels[tabId]}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div
              role="tabpanel"
              id="panel-overview"
              aria-labelledby="tab-overview"
            />
          )}

          {activeTab === 'constellations' && (
            <div
              role="tabpanel"
              id="panel-constellations"
              aria-labelledby="tab-constellations"
              className="overflow-hidden border border-white/10"
            >
              <table className="table">
                <thead className="bg-surface-inset">
                  <tr>
                    <th className="th-cell">Constellation</th>
                    <th className="th-cell">Systems</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {region.constellations && region.constellations.length > 0 ? (
                    region.constellations.map((constellation) => (
                      <tr key={constellation.id} className="tr-row">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <ConstellationMap
                              constellationId={constellation.id}
                              constellationName={constellation.name}
                              size={24}
                              className="shrink-0"
                            />
                            <Link
                              href={`/constellations/${constellation.id}`}
                              prefetch={false}
                              className="font-medium transition-colors text-gray-400 hover:text-blue-400"
                            >
                              {constellation.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-orange-400" />
                            <span className="text-orange-300">
                              {constellation.solarSystemCount}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        No constellations found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
