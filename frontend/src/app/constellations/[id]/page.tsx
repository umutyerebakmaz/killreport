'use client';

import SolarSystemCard from '@/components/Cards/SolarSystemCard';
import ConstellationMap from '@/components/ConstellationMap/ConstellationMap';
import KillmailsTab from '@/components/KillmailsTab/KillmailsTab';
import Loader from '@/components/Loader';
import RegionMap from '@/components/RegionMap/RegionMap';
import SovereigntyLogo from '@/components/Sovereignty/SovereigntyLogo';
import { useConstellationQuery } from '@/generated/graphql';
import { useTabList } from '@/hooks/useTabList';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useCallback, useState } from 'react';

interface ConstellationDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'killmails' | 'solarSystems';

const TAB_IDS: TabType[] = ['killmails', 'solarSystems'];

function isTabType(value: string | null): value is TabType {
  return value !== null && (TAB_IDS as string[]).includes(value);
}

export default function ConstellationDetailPage({
  params,
}: ConstellationDetailPageProps) {
  const { id } = use(params);
  const constellationId = parseInt(id);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Same order as the region page: killmails is what the page is for, so it
  // leads the tablist and opens by default. `?tab=` still wins where a link
  // names a tab — SolarSystemCard's constellation line already links here with
  // `?tab=killmails`, which until now landed on a page that had no tabs.
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(
    isTabType(tabParam) ? tabParam : 'killmails',
  );
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get('page')) || 1,
  );
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get('pageSize')) || 25,
  );

  // Written from the same callback that changes the state, and replace rather
  // than push, so switching tabs does not fill the back button.
  const syncUrl = useCallback(
    (tab: TabType, page: number, size: number) => {
      const next = new URLSearchParams();
      next.set('tab', tab);
      if (tab === 'killmails') {
        next.set('page', page.toString());
        next.set('pageSize', size.toString());
      }
      router.replace(`/constellations/${id}?${next.toString()}`, {
        scroll: false,
      });
    },
    [id, router],
  );

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      // Leaving the killmails tab on page 7 and coming back must not keep it.
      setCurrentPage(1);
      syncUrl(tab, 1, pageSize);
    },
    [pageSize, syncUrl],
  );

  const { onKeyDown } = useTabList(TAB_IDS, activeTab, handleTabChange);

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

  const { data, loading, error } = useConstellationQuery({
    variables: { id: constellationId },
  });

  if (loading) {
    return <Loader size="lg" text="Loading constellation..." fullHeight />;
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
    killmails: 'Killmails',
    solarSystems: `Solar Systems (${constellation.solarSystemCount})`,
  };

  return (
    <div>
      {/* Constellation detail card */}
      <div className="card p-6 flex flex-col">
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
              {/*
                The parent region, as its map and name alone. No "Region:"
                label — the map already says what kind of place it is, and the
                region page names its own parent the same way it names nothing.
              */}
              {constellation.region && (
                <div className="flex items-center gap-2 mt-2 text-gray-400">
                  <RegionMap
                    regionId={constellation.region.id}
                    regionName={constellation.region.name}
                    size={20}
                    className="shrink-0"
                  />
                  <Link
                    href={`/regions/${constellation.region.id}`}
                    prefetch={false}
                    className="transition-colors text-gray-400 hover:text-blue-400"
                  >
                    {constellation.region.name}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/*
            The constellation's holder, at the right edge of the card — the
            region page's placement and size. `totalSystems` lets the tooltip
            say what share of the constellation the holder actually holds:
            sovereignty is per system, so holding part of one is the normal case.
          */}
          <SovereigntyLogo
            holder={constellation.sovereignty}
            size={128}
            totalSystems={constellation.solarSystemCount}
            className="self-center shrink-0 lg:self-start"
          />
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
              onClick={() => handleTabChange(tabId)}
              onKeyDown={onKeyDown}
              className="button button-secondary button-sm"
            >
              {tabLabels[tabId]}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        {activeTab === 'solarSystems' && (
          <div
            role="tabpanel"
            id="panel-solarSystems"
            aria-labelledby="tab-solarSystems"
          >
            {constellation.solarSystems &&
            constellation.solarSystems.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {constellation.solarSystems.map((system) => (
                  // The constellation and the region are what this page
                  // already is, so the card prints the system alone.
                  <SolarSystemCard
                    key={system.id}
                    system={system}
                    showLineage={false}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                No solar systems found
              </div>
            )}
          </div>
        )}

        {activeTab === 'killmails' && (
          <div
            role="tabpanel"
            id="panel-killmails"
            aria-labelledby="tab-killmails"
          >
            <KillmailsTab
              scope={{ constellationId }}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
