'use client';

import KillmailFilters from '@/components/Filters/KillmailFilters';
import KillmailsTable from '@/components/KillmailsTable';
import Loader from '@/components/Loader';
import MostValuableCarousel from '@/components/MostValuableCarousel/MostValuableCarousel';
import Paginator from '@/components/Paginator/Paginator';
import TopEntitySidebar, {
  TopEntityCardSpec,
} from '@/components/TopEntitySidebar/TopEntitySidebar';
import PageHeader from '@/components/ui/PageHeader';
import type { Killmail } from '@/components/KillmailsTable/types';
import {
  KillmailOrderBy,
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
  useNewKillmailSubscription,
} from '@/generated/graphql';
import {
  buildKillmailFiltersUrl,
  parseKillmailFiltersFromUrl,
  type KillmailFilters as KillmailFilterValues,
} from '@/utils/filterUrlHelpers';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

const SIDEBAR_CARDS: TopEntityCardSpec[] = [
  {
    kind: 'characters',
    title: 'Most Active Pilots',
    emptyText: 'No pilot data available',
  },
  {
    kind: 'corporations',
    title: 'Most Active Corporations',
    emptyText: 'No corporation data available',
  },
  {
    kind: 'alliances',
    title: 'Most Active Alliances',
    emptyText: 'No alliance data available',
  },
  {
    kind: 'attackerShips',
    title: 'Most Used Ships',
    emptyText: 'No ship data available',
  },
  {
    kind: 'ships',
    title: 'Most Killed Ships',
    emptyText: 'No ship data available',
  },
];

function KillmailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse all filters from URL
  const urlFilters = useMemo(() => {
    return parseKillmailFiltersFromUrl(searchParams);
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState(urlFilters.page);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<KillmailFilterValues>({
    characterId: urlFilters.characterId,
    shipTypeId: urlFilters.shipTypeId,
    shipGroupIds: urlFilters.shipGroupIds,
    regionId: urlFilters.regionId,
    systemId: urlFilters.systemId,
    constellationId: urlFilters.constellationId,
    securitySpace: urlFilters.securitySpace,
    minAttackers: urlFilters.minAttackers,
    maxAttackers: urlFilters.maxAttackers,
    minValue: urlFilters.minValue,
    maxValue: urlFilters.maxValue,
    victim: urlFilters.victim,
    attacker: urlFilters.attacker,
    characterVictim: urlFilters.characterVictim,
    characterAttacker: urlFilters.characterAttacker,
    warRelated: urlFilters.warRelated,
  });
  const [newKillmails, setNewKillmails] = useState<Killmail[]>([]);
  const [animatingKillmails, setAnimatingKillmails] = useState<Set<string>>(
    new Set(),
  );
  const [realtimeDateCounts, setRealtimeDateCounts] = useState<
    Map<string, number>
  >(new Map());
  const [realtimeTotalCountIncrement, setRealtimeTotalCountIncrement] =
    useState(0);

  // A live killmail may not match an active filter, so the feed only runs on
  // the unfiltered first page.
  const hasActiveFilters = useMemo(
    () =>
      !!(
        filters.shipTypeId ||
        filters.shipGroupIds?.length ||
        filters.characterId ||
        filters.victim ||
        filters.attacker ||
        filters.characterVictim ||
        filters.characterAttacker ||
        filters.regionId ||
        filters.constellationId ||
        filters.systemId ||
        filters.securitySpace ||
        filters.minAttackers ||
        filters.maxAttackers ||
        filters.minValue ||
        filters.maxValue ||
        filters.warRelated
      ),
    [filters],
  );

  const resetRealtimeState = useCallback(() => {
    setNewKillmails([]);
    setRealtimeDateCounts(new Map());
    setRealtimeTotalCountIncrement(0);
  }, []);

  // Apollo pushes each new killmail through onData, so the list is updated from
  // the subscription callback rather than from an effect watching its result.
  useNewKillmailSubscription({
    skip: currentPage !== 1 || hasActiveFilters,
    ignoreResults: true,
    onData: ({ data }) => {
      const km = data.data?.newKillmail;
      if (!km) return;

      setNewKillmails((prev) =>
        prev.some((k) => k.id === km.id) ? prev : [km, ...prev],
      );

      // Update date count for the killmail's date
      const killmailDate = new Date(km.killmailTime)
        .toISOString()
        .split('T')[0];
      setRealtimeDateCounts((prev) => {
        const next = new Map(prev);
        next.set(killmailDate, (next.get(killmailDate) || 0) + 1);
        return next;
      });

      setRealtimeTotalCountIncrement((prev) => prev + 1);

      // Highlight the row, then drop it from the animating set again
      setAnimatingKillmails((prev) => new Set(prev).add(km.id));
      setTimeout(() => {
        setAnimatingKillmails((prev) => {
          const next = new Set(prev);
          next.delete(km.id);
          return next;
        });
      }, 3000);
    },
  });

  // Leaving the page the feed belongs to invalidates the buffered kills.
  const goToPage = useCallback(
    (page: number) => {
      if (page === currentPage) return;
      resetRealtimeState();
      setCurrentPage(page);
    },
    [currentPage, resetRealtimeState],
  );

  const handleFilterChange = (newFilters: KillmailFilterValues) => {
    setFilters(newFilters);
    resetRealtimeState();
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({});
    resetRealtimeState();
    setCurrentPage(1);
  };

  const { data, loading, error } = useKillmailsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: KillmailOrderBy.TimeDesc,
        shipTypeId: filters.shipTypeId,
        shipGroupIds: filters.shipGroupIds,
        characterId: filters.characterId,
        victim: filters.victim,
        attacker: filters.attacker,
        characterVictim: filters.characterVictim,
        characterAttacker: filters.characterAttacker,
        regionId: filters.regionId,
        constellationId: filters.constellationId,
        systemId: filters.systemId,
        securitySpace: filters.securitySpace,
        minAttackers: filters.minAttackers,
        maxAttackers: filters.maxAttackers,
        minValue: filters.minValue,
        maxValue: filters.maxValue,
        warRelated: filters.warRelated,
      },
    },
  });

  // Debug logging - replaces deprecated onCompleted callback
  useEffect(() => {
    if (data) {
      console.log('🔍 GraphQL Query Variables:', {
        shipTypeId: filters.shipTypeId,
        shipGroupIds: filters.shipGroupIds,
        victim: filters.victim,
        attacker: filters.attacker,
      });
      console.log('🔍 GraphQL Response:', {
        itemsCount: data?.killmails?.items?.length,
        totalCount: data?.killmails?.pageInfo?.totalCount,
      });
    }
  }, [data, filters]);

  // Fetch date counts for correct totals per date
  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: {
      filter: {
        shipTypeId: filters.shipTypeId,
        shipGroupIds: filters.shipGroupIds,
        characterId: filters.characterId,
        victim: filters.victim,
        attacker: filters.attacker,
        characterVictim: filters.characterVictim,
        characterAttacker: filters.characterAttacker,
        regionId: filters.regionId,
        constellationId: filters.constellationId,
        systemId: filters.systemId,
        securitySpace: filters.securitySpace,
        minAttackers: filters.minAttackers,
        maxAttackers: filters.maxAttackers,
        minValue: filters.minValue,
        maxValue: filters.maxValue,
        warRelated: filters.warRelated,
      },
    },
  });

  // URL sync
  useEffect(() => {
    const urlParams = buildKillmailFiltersUrl(currentPage, filters);
    router.push(`/killmails?${urlParams}`, { scroll: false });
  }, [currentPage, filters, router]);

  // Memoize killmails array to prevent unnecessary recalculations
  const killmails = useMemo(
    () => [
      ...newKillmails, // Add new real-time killmails first
      ...(data?.killmails.items || []),
    ],
    [newKillmails, data?.killmails.items],
  );

  // Create a map of date -> total count for that date
  // Merge backend data with realtime increments
  const dateCountsMap = useMemo(() => {
    const map = new Map<string, number>();

    // Start with backend data
    dateCountsData?.killmailsDateCounts.forEach((dc) => {
      map.set(dc.date, dc.count);
    });

    // Add realtime increments
    realtimeDateCounts.forEach((increment, date) => {
      map.set(date, (map.get(date) || 0) + increment);
    });

    return map;
  }, [dateCountsData, realtimeDateCounts]);

  const pageInfo = data?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  // Calculate total count with realtime increments
  const totalCount = useMemo(() => {
    const backendCount = pageInfo?.totalCount || 0;
    return backendCount + realtimeTotalCountIncrement;
  }, [pageInfo?.totalCount, realtimeTotalCountIncrement]);

  const handleNext = useCallback(
    () => pageInfo?.hasNextPage && goToPage(currentPage + 1),
    [pageInfo?.hasNextPage, goToPage, currentPage],
  );
  const handlePrev = useCallback(
    () => pageInfo?.hasPreviousPage && goToPage(currentPage - 1),
    [pageInfo?.hasPreviousPage, goToPage, currentPage],
  );
  const handleFirst = useCallback(() => goToPage(1), [goToPage]);
  const handleLast = useCallback(
    () => totalPages > 0 && goToPage(totalPages),
    [totalPages, goToPage],
  );

  // Handle error state
  if (error) {
    return (
      <div>
        <div className="p-8 text-red-500">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div>
      {/* New Killmail Toast Stack */}
      {/* <KillmailToastContainer
        toasts={killmailToasts}
        onDismiss={handleDismissToast}
      /> */}

      <PageHeader
        title="Killmails"
        description="Browse all killmails from New Eden. Click on a killmail to see detailed information."
        meta={
          totalCount > 0
            ? `${totalCount.toLocaleString()} killmails`
            : undefined
        }
      />

      {/* Filters */}
      <div className="mt-8">
        <KillmailFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          initialShipTypeId={urlFilters.shipTypeId}
          initialShipGroupIds={urlFilters.shipGroupIds}
          initialCharacterId={urlFilters.characterId}
          initialSystemId={urlFilters.systemId}
          initialConstellationId={urlFilters.constellationId}
          initialRegionId={urlFilters.regionId}
          initialMinAttackers={urlFilters.minAttackers}
          initialMaxAttackers={urlFilters.maxAttackers}
          initialMinValue={urlFilters.minValue}
          initialMaxValue={urlFilters.maxValue}
          initialShipRole={urlFilters.shipTypeRole}
          initialCharacterRole={urlFilters.characterRole}
          initialSecuritySpace={urlFilters.securitySpaceRole}
          initialWarRelated={urlFilters.warRelated}
        />
      </div>

      <div className="mt-8">
        <MostValuableCarousel />
      </div>

      {/* 2-column grid layout */}
      <div className="grid grid-cols-1 gap-6 mt-8 lg:grid-cols-4">
        {/* Left side - Killmails Table (takes 3 columns) */}
        <div className="lg:col-span-3">
          <KillmailsTable
            killmails={killmails}
            animatingKillmails={animatingKillmails}
            loading={loading}
            dateCountsMap={dateCountsMap}
            variant="list"
          />

          <div className="mt-6">
            <Paginator
              hasNextPage={pageInfo?.hasNextPage ?? false}
              hasPrevPage={pageInfo?.hasPreviousPage ?? false}
              onNext={handleNext}
              onPrev={handlePrev}
              onFirst={handleFirst}
              onLast={handleLast}
              loading={loading}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                goToPage(1);
              }}
            />
          </div>
        </div>

        {/* Right side - Sidebar */}
        <div className="lg:col-span-1 lg:-mt-11">
          <TopEntitySidebar cards={SIDEBAR_CARDS} variant="list" />
        </div>
      </div>
    </div>
  );
}

export default function KillmailsPage() {
  return (
    <Suspense
      fallback={
        <Loader size="lg" text="Loading killmails..." className="p-8" />
      }
    >
      <KillmailsContent />
    </Suspense>
  );
}
