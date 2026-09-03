'use client';

import AdjacentSystemsTab from '@/components/SolarSystemDetail/AdjacentSystemsTab';
import { Loader } from '@/components/Loader/Loader';
import SecurityBadge from '@/components/SecurityStatus/SecurityStatus';
import KillmailsTab from '@/components/SolarSystemDetail/KillmailsTab';
import OrbitalBodiesTab from '@/components/SolarSystemDetail/OrbitalBodiesTab';
import OverviewTab from '@/components/SolarSystemDetail/OverviewTab';
import SovereigntyTab from '@/components/SolarSystemDetail/SovereigntyTab';
import StructuresTab from '@/components/SolarSystemDetail/StructuresTab';
import SystemStatsStrip from '@/components/SolarSystemDetail/SystemStatsStrip';
import {
  isSolarSystemTab,
  SOLAR_SYSTEM_TABS,
  SolarSystemTab,
  TAB_LABELS,
} from '@/components/SolarSystemDetail/tabs';
import { useSolarSystemQuery } from '@/generated/graphql';
import { formatTimeAgo } from '@/utils/date';
import { getSecurityColor } from '@/utils/security';
import { GlobeAltIcon, MapIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useCallback, useState } from 'react';

interface SolarSystemDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function SolarSystemDetailPage({
  params,
}: SolarSystemDetailPageProps) {
  const { id } = use(params);
  const systemId = parseInt(id);
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const tabFromUrl: SolarSystemTab = isSolarSystemTab(tabParam)
    ? tabParam
    : 'overview';

  const [activeTab, setActiveTab] = useState<SolarSystemTab>(tabFromUrl);
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get('page')) || 1,
  );
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get('pageSize')) || 25,
  );

  const { data, loading, error } = useSolarSystemQuery({
    variables: { id: systemId },
  });

  // The URL is written from the same callback that changes the state. The old
  // effect depended on `router`, whose reference stability is not guaranteed,
  // and pushed unconditionally on mount — opening the page added a history
  // entry before the user touched anything.
  const syncUrl = useCallback(
    (tab: SolarSystemTab, page: number, size: number) => {
      const next = new URLSearchParams();
      next.set('tab', tab);
      if (tab === 'killmails') {
        next.set('page', page.toString());
        next.set('pageSize', size.toString());
      }
      // replace, not push: switching tabs must not fill the back button with
      // intermediate states.
      router.replace(`/solar-systems/${id}?${next.toString()}`, {
        scroll: false,
      });
    },
    [id, router],
  );

  const handleTabChange = useCallback(
    (tab: SolarSystemTab) => {
      setActiveTab(tab);
      // Leaving the killmails tab on page 7 and coming back must not keep
      // page=7 in state or in the URL.
      setCurrentPage(1);
      syncUrl(tab, 1, pageSize);
    },
    [pageSize, syncUrl],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      syncUrl(activeTab, page, pageSize);
    },
    [activeTab, pageSize, syncUrl],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
      syncUrl(activeTab, 1, size);
    },
    [activeTab, syncUrl],
  );

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading solar system..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const system = data?.solarSystem;

  if (!system) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Solar system not found</div>
      </div>
    );
  }

  const securityColor = getSecurityColor(system.securityStatus);
  const counts = system.counts;

  // The Adjacent label counts stargate rows, not resolved destinations: the row
  // count is right as soon as the topology scan has run, while the destinations
  // are filled in by a later worker.
  const tabCount = (tab: SolarSystemTab): number | null => {
    switch (tab) {
      case 'adjacent':
        return counts.stargates;
      case 'orbital-bodies':
        return counts.planets;
      case 'structures':
        return counts.stations;
      case 'sovereignty':
        return counts.sovereigntyStructures;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="system-detail-card">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            <div
              className={`flex items-center justify-center w-24 h-24 shadow-md shrink-0 ${
                system.securityStatus != null && system.securityStatus >= 0.5
                  ? 'bg-green-500/20 border border-green-500/50'
                  : system.securityStatus != null && system.securityStatus > 0
                    ? 'bg-yellow-500/20 border border-yellow-500/50'
                    : system.securityStatus != null
                      ? 'bg-red-500/20 border border-red-500/50'
                      : 'bg-purple-500/20 border border-purple-500/50'
              }`}
            >
              <MapPinIcon className={`w-12 h-12 ${securityColor}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-bold text-white">{system.name}</h1>
                {counts.sovereigntyStructures > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20">
                    SOVEREIGNTY
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <SecurityBadge
                  securityStatus={system.securityStatus}
                  showLabel={true}
                />
              </div>
              <div className="flex flex-wrap items-center gap-6 mt-4 text-sm">
                {system.constellation && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapIcon className="w-4 h-4 text-purple-500" />
                    <span>Constellation:</span>
                    <Link
                      href={`/constellations/${system.constellation.id}`}
                      prefetch={false}
                      className="transition-colors text-cyan-400 hover:text-cyan-300"
                    >
                      {system.constellation.name}
                    </Link>
                  </div>
                )}
                {system.constellation?.region && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <GlobeAltIcon className="w-4 h-4 text-cyan-500" />
                    <span>Region:</span>
                    <Link
                      href={`/regions/${system.constellation.region.id}`}
                      prefetch={false}
                      className="transition-colors text-cyan-400 hover:text-cyan-300"
                    >
                      {system.constellation.region.name}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kill Statistics Card */}
          {system.latestKills ? (
            <div className="flex flex-col items-end space-y-2 text-xs text-gray-400">
              <span>
                {system.latestKills.ship_kills.toLocaleString()} ships,{' '}
                {system.latestKills.pod_kills.toLocaleString()} pods,{' '}
                {system.latestKills.npc_kills.toLocaleString()} NPC killed
              </span>
              <span>{formatTimeAgo(system.latestKills.timestamp)}</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent activity</p>
          )}
        </div>

        {/* Above the tab bar on purpose: it summarises the system, not a tab. */}
        <SystemStatsStrip systemId={systemId} />

        {/* Tabs — overflow-x-auto because six tabs overflow a narrow screen */}
        <div className="mt-8 mb-6 border-b border-white/10">
          <nav className="flex gap-4 overflow-x-auto" aria-label="Tabs">
            {SOLAR_SYSTEM_TABS.map((tab) => {
              const count = tabCount(tab);
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-cyan-500 text-cyan-500'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {count !== null && (
                    <span className="ml-1.5 text-xs text-gray-500">
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'overview' && (
            <OverviewTab
              systemId={systemId}
              starId={system.star_id}
              securityClass={system.security_class}
              securityStatus={system.securityStatus}
              position={system.position}
              star={system.star}
            />
          )}
          {activeTab === 'adjacent' && (
            <AdjacentSystemsTab systemId={systemId} />
          )}
          {activeTab === 'orbital-bodies' && (
            <OrbitalBodiesTab systemId={systemId} />
          )}
          {activeTab === 'structures' && <StructuresTab systemId={systemId} />}
          {activeTab === 'sovereignty' && (
            <SovereigntyTab systemId={systemId} />
          )}
          {activeTab === 'killmails' && (
            <KillmailsTab
              systemId={systemId}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
