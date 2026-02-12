"use client";

import AvgSecurity from "@/components/AvgSecurity/AvgSecurity";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import ConstellationFilters from "@/components/Filters/ConstellationFilters";
import Loader from "@/components/Loader";
import Paginator from "@/components/Paginator/Paginator";
import SecurityStatsBar from "@/components/SecurityStatus/SecurityStatsBar";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useConstellationsQuery } from "@/generated/graphql";
import { GlobeAltIcon, MapIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function ConstellationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "nameAsc";
  const searchFromUrl = searchParams.get("search") || "";
  const regionIdFromUrl = searchParams.get("regionId") || "";

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [selectedRegionId, setSelectedRegionId] =
    useState<string>(regionIdFromUrl);

  const { data, loading, error } = useConstellationsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: orderBy as any,
        search: searchTerm || undefined,
        region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
      },
    },
  });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("orderBy", orderBy);
    if (searchTerm) params.set("search", searchTerm);
    if (selectedRegionId) params.set("regionId", selectedRegionId);
    router.push(`/constellations?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, searchTerm, selectedRegionId]);

  const handleFilterChange = (filters: {
    search?: string;
    region_id?: number;
  }) => {
    setSearchTerm(filters.search || "");
    setSelectedRegionId(filters.region_id ? filters.region_id.toString() : "");
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedRegionId("");
    setCurrentPage(1);
  };

  const handleOrderByChange = (newOrderBy: string) => {
    setOrderBy(newOrderBy);
    setCurrentPage(1);
  };

  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;

  const constellations = data?.constellations.items || [];
  const pageInfo = data?.constellations.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const handleNext = () =>
    pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1);
  const handlePrev = () =>
    pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1);
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => totalPages > 0 && setCurrentPage(totalPages);

  return (
    <div>
      <Breadcrumb items={[{ label: "Constellations" }]} />

      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="flex items-center gap-3 text-3xl font-semibold text-white">
            <MapIcon className="w-8 h-8 text-purple-500" />
            Constellations
          </h1>
          <p className="mt-2 text-gray-400">
            Browse all constellations in New Eden. Each constellation contains
            multiple solar systems.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ConstellationFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          orderBy={orderBy}
          onOrderByChange={handleOrderByChange}
          initialSearch={searchTerm}
          initialRegionId={selectedRegionId}
        />
      </div>
      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-xs text-gray-400">
        <span className="font-medium text-gray-300">Security:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-full" />
          <span>High Sec (≥0.5)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
          <span>Low Sec (0.1-0.4)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <span>Null Sec (≤0.0)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-500 rounded-full" />
          <span>Wormhole</span>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden border border-white/10">
        <table className="table">
          <thead className="bg-white/5">
            <tr>
              <th className="th-cell">Constellation</th>
              <th className="th-cell">Region</th>
              <th className="th-cell">Systems</th>
              <th className="th-cell">Security Distribution</th>
              <th className="th-cell">Avg Security</th>
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
                    Loading constellations...
                  </div>
                </td>
              </tr>
            ) : constellations.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No constellations found
                </td>
              </tr>
            ) : (
              constellations.map((constellation) => (
                <tr
                  key={constellation.id}
                  className="transition-colors hover:bg-white/5"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <MapIcon className="w-5 h-5 text-purple-500" />
                      <Link
                        href={`/constellations/${constellation.id}`}
                        prefetch={false}
                        className="font-medium text-purple-500 transition-colors hover:text-purple-400"
                      >
                        {constellation.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {constellation.region ? (
                      <Link
                        href={`/regions/${constellation.region.id}`}
                        prefetch={false}
                        className="flex items-center gap-2 transition-colors text-cyan-500 hover:text-cyan-400"
                      >
                        <GlobeAltIcon className="w-4 h-4 text-cyan-500" />
                        {constellation.region.name}
                      </Link>
                    ) : (
                      <span className="text-gray-500">Unknown</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Tooltip
                      content="Solar systems in this constellation"
                      position="top"
                    >
                      <span className="font-medium text-orange-300">
                        {constellation.solarSystemCount}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-6 py-4">
                    {constellation.securityStats && (
                      <SecurityStatsBar
                        stats={{
                          highSec: constellation.securityStats.highSec,
                          lowSec: constellation.securityStats.lowSec,
                          nullSec: constellation.securityStats.nullSec,
                          wormhole: constellation.securityStats.wormhole,
                        }}
                        showLabels={false}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <AvgSecurity
                      avgSecurity={
                        constellation.securityStats?.avgSecurity ?? null
                      }
                    />
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

export default function ConstellationsPage() {
  return (
    <Suspense
      fallback={
        <Loader size="lg" text="Loading constellations..." className="p-8" />
      }
    >
      <ConstellationsContent />
    </Suspense>
  );
}
