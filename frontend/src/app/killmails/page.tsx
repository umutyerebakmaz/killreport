"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import KillmailFilters from "@/components/Filters/KillmailFilters";
import KillmailsTable from "@/components/KillmailsTable";
import Loader from "@/components/Loader";
import Paginator from "@/components/Paginator/Paginator";
import {
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
  useNewKillmailSubscription,
} from "@/generated/graphql";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

function KillmailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "timeDesc";
  const shipTypeIdFromUrl = searchParams.get("shipTypeId")
    ? Number(searchParams.get("shipTypeId"))
    : undefined;
  const minAttackersFromUrl = searchParams.get("minAttackers")
    ? Number(searchParams.get("minAttackers"))
    : undefined;
  const maxAttackersFromUrl = searchParams.get("maxAttackers")
    ? Number(searchParams.get("maxAttackers"))
    : undefined;
  const minValueFromUrl = searchParams.get("minValue")
    ? Number(searchParams.get("minValue"))
    : undefined;
  const maxValueFromUrl = searchParams.get("maxValue")
    ? Number(searchParams.get("maxValue"))
    : undefined;
  const shipTypeRoleFromUrl =
    (searchParams.get("shipTypeRole") as
      | "all"
      | "victim"
      | "attacker"
      | null) ?? "all";

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const characterIdFromUrl = searchParams.get("characterId")
    ? Number(searchParams.get("characterId"))
    : undefined;

  const [filters, setFilters] = useState<{
    shipTypeId?: number;
    characterId?: number;
    victim?: boolean;
    attacker?: boolean;
    regionId?: number;
    systemId?: number;
    minAttackers?: number;
    maxAttackers?: number;
    minValue?: number;
    maxValue?: number;
  }>({
    characterId: characterIdFromUrl,
    shipTypeId: shipTypeIdFromUrl,
    minAttackers: minAttackersFromUrl,
    maxAttackers: maxAttackersFromUrl,
    minValue: minValueFromUrl,
    maxValue: maxValueFromUrl,
    victim:
      shipTypeIdFromUrl && shipTypeRoleFromUrl === "victim"
        ? true
        : shipTypeIdFromUrl && shipTypeRoleFromUrl === "attacker"
          ? false
          : undefined,
    attacker:
      shipTypeIdFromUrl && shipTypeRoleFromUrl === "attacker"
        ? true
        : shipTypeIdFromUrl && shipTypeRoleFromUrl === "victim"
          ? false
          : undefined,
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
        filters.regionId ||
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
      !filters.regionId &&
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
  }, [currentPage, orderBy, filters]);

  const handleFilterChange = (newFilters: {
    shipTypeId?: number;
    characterId?: number;
    victim?: boolean;
    attacker?: boolean;
    regionId?: number;
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
        orderBy: orderBy as any,
        shipTypeId: filters.shipTypeId,
        characterId: filters.characterId,
        victim: filters.victim,
        attacker: filters.attacker,
        regionId: filters.regionId,
        systemId: filters.systemId,
        minAttackers: filters.minAttackers,
        maxAttackers: filters.maxAttackers,
        minValue: filters.minValue,
        maxValue: filters.maxValue,
      },
    },
  });

  // Fetch date counts for correct totals per date
  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: {
      filter: {
        shipTypeId: filters.shipTypeId,
        characterId: filters.characterId,
        victim: filters.victim,
        attacker: filters.attacker,
        regionId: filters.regionId,
        systemId: filters.systemId,
        minAttackers: filters.minAttackers,
        maxAttackers: filters.maxAttackers,
        minValue: filters.minValue,
        maxValue: filters.maxValue,
      },
    },
  });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("orderBy", orderBy);
    if (filters.characterId)
      params.set("characterId", filters.characterId.toString());
    if (filters.shipTypeId) {
      params.set("shipTypeId", filters.shipTypeId.toString());
      if (filters.victim === true && filters.attacker === false)
        params.set("shipTypeRole", "victim");
      else if (filters.attacker === true && filters.victim === false)
        params.set("shipTypeRole", "attacker");
    }
    if (filters.minAttackers)
      params.set("minAttackers", filters.minAttackers.toString());
    if (filters.maxAttackers)
      params.set("maxAttackers", filters.maxAttackers.toString());
    if (filters.minValue) params.set("minValue", filters.minValue.toString());
    if (filters.maxValue) params.set("maxValue", filters.maxValue.toString());
    router.push(`/killmails?${params.toString()}`, { scroll: false });
  }, [
    currentPage,
    orderBy,
    filters.characterId,
    filters.shipTypeId,
    filters.victim,
    filters.attacker,
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
            <p className="mt-1 text-sm text-gray-500">
              {totalCount.toLocaleString()} killmails
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <KillmailFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          orderBy={orderBy}
          onOrderByChange={setOrderBy}
          initialShipTypeId={shipTypeIdFromUrl}
          initialCharacterId={characterIdFromUrl}
          initialMinAttackers={minAttackersFromUrl}
          initialMaxAttackers={maxAttackersFromUrl}
          initialMinValue={minValueFromUrl}
          initialMaxValue={maxValueFromUrl}
          initialRole={shipTypeRoleFromUrl}
        />
      </div>

      {/* Killmails Table */}
      <div className="mt-6">
        <KillmailsTable
          killmails={killmails}
          animatingKillmails={animatingKillmails}
          loading={loading}
          dateCountsMap={dateCountsMap}
        />
      </div>

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
