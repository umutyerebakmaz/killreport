"use client";

import AvgSecurity from "@/components/AvgSecurity/AvgSecurity";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import { Loader } from "@/components/Loader/Loader";
import Paginator from "@/components/Paginator/Paginator";
import SecurityStatsBar from "@/components/SecurityStatus/SecurityStatsBar";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useRegionsQuery } from "@/generated/graphql";
import {
  ChevronDownIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function RegionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "nameAsc";
  const searchFromUrl = searchParams.get("search") || "";

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, loading, error } = useRegionsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: orderBy as any,
        search: debouncedSearch || undefined,
      },
    },
  });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("orderBy", orderBy);
    if (debouncedSearch) params.set("search", debouncedSearch);
    router.push(`/regions?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, debouncedSearch]);

  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;

  const regions = data?.regions.items || [];
  const pageInfo = data?.regions.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const handleNext = () =>
    pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1);
  const handlePrev = () =>
    pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1);
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => totalPages > 0 && setCurrentPage(totalPages);

  return (
    <div>
      <Breadcrumb items={[{ label: "Regions" }]} />

      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="flex items-center gap-3 text-3xl font-semibold text-white">
            <GlobeAltIcon className="w-8 h-8 text-cyan-400" />
            Regions
          </h1>
          <p className="mt-2 text-gray-400">
            Explore all regions in New Eden. Click on a region to see its
            constellations and solar systems.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mt-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search regions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {/* OrderBy Dropdown */}
        <div className="select-option-container">
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            className="select"
          >
            <option value="nameAsc">Name A-Z</option>
            <option value="nameDesc">Name Z-A</option>
          </select>
          <ChevronDownIcon className="chevron-down-icon" />
        </div>
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
              <th className="th-cell">Region</th>
              <th className="th-cell">Constellations</th>
              <th className="th-cell">Systems</th>
              <th className="th-cell">Security Distribution</th>
              <th className="th-cell">Avg Security</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12">
                  <Loader size="md" text="Loading regions..." />
                </td>
              </tr>
            ) : regions.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No regions found
                </td>
              </tr>
            ) : (
              regions.map((region) => (
                <tr
                  key={region.id}
                  className="transition-colors hover:bg-white/5"
                >
                  <td className="px-6 py-4 text-base">
                    <div className="flex items-center gap-3">
                      <GlobeAltIcon className="w-5 h-5 text-cyan-500" />
                      <Link
                        href={`/regions/${region.id}`}
                        prefetch={false}
                        className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                      >
                        {region.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-base">
                    <Tooltip
                      content="Constellations in this region"
                      position="top"
                    >
                      <span className="font-medium text-purple-400">
                        {region.constellationCount}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-6 py-4 text-base">
                    <Tooltip
                      content="Solar systems in this region"
                      position="top"
                    >
                      <span className="font-medium text-orange-400">
                        {region.solarSystemCount}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-6 py-4 text-base">
                    {region.securityStats && (
                      <SecurityStatsBar
                        stats={{
                          highSec: region.securityStats.highSec,
                          lowSec: region.securityStats.lowSec,
                          nullSec: region.securityStats.nullSec,
                          wormhole: region.securityStats.wormhole,
                        }}
                        showLabels={false}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 text-base">
                    <AvgSecurity
                      avgSecurity={region.securityStats?.avgSecurity ?? null}
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

export default function RegionsPage() {
  return (
    <Suspense
      fallback={<Loader size="lg" text="Loading regions..." className="p-8" />}
    >
      <RegionsContent />
    </Suspense>
  );
}
