"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import KillmailFilters from "@/components/Filters/KillmailFilters";
import KillmailCarousel from "@/components/KillmailCarousel/KillmailCarousel";
import KillmailsTable from "@/components/KillmailsTable";
import Loader from "@/components/Loader";
import Paginator from "@/components/Paginator/Paginator";
import TopAllianceCard from "@/components/TopAllianceCard/TopAllianceCard";
import TopCharacterCard from "@/components/TopCharacterCard/TopCharacterCard";
import TopCorporationCard from "@/components/TopCorporationCard/TopCorporationCard";
import TopShipsCard from "@/components/TopShipsCard/TopShipsCard";
import {
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
  useNewKillmailSubscription,
  useTopLast7DaysAlliancesQuery,
  useTopLast7DaysAttackerShipsQuery,
  useTopLast7DaysCorporationsQuery,
  useTopLast7DaysPilotsQuery,
  useTopLast7DaysShipsQuery,
} from "@/generated/graphql";
import {
  buildKillmailFiltersUrl,
  parseKillmailFiltersFromUrl,
} from "@/utils/filterUrlHelpers";
import { CAPSULE_GROUPS, STRUCTURE_GROUPS } from "@/utils/shipGroups";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

function KillmailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse all filters from URL
  const urlFilters = useMemo(() => {
    return parseKillmailFiltersFromUrl(searchParams);
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState(urlFilters.page);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<{
    shipTypeId?: number;
    shipGroupIds?: number[];
    characterId?: number;
    victim?: boolean;
    attacker?: boolean;
    characterVictim?: boolean;
    characterAttacker?: boolean;
    regionId?: number;
    constellationId?: number;
    systemId?: number;
    securitySpace?: string;
    minAttackers?: number;
    maxAttackers?: number;
    minValue?: number;
    maxValue?: number;
  }>({
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
  });
  const [newKillmails, setNewKillmails] = useState<any[]>([]);
  const [animatingKillmails, setAnimatingKillmails] = useState<Set<string>>(
    new Set(),
  );
  const [realtimeDateCounts, setRealtimeDateCounts] = useState<
    Map<string, number>
  >(new Map());
  const [realtimeTotalCountIncrement, setRealtimeTotalCountIncrement] =
    useState(0);

  // Fetch last 7 days top characters for sidebar (rolling data)
  const { data: weeklyPilotsData, loading: weeklyPilotsLoading } =
    useTopLast7DaysPilotsQuery({
      variables: { filter: { limit: 10 } },
    });

  // Fetch last 7 days top corporations for sidebar (rolling data)
  const { data: weeklyCorporationsData, loading: weeklyCorporationsLoading } =
    useTopLast7DaysCorporationsQuery({
      variables: { filter: { limit: 10 } },
    });

  // Fetch last 7 days top alliances for sidebar (rolling data)
  const { data: weeklyAlliancesData, loading: weeklyAlliancesLoading } =
    useTopLast7DaysAlliancesQuery({
      variables: { filter: { limit: 10 } },
    });

  // Fetch last 7 days top ships for sidebar (rolling data)
  const { data: weeklyShipsData, loading: weeklyShipsLoading } =
    useTopLast7DaysShipsQuery({
      variables: { filter: { limit: 10 } },
    });

  // Fetch last 7 days top attacker ships for sidebar (rolling data)
  const { data: weeklyAttackerShipsData, loading: weeklyAttackerShipsLoading } =
    useTopLast7DaysAttackerShipsQuery({
      variables: { filter: { limit: 10 } },
    });

  // Calculate date 7 days ago for carousels
  const sevenDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString();
  }, []);
  const today = useMemo(() => new Date().toISOString(), []);

  // Most Valuable Structures - Last 7 Days (for carousel)
  const { data: structuresData, loading: structuresLoading } =
    useKillmailsQuery({
      variables: {
        filter: {
          shipGroupIds: STRUCTURE_GROUPS,
          orderBy: "valueDesc" as any,
          limit: 20,
          startDate: sevenDaysAgo,
          endDate: today,
        },
      },
    });

  // Most Valuable Ships - Last 7 Days (for carousel, will filter out structures and capsules)
  const { data: allShipsData, loading: shipsLoading } = useKillmailsQuery({
    variables: {
      filter: {
        orderBy: "valueDesc" as any,
        limit: 50, // Get more to have enough after filtering
        startDate: sevenDaysAgo,
        endDate: today,
      },
    },
  });

  // Filter out structures and capsules from ships data
  const shipsData = useMemo(() => {
    if (!allShipsData?.killmails?.items) return [];

    const excludedGroupIds = [...STRUCTURE_GROUPS, ...CAPSULE_GROUPS];
    return allShipsData.killmails.items
      .filter((km) => {
        const shipGroupId = km.victim?.shipType?.group?.id;
        if (!shipGroupId) return false;
        return !excludedGroupIds.includes(shipGroupId);
      })
      .slice(0, 20) as any[]; // Take only top 20 after filtering
  }, [allShipsData]);

  // Subscribe to new killmails only when on first page and no filters are active
  const {
    data: subscriptionData,
    loading: subscriptionLoading,
    error: subscriptionError,
  } = useNewKillmailSubscription({
    skip:
      currentPage !== 1 ||
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
        filters.minAttackers ||
        filters.maxAttackers ||
        filters.minValue ||
        filters.maxValue
      ), // Skip if not on first page OR filters are active
  });

  // Debug subscription (removed for production performance)

  // Add new killmail to the list when received (only if no filters are active)
  useEffect(() => {
    if (
      subscriptionData?.newKillmail &&
      currentPage === 1 &&
      !filters.shipTypeId &&
      !filters.shipGroupIds?.length &&
      !filters.characterId &&
      !filters.victim &&
      !filters.attacker &&
      !filters.characterVictim &&
      !filters.characterAttacker &&
      !filters.regionId &&
      !filters.constellationId &&
      !filters.systemId &&
      !filters.minAttackers &&
      !filters.maxAttackers &&
      !filters.minValue &&
      !filters.maxValue
    ) {
      const km = subscriptionData.newKillmail;

      setNewKillmails((prev) => {
        // Check if killmail already exists
        const exists = prev.some((k) => k.id === km.id);
        if (exists) return prev;

        // Add new killmail to the top of the list
        return [km, ...prev];
      });

      // Update date count for the killmail's date
      const killmailDate = new Date(km.killmailTime)
        .toISOString()
        .split("T")[0];
      setRealtimeDateCounts((prev) => {
        const next = new Map(prev);
        next.set(killmailDate, (next.get(killmailDate) || 0) + 1);
        return next;
      });

      // Increment total count
      setRealtimeTotalCountIncrement((prev) => prev + 1);

      // Add to animating set
      setAnimatingKillmails((prev) => new Set(prev).add(km.id));

      // Remove from animating set after animation completes
      setTimeout(() => {
        setAnimatingKillmails((prev) => {
          const next = new Set(prev);
          next.delete(km.id);
          return next;
        });
      }, 3000);
    }
  }, [subscriptionData, currentPage, filters]);

  // Reset new killmails when filters change
  useEffect(() => {
    setNewKillmails([]);
    setRealtimeDateCounts(new Map());
    setRealtimeTotalCountIncrement(0);
  }, [currentPage, filters]);

  const handleFilterChange = (newFilters: {
    shipTypeId?: number;
    shipGroupIds?: number[];
    characterId?: number;
    victim?: boolean;
    attacker?: boolean;
    characterVictim?: boolean;
    characterAttacker?: boolean;
    regionId?: number;
    constellationId?: number;
    systemId?: number;
    minAttackers?: number;
    maxAttackers?: number;
    minValue?: number;
    maxValue?: number;
  }) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const { data, loading, error } = useKillmailsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: "timeDesc" as any,
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
      },
    },
  });

  // Debug logging - replaces deprecated onCompleted callback
  useEffect(() => {
    if (data) {
      console.log("🔍 GraphQL Query Variables:", {
        shipTypeId: filters.shipTypeId,
        shipGroupIds: filters.shipGroupIds,
        victim: filters.victim,
        attacker: filters.attacker,
      });
      console.log("🔍 GraphQL Response:", {
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
      },
    },
  });

  // URL sync
  useEffect(() => {
    const urlParams = buildKillmailFiltersUrl(currentPage, filters);
    router.push(`/killmails?${urlParams}`, { scroll: false });
  }, [
    currentPage,
    filters.characterId,
    filters.shipTypeId,
    filters.shipGroupIds,
    filters.victim,
    filters.attacker,
    filters.characterVictim,
    filters.characterAttacker,
    filters.systemId,
    filters.constellationId,
    filters.securitySpace,
    filters.minAttackers,
    filters.maxAttackers,
    filters.minValue,
    filters.maxValue,
    router,
  ]);

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

  // Handle error state
  if (error) {
    return (
      <div className="">
        <Breadcrumb items={[{ label: "Killmails" }]} />
        <div className="p-8 text-red-500">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="">
      <Breadcrumb items={[{ label: "Killmails" }]} />

      {/* New Killmail Toast Stack */}
      {/* <KillmailToastContainer
        toasts={killmailToasts}
        onDismiss={handleDismissToast}
      /> */}

      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="flex items-center gap-3 text-3xl font-semibold text-white">
            Killmails
          </h1>
          <p className="mt-2 text-gray-400">
            Browse all killmails from New Eden. Click on a killmail to see
            detailed information.
          </p>
          {totalCount > 0 && (
            <p className="mt-1 text-sm text-gray-400">
              {totalCount.toLocaleString()} killmails
            </p>
          )}
        </div>
      </div>

      {/* Most Valuable Carousels - Last 7 Days */}
      <div className="mt-8 space-y-6">
        <KillmailCarousel
          title="Most Valuable Ships"
          subtitle="Last 7 Days - Highest value ship kills"
          killmails={shipsData || []}
          loading={shipsLoading}
        />

        <KillmailCarousel
          title="Most Valuable Structures"
          subtitle="Last 7 Days - Citadels, Engineering Complexes, and Refineries"
          killmails={(structuresData?.killmails.items as any) || []}
          loading={structuresLoading}
        />
      </div>

      {/* Filters */}
      <div className="mt-6">
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
        />
      </div>

      {/* 2-column grid layout */}
      <div className="grid grid-cols-1 gap-6 mt-6 lg:grid-cols-4">
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
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Right side - Sidebar */}
        <div className="space-y-6 lg:col-span-1 lg:-mt-11">
          <TopCharacterCard
            title="Most Active Pilots"
            subtitle={
              <>
                Last 7 days{" "}
                <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                  ROLLING
                </span>
              </>
            }
            characters={
              weeklyPilotsData?.topLast7DaysPilots?.map((pilot) => ({
                id: pilot.character?.id || 0,
                name: pilot.character?.name || "Unknown",
                killCount: pilot.killCount,
                securityStatus: pilot.character?.securityStatus,
                corporation: pilot.character?.corporation
                  ? {
                      id: pilot.character.corporation.id,
                      name: pilot.character.corporation.name,
                    }
                  : null,
                alliance: pilot.character?.alliance
                  ? {
                      id: pilot.character.alliance.id,
                      name: pilot.character.alliance.name,
                    }
                  : null,
              })) || []
            }
            loading={weeklyPilotsLoading}
            emptyText="No pilot data available"
            variant="list"
          />
          <TopCorporationCard
            title="Most Active Corporations"
            subtitle={
              <>
                Last 7 days{" "}
                <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                  ROLLING
                </span>
              </>
            }
            corporations={
              weeklyCorporationsData?.topLast7DaysCorporations?.map((corp) => ({
                id: corp.corporation?.id || 0,
                name: corp.corporation?.name || "Unknown",
                ticker: corp.corporation?.ticker,
                killCount: corp.killCount,
              })) || []
            }
            loading={weeklyCorporationsLoading}
            emptyText="No corporation data available"
            variant="list"
          />
          <TopAllianceCard
            title="Most Active Alliances"
            subtitle={
              <>
                Last 7 days{" "}
                <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                  ROLLING
                </span>
              </>
            }
            alliances={
              weeklyAlliancesData?.topLast7DaysAlliances?.map((alliance) => ({
                id: alliance.alliance?.id || 0,
                name: alliance.alliance?.name || "Unknown",
                ticker: alliance.alliance?.ticker,
                killCount: alliance.killCount,
              })) || []
            }
            loading={weeklyAlliancesLoading}
            emptyText="No alliance data available"
            variant="list"
          />
          <TopShipsCard
            title="Most Used Ships"
            subtitle={
              <>
                Last 7 days{" "}
                <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                  ROLLING
                </span>
              </>
            }
            ships={
              weeklyAttackerShipsData?.topLast7DaysAttackerShips?.map(
                (ship) => ({
                  id: ship.shipType?.id || 0,
                  name: ship.shipType?.name || "Unknown",
                  killCount: ship.killCount,
                  dogmaAttributes: ship.shipType?.dogmaAttributes,
                }),
              ) || []
            }
            loading={weeklyAttackerShipsLoading}
            emptyText="No ship data available"
            variant="list"
          />
          <TopShipsCard
            title="Most Killed Ships"
            subtitle={
              <>
                Last 7 days{" "}
                <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                  ROLLING
                </span>
              </>
            }
            ships={
              weeklyShipsData?.topLast7DaysShips?.map((ship) => ({
                id: ship.shipType?.id || 0,
                name: ship.shipType?.name || "Unknown",
                killCount: ship.killCount,
                dogmaAttributes: ship.shipType?.dogmaAttributes,
              })) || []
            }
            loading={weeklyShipsLoading}
            emptyText="No ship data available"
            variant="list"
          />
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
