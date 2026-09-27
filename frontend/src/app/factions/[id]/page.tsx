'use client';

import CorporationTable from '@/components/CorporationsTable/CorporationsTable';
import KillmailsTable from '@/components/KillmailsTable';
import { Loader } from '@/components/Loader/Loader';
import Paginator from '@/components/Paginator/Paginator';
import SovSystemBadge from '@/components/SovSystemBadge/SovSystemBadge';
import TopCharacterCard from '@/components/TopCharacterCard/TopCharacterCard';
import TopShipsCard from '@/components/TopShipsCard';
import TopTargetsCard from '@/components/TopTargetsCard';
import TotalCorporationBadge from '@/components/TotalCorporationMember/TotalCorporationBadge';
import TotalMemberBadge from '@/components/TotalMemberBadge/TotalMemberBadge';
import EveImage from '@/components/ui/EveImage';
import {
  CorporationOrderBy,
  TopTargetFilter,
  useFactionCorporationsQuery,
  useFactionKillmailsQuery,
  useFactionQuery,
  useFactionTopCharactersQuery,
  useFactionTopCorporationsQuery,
  useFactionTopFactionTargetsQuery,
  useFactionTopShipsQuery,
  useFactionTopShipTargetsQuery,
  useKillmailsDateCountsQuery,
} from '@/generated/graphql';
import { useTabList } from '@/hooks/useTabList';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

interface FactionDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'attributes' | 'killmails' | 'members';

const TAB_IDS: TabType[] = ['attributes', 'killmails', 'members'];

const TAB_LABELS: Record<TabType, string> = {
  attributes: 'Attributes',
  killmails: 'Killmails',
  members: 'Members',
};

