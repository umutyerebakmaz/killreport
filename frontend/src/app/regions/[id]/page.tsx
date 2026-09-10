'use client';

import ConstellationCard from '@/components/Cards/ConstellationCard';
import EveHtmlRenderer from '@/components/EveHtmlRenderer';
import KillmailsTab from '@/components/KillmailsTab/KillmailsTab';
import Loader from '@/components/Loader';
import MostValuableCarousel from '@/components/MostValuableCarousel/MostValuableCarousel';
import RegionMap from '@/components/RegionMap/RegionMap';
import SovereigntyLogo from '@/components/Sovereignty/SovereigntyLogo';
import { useRegionQuery } from '@/generated/graphql';
import { useTabList } from '@/hooks/useTabList';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useCallback, useState } from 'react';

interface RegionDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'killmails' | 'overview' | 'constellations';

const TAB_IDS: TabType[] = ['killmails', 'overview', 'constellations'];

function isTabType(value: string | null): value is TabType {
  return value !== null && (TAB_IDS as string[]).includes(value);
}

export default function RegionDetailPage({ params }: RegionDetailPageProps) {
  const { id } = use(params);
  const regionId = parseInt(id);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Killmails is what the page is for, so it leads the tablist and opens by
  // default. `?tab=` still wins where a link names a tab — SolarSystemCard's
  // region line is one.
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
      router.replace(`/regions/${id}?${next.toString()}`, { scroll: false });
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

  const { data, loading, error } = useRegionQuery({
    variables: { id: regionId },
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
    killmails: 'Killmails',
    overview: 'Overview',
    constellations: `Constellations (${region.constellationCount})`,
  };

  return (
    <div>
      {/* Region detail card */}
      <div className="card p-6 flex flex-col">
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
            </div>
          </div>

          {/*
            The region's holder, at the right edge of the card. 128 rather than
            256: the image server answers size=512 with a real 512x512 file,
            but at 19.4KB against 15.9KB for the 256 it is plainly an upscale of
            a smaller master, so a 256px box rendered soft.
          */}
          <SovereigntyLogo
            holder={region.sovereignty}
            size={128}
            className="self-center shrink-0 lg:self-start"
          />
        </div>
      </div>

      {/* Most Valuable, scoped to this region */}
      <div className="mt-6">
        <MostValuableCarousel regionId={region.id} />
      </div>

      <div className="tab-shell mt-6">
        {/* Tabs — the Most Valuable shelf's button tablist, not the
            underlined .tab. .button-secondary carries `surface`, which is the
            step above the shell's ground, and its aria-selected state marks
            the active one with the accent border. */}
        <nav className="flex gap-1 mb-3" aria-label="Tabs" role="tablist">
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
          >
            {region.constellations && region.constellations.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {region.constellations.map((constellation) => (
                  <ConstellationCard
                    key={constellation.id}
                    constellation={constellation}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                No constellations found
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
              scope={{ regionId }}
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
