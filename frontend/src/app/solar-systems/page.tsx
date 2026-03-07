"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import SolarSystemCard from "@/components/Cards/SolarSystemCard";
import SolarSystemFilters from "@/components/Filters/SolarSystemFilters";
import { Loader } from "@/components/Loader/Loader";
import Paginator from "@/components/Paginator/Paginator";
import { useSolarSystemsQuery } from "@/generated/graphql";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function SolarSystemsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "nameAsc";
  const searchFromUrl = searchParams.get("search") || "";
  const securityFromUrl = searchParams.get("security") || "all";
  const regionIdFromUrl = searchParams.get("regionId") || "";
  const constellationIdFromUrl = searchParams.get("constellationId") || "";

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [securityFilter, setSecurityFilter] = useState(securityFromUrl);
  const [selectedRegionId, setSelectedRegionId] =
    useState<string>(regionIdFromUrl);
  const [selectedConstellationId, setSelectedConstellationId] =
    useState<string>(constellationIdFromUrl);
  const [securityStatusMin, setSecurityStatusMin] = useState<
    number | undefined
  >();
  const [securityStatusMax, setSecurityStatusMax] = useState<
    number | undefined
  >();

  const { data, loading, error } = useSolarSystemsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: orderBy as any,
        search: searchTerm || undefined,
        region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
        constellation_id: selectedConstellationId
          ? parseInt(selectedConstellationId)
          : undefined,
        securityStatusMin,
        securityStatusMax,
      },
    },
  });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("orderBy", orderBy);
    if (searchTerm) params.set("search", searchTerm);
    if (securityFilter !== "all") params.set("security", securityFilter);
    if (selectedRegionId) params.set("regionId", selectedRegionId);
    if (selectedConstellationId)
      params.set("constellationId", selectedConstellationId);
    router.push(`/solar-systems?${params.toString()}`, { scroll: false });
  }, [
    currentPage,
    orderBy,
    searchTerm,
    securityFilter,
    selectedRegionId,
    selectedConstellationId,
  ]);

  const handleFilterChange = (filters: {
    search?: string;
    region_id?: number;
    constellation_id?: number;
    securityStatusMin?: number;
    securityStatusMax?: number;
  }) => {
    setSearchTerm(filters.search || "");
    setSelectedRegionId(filters.region_id ? filters.region_id.toString() : "");
    setSelectedConstellationId(
      filters.constellation_id ? filters.constellation_id.toString() : "",
    );
    setSecurityStatusMin(filters.securityStatusMin);
    setSecurityStatusMax(filters.securityStatusMax);

    // Update security filter state for URL sync
    if (filters.securityStatusMin === 0.5) {
      setSecurityFilter("highsec");
    } else if (
      filters.securityStatusMin === 0.1 &&
      filters.securityStatusMax === 0.4
    ) {
      setSecurityFilter("lowsec");
    } else if (filters.securityStatusMax === 0.0) {
      setSecurityFilter("nullsec");
    } else {
      setSecurityFilter("all");
    }

    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedRegionId("");
    setSelectedConstellationId("");
    setSecurityFilter("all");
    setSecurityStatusMin(undefined);
    setSecurityStatusMax(undefined);
    setCurrentPage(1);
  };

  const handleOrderByChange = (newOrderBy: string) => {
    setOrderBy(newOrderBy);
    setCurrentPage(1);
  };

  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;

  const systems = data?.solarSystems.items || [];
  const pageInfo = data?.solarSystems.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const handleNext = () =>
    pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1);
  const handlePrev = () =>
    pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1);
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => totalPages > 0 && setCurrentPage(totalPages);

  return (
    <div>
      <Breadcrumb items={[{ label: "Solar Systems" }]} />

      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="flex items-center gap-3 text-3xl font-semibold text-white">
            Solar Systems
          </h1>
          <p className="mt-2 text-gray-400">
            Explore all solar systems in New Eden. Filter by security status to
            find specific areas.
          </p>
        </div>
      </div>
      <div className="mt-6">
        <SolarSystemFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          orderBy={orderBy}
          onOrderByChange={handleOrderByChange}
          initialSearch={searchTerm}
          initialRegionId={selectedRegionId}
          initialConstellationId={selectedConstellationId}
          initialSecurity={securityFilter}
        />
      </div>
      {/* Grid Layout */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" />
          </div>
        ) : systems.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 border rounded-lg border-white/10 bg-neutral-900">
            No solar systems found
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {systems.map((system) => (
              <SolarSystemCard key={system.id} system={system} />
            ))}
          </div>
        )}
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

export default function SolarSystemsPage() {
  return (
    <Suspense
      fallback={
        <Loader size="lg" text="Loading solar systems..." className="p-8" />
      }
    >
      <SolarSystemsContent />
    </Suspense>
  );
}
