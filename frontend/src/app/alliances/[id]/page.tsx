'use client';

import AllianceGrowthChart from '@/components/AllianceGrowthChart/AllianceGrowthChart';
import CorporationTable from '@/components/CorporationsTable/CorporationsTable';
import KillmailsTable from '@/components/KillmailsTable';
import { Loader } from '@/components/Loader/Loader';
import MemberDeltaBadge from '@/components/MemberDeltaBadge/MemberDeltaBadge';
import Paginator from '@/components/Paginator/Paginator';
import TopCharacterCard from '@/components/TopCharacterCard/TopCharacterCard';
import TopShipsCard from '@/components/TopShipsCard';
import TopTargetsCard from '@/components/TopTargetsCard';
import TotalCorporationBadge from '@/components/TotalCorporationMember/TotalCorporationBadge';
import TotalMemberBadge from '@/components/TotalMemberBadge/TotalMemberBadge';
import {
  CorporationOrderBy,
  useAllianceCorporationsQuery,
  useAllianceGrowthQuery,
  useAllianceKillmailsQuery,
  useAllianceQuery,
  useAllianceTopAllianceTargetsQuery,
  useAllianceTopCharactersQuery,
  useAllianceTopCorporationTargetsQuery,
  useAllianceTopShipsQuery,
  useAllianceTopShipTargetsQuery,
  useKillmailsDateCountsQuery,
} from '@/generated/graphql';
import { useTabList } from '@/hooks/useTabList';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

interface AllianceDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType =
  'attributes' | 'growth' | 'killmails' | 'war-history' | 'members';

const TAB_IDS: TabType[] = [
  'attributes',
  'killmails',
  'war-history',
  'members',
  'growth',
];

const TAB_LABELS: Record<TabType, string> = {
  attributes: 'Attributes',
  killmails: 'Killmails',
  'war-history': 'War History',
  members: 'Members',
  growth: 'Growth',
};