export default function FactionDetailPage({ params }: FactionDetailPageProps) {
  const { id } = use(params);
  const factionId = parseInt(id);
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get('page')) || 1;
  const pageSizeFromUrl = Number(searchParams.get('pageSize')) || 25;
  const tabFromUrl = (searchParams.get('tab') as TabType) || 'attributes';

  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);
  const { onKeyDown } = useTabList(TAB_IDS, activeTab, setActiveTab);

  const [corporationsPage, setCorporationsPage] = useState(1);
  const [corporationsPageSize, setCorporationsPageSize] = useState(100);

  const { data, loading, error } = useFactionQuery({
    variables: { id: factionId },
  });

  const statsVariables = { factionId, filter: TopTargetFilter.Last_7Days };

  const { data: topCharactersData, loading: topCharactersLoading } =
    useFactionTopCharactersQuery({ variables: statsVariables });

  const { data: topCorporationsData, loading: topCorporationsLoading } =
    useFactionTopCorporationsQuery({ variables: statsVariables });

  const { data: shipsData, loading: shipsLoading } = useFactionTopShipsQuery({
    variables: statsVariables,
  });

  const { data: factionTargetsData, loading: factionTargetsLoading } =
    useFactionTopFactionTargetsQuery({ variables: statsVariables });

  const { data: shipTargetsData, loading: shipTargetsLoading } =
    useFactionTopShipTargetsQuery({ variables: statsVariables });

  const { data: corporationsData, loading: corporationsLoading } =
    useFactionCorporationsQuery({
      variables: {
        filter: {
          factionId,
          page: corporationsPage,
          limit: corporationsPageSize,
          orderBy: CorporationOrderBy.MemberCountDesc,
        },
      },
      skip: activeTab !== 'members',
    });

  const { data: killmailsData, loading: killmailsLoading } =
    useFactionKillmailsQuery({
      variables: {
        filter: { factionId, page: currentPage, limit: pageSize },
      },
      skip: activeTab !== 'killmails',
    });

  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: { filter: { factionId } },
    skip: activeTab !== 'killmails',
  });

  const killmails = useMemo(
    () => killmailsData?.killmails.items || [],
    [killmailsData],
  );

  const corporations = useMemo(
    () => corporationsData?.corporations.items || [],
    [corporationsData],
  );

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
    router.push(`/factions/${id}?${params.toString()}`, { scroll: false });
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
    return <Loader fullHeight size="lg" text="Loading faction..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-danger">Error: {error.message}</div>
      </div>
    );
  }

  const faction = data?.faction;

  if (!faction) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Faction not found</div>
      </div>
    );
  }

  const topCharacters =
    topCharactersData?.factionTopCharacters?.map((target) => ({
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

  const topCorporations =
    topCorporationsData?.factionTopCorporations?.map((target) => ({
      id: target.corporation.id,
      name: target.corporation.name,
      count: target.killCount,
    })) || [];

  const topShips =
    shipsData?.factionTopShips?.map((ship) => ({
      id: ship.shipType.id,
      name: ship.shipType.name,
      killCount: ship.killCount,
      dogmaAttributes: ship.shipType.dogmaAttributes,
    })) || [];

  const factionTargets =
    factionTargetsData?.factionTopFactionTargets?.map((target) => ({
      id: target.faction.id,
      name: target.faction.name,
      count: target.killCount,
    })) || [];

  const topShipTargets =
    shipTargetsData?.factionTopShipTargets?.map((ship) => ({
      id: ship.shipType.id,
      name: ship.shipType.name,
      killCount: ship.killCount,
      dogmaAttributes: ship.shipType.dogmaAttributes,
    })) || [];

  return (
    <main>
      <div className="card p-6 flex flex-col">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center justify-center gap-6">
            {/* Faction emblems are served from the corporation path; see TopFactionsCard. */}
            <EveImage
              kind="corporation"
              id={faction.id}
              name={faction.name}
              size={128}
              className="shadow-md"
            />
            <div className="flex-1">
              <h1 className="text-4xl font-bold">{faction.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <TotalCorporationBadge count={faction.memberCorporationCount} />
            <TotalMemberBadge count={faction.memberCharacterCount} />
            <SovSystemBadge count={faction.sovereigntySystemCount} />
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
              {TAB_LABELS[tabId]}
            </button>
          ))}
        </nav>

        {activeTab === 'attributes' && (
          <div
            role="tabpanel"
            id="panel-attributes"
            aria-labelledby="tab-attributes"
            className="detail-tab-content"
          >
            <h2 className="mb-4 text-2xl font-bold">Attributes</h2>
            {faction.description && (
              <p className="mb-6 whitespace-pre-line text-ink-muted">
                {faction.description}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-ink-muted">Home System</span>
                <span className="ml-2 font-medium">
                  {faction.solarSystem ? (
                    <Link
                      href={`/solar-systems/${faction.solarSystem.id}`}
                      prefetch={false}
                      className="text-ink-muted hover:text-accent-link"
                    >
                      {faction.solarSystem.name}
                    </Link>
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Stations</span>
                <span className="ml-2 font-medium">
                  {faction.stationCount ?? 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Corporation</span>
                <span className="ml-2 font-medium">
                  {faction.corporation ? (
                    <Link
                      href={`/corporations/${faction.corporation.id}`}
                      prefetch={false}
                      className="text-ink-muted hover:text-accent-link"
                    >
                      {faction.corporation.name}
                    </Link>
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Systems With Stations</span>
                <span className="ml-2 font-medium">
                  {faction.stationSystemCount ?? 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Militia Corporation</span>
                <span className="ml-2 font-medium">
                  {faction.militiaCorporation ? (
                    <Link
                      href={`/corporations/${faction.militiaCorporation.id}`}
                      prefetch={false}
                      className="text-ink-muted hover:text-accent-link"
                    >
                      {faction.militiaCorporation.name}
                    </Link>
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
            </div>
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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
              <div className="lg:col-span-3">
                <KillmailsTable
                  killmails={killmails}
                  loading={killmailsLoading}
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

              {/* lg:mt-10 lines the first card up with the first killmail, as on the alliance page. */}
              <div className="space-y-6 lg:col-span-1 lg:mt-10">
                <TopCharacterCard
                  title="Top Characters"
                  subtitle={<>Last 7 days</>}
                  characters={topCharacters}
                  emptyText="No pilots yet"
                  loading={topCharactersLoading}
                />

                <TopTargetsCard
                  title="Top Corporations"
                  subtitle={<>Last 7 days</>}
                  targets={topCorporations}
                  targetType="corporation"
                  linkPrefix="/corporations"
                  emptyText="No corporations yet"
                  loading={topCorporationsLoading}
                />

                <TopShipsCard
                  title="Top Ships"
                  subtitle={<>Last 7 days</>}
                  ships={topShips}
                  emptyText="No ships used yet"
                  loading={shipsLoading}
                />

                {/* targetType only picks the image path; faction emblems live under corporation. */}
                <TopTargetsCard
                  title="Top Target Factions"
                  subtitle={<>Last 7 days</>}
                  targets={factionTargets}
                  targetType="corporation"
                  linkPrefix="/factions"
                  emptyText="No faction targets yet"
                  loading={factionTargetsLoading}
                />

                <TopShipsCard
                  title="Top Target Ships"
                  subtitle={<>Last 7 days</>}
                  ships={topShipTargets}
                  emptyText="No ships killed yet"
                  loading={shipTargetsLoading}
                />
              </div>
            </div>
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
                <p className="text-sm text-ink-muted">
                  Total: {corporationsPageInfo.totalCount.toLocaleString()}{' '}
                  corporations
                </p>
              )}
            </div>
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
    </main>
  );
}
