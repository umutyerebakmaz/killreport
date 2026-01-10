"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import SolarSystemFilters from "@/components/Filters/SolarSystemFilters";
import Loader from "@/components/Loader";
import Paginator from "@/components/Paginator/Paginator";
import SecurityBadge from "@/components/SecurityStatus/SecurityStatus";
import { useSolarSystemsQuery } from "@/generated/graphql";
import { GlobeAltIcon, MapIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
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
      filters.constellation_id ? filters.constellation_id.toString() : ""
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

  const systems = data?.solarSystems.edges.map((edge) => edge.node) || [];
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
            <MapPinIcon className="w-8 h-8 text-orange-500" />
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
      {/* Table */}
      <div className="mt-6 overflow-hidden border border-white/10">
        <table className="table">
          <thead className="bg-white/5">
            <tr>
              <th className="th-cell">Solar System</th>
              <th className="th-cell">Constellation</th>
              <th className="th-cell">Region</th>
              <th className="th-cell">Security Status</th>
              <th className="th-cell">Security Class</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 rounded-full animate-spin border-cyan-500 border-t-transparent" />
                    Loading solar systems...
                  </div>
                </td>
              </tr>
            ) : systems.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No solar systems found
                </td>
              </tr>
            ) : (
              systems.map((system) => (
                <tr
                  key={system.id}
                  className="transition-colors hover:bg-white/5"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <MapPinIcon className="w-5 h-5 text-orange-500 shrink-0" />
                      <Link
                        href={`/solar-systems/${system.id}`}
                        prefetch={false}
                        className="font-medium text-orange-400 transition-colors hover:text-orange-300"
                      >
                        {system.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {system.constellation ? (
                      <Link
                        href={`/constellations/${system.constellation.id}`}
                        prefetch={false}
                        className="flex items-center gap-2 text-gray-300 transition-colors hover:text-cyan-400"
                      >
                        <MapIcon className="w-4 h-4 text-purple-500" />
                        {system.constellation.name}
                      </Link>
                    ) : (
                      <span className="text-gray-500">Unknown</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {system.constellation?.region ? (
                      <Link
                        href={`/regions/${system.constellation.region.id}`}
                        prefetch={false}
                        className="flex items-center gap-2 text-gray-300 transition-colors hover:text-cyan-400"
                      >
                        <GlobeAltIcon className="w-4 h-4 text-cyan-500" />
                        {system.constellation.region.name}
                      </Link>
                    ) : (
                      <span className="text-gray-500">Unknown</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <SecurityBadge securityStatus={system.security_status} />
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {system.security_class || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
