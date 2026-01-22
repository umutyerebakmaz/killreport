"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import KillmailFilters from "@/components/Filters/KillmailFilters";
import KillmailsTable from "@/components/KillmailsTable";
import Loader from "@/components/Loader";
import Paginator from "@/components/Paginator/Paginator";
import {
  useKillmailsQuery,
  useNewKillmailSubscription,
} from "@/generated/graphql";
import { FireIcon } from "@heroicons/react/24/outline";
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

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [filters, setFilters] = useState<{
    shipTypeId?: number;
    regionId?: number;
    systemId?: number;
  }>({
    shipTypeId: shipTypeIdFromUrl,
  });
  const [newKillmails, setNewKillmails] = useState<any[]>([]);
  const [animatingKillmails, setAnimatingKillmails] = useState<Set<string>>(
    new Set(),
  );

  // Subscribe to new killmails
  const {
    data: subscriptionData,
    loading: subscriptionLoading,
    error: subscriptionError,
  } = useNewKillmailSubscription({
    skip: currentPage !== 1, // Only subscribe when on first page
  });

  // Debug subscription (removed for production performance)

  // Add new killmail to the list when received
  useEffect(() => {
    if (subscriptionData?.newKillmail && currentPage === 1) {
      const km = subscriptionData.newKillmail;

      setNewKillmails((prev) => {
        // Check if killmail already exists
        const exists = prev.some((k) => k.id === km.id);
        if (exists) return prev;

        // Add new killmail to the top of the list
        return [km, ...prev];
      });

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
  }, [subscriptionData, currentPage]);

  // Reset new killmails when filters change
  useEffect(() => {
    setNewKillmails([]);
  }, [currentPage, orderBy, filters]);

  const handleFilterChange = (newFilters: {
    shipTypeId?: number;
    regionId?: number;
    systemId?: number;
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
        regionId: filters.regionId,
        systemId: filters.systemId,
      },
    },
  });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("orderBy", orderBy);
    if (filters.shipTypeId) {
      params.set("shipTypeId", filters.shipTypeId.toString());
    }
    router.push(`/killmails?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, filters.shipTypeId, router]);

  // Memoize killmails array to prevent unnecessary recalculations
  const killmails = useMemo(
    () => [
      ...newKillmails, // Add new real-time killmails first
      ...(data?.killmails.edges.map((edge) => edge.node) || []),
    ],
    [newKillmails, data?.killmails.edges],
  );

  const pageInfo = data?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

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
            <FireIcon className="w-8 h-8 text-red-400" />
            Killmails
          </h1>
          <p className="mt-2 text-gray-400">
            Browse all killmails from New Eden. Click on a killmail to see
            detailed information.
          </p>
          {data?.killmails.pageInfo.totalCount !== undefined && (
            <p className="mt-1 text-sm text-gray-500">
              Total: {data.killmails.pageInfo.totalCount.toLocaleString()}{" "}
              killmails
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
        />
      </div>

      {/* Killmails Table */}
      <div className="mt-6">
        <KillmailsTable
          killmails={killmails}
          animatingKillmails={animatingKillmails}
          loading={loading}
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