export default function AllianceDetailPage({
  params,
}: AllianceDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get('page')) || 1;
  const pageSizeFromUrl = Number(searchParams.get('pageSize')) || 25;
  const tabFromUrl = (searchParams.get('tab') as TabType) || 'attributes';

  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);
  const { onKeyDown } = useTabList(TAB_IDS, activeTab, setActiveTab);

  // Separate pagination for corporations
  const [corporationsPage, setCorporationsPage] = useState(1);
  const [corporationsPageSize, setCorporationsPageSize] = useState(100);

  const { data, loading, error } = useAllianceQuery({
    variables: {
      id: parseInt(id),
    },
  });

  // Fetch top targets independently - these run in parallel
  const { data: allianceTargetsData, loading: allianceTargetsLoading } =
    useAllianceTopAllianceTargetsQuery({
      variables: {
        allianceId: parseInt(id),
        filter: 'LAST_7_DAYS' as any,
      },
    });

  const { data: corporationTargetsData, loading: corporationTargetsLoading } =
    useAllianceTopCorporationTargetsQuery({
      variables: {
        allianceId: parseInt(id),
        filter: 'LAST_7_DAYS' as any,
      },
    });

  const { data: shipTargetsData, loading: shipTargetsLoading } =
    useAllianceTopShipTargetsQuery({
      variables: {
        allianceId: parseInt(id),
        filter: 'LAST_7_DAYS' as any,
      },
    });

  const { data: shipsData, loading: shipsLoading } = useAllianceTopShipsQuery({
    variables: {
      allianceId: parseInt(id),
      filter: 'LAST_7_DAYS' as any,
    },
  });

  const { data: topCharactersData, loading: topCharactersLoading } =
    useAllianceTopCharactersQuery({
      variables: {
        allianceId: parseInt(id),
        filter: 'LAST_7_DAYS' as any,
      },
    });

  // Fetch corporations when members tab is active
  const { data: corporationsData, loading: corporationsLoading } =
    useAllianceCorporationsQuery({
      variables: {
        filter: {
          allianceId: parseInt(id),
          page: corporationsPage,
          limit: corporationsPageSize,
          orderBy: CorporationOrderBy.MemberCountDesc,
        },
      },
      skip: activeTab !== 'members',
    });

  // Fetch killmails when killmails tab is active
  const { data: killmailsData, loading: killmailsLoading } =
    useAllianceKillmailsQuery({
      variables: {
        filter: {
          allianceId: parseInt(id),
          page: currentPage,
          limit: pageSize,
        },
      },
      skip: activeTab !== 'killmails',
    });

  // Fetch date counts for correct totals per date
  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: {
      filter: {
        allianceId: parseInt(id),
      },
    },
    skip: activeTab !== 'killmails',
  });

  // Fetch growth snapshots only when growth tab is active
  const { data: growthData, loading: growthLoading } = useAllianceGrowthQuery({
    variables: { id: parseInt(id), days: 90 },
    skip: activeTab !== 'growth',
  });

  // Memoize killmails array
  const killmails = useMemo(
    () => killmailsData?.killmails.items || [],
    [killmailsData],
  );

  // Memoize corporations array
  const corporations = useMemo(
    () => corporationsData?.corporations.items || [],
    [corporationsData],
  );

  // Create a map of date -> total count for that date
  const dateCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    dateCountsData?.killmailsDateCounts.forEach((dc) => {
      map.set(dc.date, dc.count);
    });
    return map;
  }, [dateCountsData]);

  const pageInfo = killmailsData?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const corporationsPageInfo = corporationsData?.corporations.pageInfo;
  const corporationsTotalPages = corporationsPageInfo?.totalPages || 0;

  // URL sync for pagination and tab
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    if (activeTab === 'killmails') {
      params.set('page', currentPage.toString());
      params.set('pageSize', pageSize.toString());
    } else if (activeTab === 'members') {
      params.set('page', corporationsPage.toString());
      params.set('pageSize', corporationsPageSize.toString());
    }
    router.push(`/alliances/${id}?${params.toString()}`, { scroll: false });
  }, [
    currentPage,
    pageSize,
    corporationsPage,
    corporationsPageSize,
    activeTab,
    id,
    router,
  ]);

  const handleNext = useCallback(
    () => pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1),
    [pageInfo?.hasNextPage],
  );
  const handlePrev = useCallback(
    () => pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1),
    [pageInfo?.hasPreviousPage],
  );
  const handleFirst = useCallback(() => setCurrentPage(1), []);
  const handleLast = useCallback(
    () => totalPages > 0 && setCurrentPage(totalPages),
    [totalPages],
  );

  // Corporation pagination handlers
  const handleCorporationsNext = useCallback(
    () =>
      corporationsPageInfo?.hasNextPage &&
      setCorporationsPage((prev) => prev + 1),
    [corporationsPageInfo?.hasNextPage],
  );
  const handleCorporationsPrev = useCallback(
    () =>
      corporationsPageInfo?.hasPreviousPage &&
      setCorporationsPage((prev) => prev - 1),
    [corporationsPageInfo?.hasPreviousPage],
  );
  const handleCorporationsFirst = useCallback(() => setCorporationsPage(1), []);
  const handleCorporationsLast = useCallback(
    () =>
      corporationsTotalPages > 0 && setCorporationsPage(corporationsTotalPages),
    [corporationsTotalPages],
  );

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading alliance..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const alliance = data?.alliance;

  if (!alliance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Alliance not found</div>
      </div>
    );
  }

  // Delta verilerini al (haftalık değişim)
  const memberDelta7d = alliance.metrics?.memberCountDelta7d ?? null;
  const memberGrowthRate7d = alliance.metrics?.memberCountGrowthRate7d ?? null;

  // Map top ship targets from independent query (killed ships)
  const topShipTargets =
    shipTargetsData?.allianceTopShipTargets?.map((ship) => ({
      id: ship.shipType.id,
      name: ship.shipType.name,
      killCount: ship.killCount,
      dogmaAttributes: ship.shipType.dogmaAttributes,
    })) || [];

  // Map top attacker ships from independent query (used ships)
  const topAttackerShips =
    shipsData?.allianceTopShips?.map((ship) => ({
      id: ship.shipType.id,
      name: ship.shipType.name,
      killCount: ship.killCount,
      dogmaAttributes: ship.shipType.dogmaAttributes,
    })) || [];

  // Map alliance targets from independent query
  const allianceTargets =
    allianceTargetsData?.allianceTopAllianceTargets?.map((target) => ({
      id: target.alliance.id,
      name: target.alliance.name,
      count: target.killCount,
    })) || [];

  // Map corporation targets from independent query
  const corporationTargets =
    corporationTargetsData?.allianceTopCorporationTargets?.map((target) => ({
      id: target.corporation.id,
      name: target.corporation.name,
      count: target.killCount,
    })) || [];

  // Map top characters from independent query
  const topCharacters =
    topCharactersData?.allianceTopCharacters?.map((target) => ({
      id: target.character.id,
      name: target.character.name,
      killCount: target.killCount,
      securityStatus: target.character.securityStatus,
      corporation: target.character.corporation
        ? {
            id: target.character.corporation.id,
            name: target.character.corporation.name,
          }
        : null,
      alliance: target.character.alliance
        ? {
            id: target.character.alliance.id,
            name: target.character.alliance.name,
          }
        : null,
    })) || [];

  return (
    <main>
      <div className="card p-6 flex flex-col">
        {/* Logo and Alliance Name */}
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center justify-center gap-6">
            <img
              src={`https://images.evetech.net/Alliance/${alliance.id}_128.png`}
              alt={alliance.name}
              width={128}
              height={128}
              className="shadow-md"
            />
            <div className="flex-1">
              <h1 className="text-4xl font-bold">{alliance.name}</h1>
              <div className="mt-2">
                <span className="py-1 text-base font-bold text-yellow-400">
                  [{alliance.ticker}]
                </span>
              </div>
            </div>
          </div>

          {/* Metric Container */}
          <div className="flex items-center gap-4">
            {/*  member count */}
            <TotalMemberBadge count={alliance.memberCount} />
            {/* corporation count */}
            <TotalCorporationBadge count={alliance.corporationCount} />
            {/* member delta 7d */}
            <MemberDeltaBadge
              memberDelta={memberDelta7d}
              memberGrowthRate={memberGrowthRate7d}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-white/10">
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
                {TAB_LABELS[tabId]}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'attributes' && (
            <div
              role="tabpanel"
              id="panel-attributes"
              aria-labelledby="tab-attributes"
              className="detail-tab-content"
            >
              <h2 className="mb-4 text-2xl font-bold">Attributes</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Executor</span>
                  <span className="ml-2 font-semibold">
                    {alliance.executor ? (
                      <Link
                        href={`/corporations/${alliance.executor.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {alliance.executor.name}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Short Name</span>
                  <span className="ml-2 font-semibold">{alliance.ticker}</span>
                </div>
                <div>
                  <span className="text-gray-400">Created By Corporation</span>
                  <span className="ml-2 font-semibold">
                    {alliance.createdByCorporation ? (
                      <Link
                        href={`/corporations/${alliance.createdByCorporation.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {alliance.createdByCorporation.name}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Created By</span>
                  <span className="ml-2 font-semibold">
                    {alliance.createdBy ? (
                      <Link
                        href={`/characters/${alliance.createdBy.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {alliance.createdBy.name}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Start Date:</span>
                  <span className="ml-2 font-semibold">
                    {new Date(alliance.date_founded).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'growth' && (
            <div
              role="tabpanel"
              id="panel-growth"
              aria-labelledby="tab-growth"
              className="detail-tab-content"
            >
              <AllianceGrowthChart
                snapshots={growthData?.alliance?.snapshots ?? []}
                loading={growthLoading}
              />
            </div>
          )}

          {activeTab === 'killmails' && (
            <div
              role="tabpanel"
              id="panel-killmails"
              aria-labelledby="tab-killmails"
              className="killmails-tab"
            >
              <h2 className="sr-only">Killmails</h2>

              {/* 2-column grid layout */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {/* Left side - Killmails Table (takes 3 columns) */}
                <div className="lg:col-span-3">
                  <KillmailsTable
                    killmails={killmails}
                    loading={killmailsLoading}
                    allianceId={parseInt(id)}
                    dateCountsMap={dateCountsMap}
                    totalCount={pageInfo?.totalCount}
                  />

                  {killmails.length > 0 && (
                    <div className="mt-6">
                      <Paginator
                        hasNextPage={pageInfo?.hasNextPage ?? false}
                        hasPrevPage={pageInfo?.hasPreviousPage ?? false}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        onFirst={handleFirst}
                        onLast={handleLast}
                        loading={killmailsLoading}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        onPageSizeChange={(size) => {
                          setPageSize(size);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Right side - Top Targets Cards */}
                <div className="space-y-6 lg:col-span-1 lg:-mt-9">
                  <TopCharacterCard
                    title="Most Active Pilots"
                    subtitle={<>Last 7 days</>}
                    characters={topCharacters}
                    emptyText="No pilots yet"
                    loading={topCharactersLoading}
                  />

                  <TopShipsCard
                    title="Most Used Ships"
                    subtitle={<>Last 7 days</>}
                    ships={topAttackerShips}
                    emptyText="No ships used yet"
                    loading={shipsLoading}
                  />

                  <TopTargetsCard
                    title="Most Killed Alliances"
                    subtitle={<>Last 7 days</>}
                    targets={allianceTargets}
                    targetType="alliance"
                    linkPrefix="/alliances"
                    emptyText="No alliance targets yet"
                    loading={allianceTargetsLoading}
                  />

                  <TopTargetsCard
                    title="Most Killed Corporations"
                    subtitle={<>Last 7 days</>}
                    targets={corporationTargets}
                    targetType="corporation"
                    linkPrefix="/corporations"
                    emptyText="No corporation targets yet"
                    loading={corporationTargetsLoading}
                  />

                  <TopShipsCard
                    title="Most Killed Ships"
                    subtitle={<>Last 7 days</>}
                    ships={topShipTargets}
                    emptyText="No ships killed yet"
                    loading={shipTargetsLoading}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'war-history' && (
            <div
              role="tabpanel"
              id="panel-war-history"
              aria-labelledby="tab-war-history"
              className="detail-tab-content"
            >
              <h2 className="mb-4 text-2xl font-bold">War History</h2>
              <p className="text-gray-300">
                War history information will be displayed here.
              </p>
            </div>
          )}

          {activeTab === 'members' && (
            <div
              role="tabpanel"
              id="panel-members"
              aria-labelledby="tab-members"
              className="alliance-corporations-tab"
            >
              <div className="sm:flex-auto">
                <h2 className="sr-only">Member Corporations</h2>
                {corporationsPageInfo?.totalCount !== undefined && (
                  <p className="text-sm text-gray-400">
                    Total: {corporationsPageInfo.totalCount.toLocaleString()}{' '}
                    corporations
                  </p>
                )}
              </div>
              {/* Member Corporation Table  */}
              <CorporationTable
                corporations={corporations}
                loading={corporationsLoading}
              />
              {corporations.length > 0 && (
                <div className="mt-6">
                  <Paginator
                    hasNextPage={corporationsPageInfo?.hasNextPage ?? false}
                    hasPrevPage={corporationsPageInfo?.hasPreviousPage ?? false}
                    onNext={handleCorporationsNext}
                    onPrev={handleCorporationsPrev}
                    onFirst={handleCorporationsFirst}
                    onLast={handleCorporationsLast}
                    loading={corporationsLoading}
                    currentPage={corporationsPage}
                    totalPages={corporationsTotalPages}
                    pageSize={corporationsPageSize}
                    onPageSizeChange={(size) => {
                      setCorporationsPageSize(size);
                      setCorporationsPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
