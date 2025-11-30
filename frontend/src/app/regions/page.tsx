"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Paginator from "@/components/Paginator/Paginator";
import SecurityStatsBar from "@/components/SecurityBadge/SecurityStatsBar";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useRegionsQuery } from "@/generated/graphql";
import {
  ChevronDownIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  MapIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function RegionsPage() {
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

  const regions = data?.regions.edges.map((edge) => edge.node) || [];
  const pageInfo = data?.regions.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const handleNext = () =>
    pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1);
  const handlePrev = () =>
    pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1);
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => totalPages > 0 && setCurrentPage(totalPages);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Regions" }]} />

      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="flex items-center gap-3 text-3xl font-semibold text-white">
            <GlobeAltIcon className="w-8 h-8 text-cyan-500" />
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
            className="block w-full border-0 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder:text-gray-400 focus:bg-white/10 focus:outline-none sm:text-sm sm:leading-6"
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
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Region
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                <div className="flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-purple-400" />
                  Constellations
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-orange-400" />
                  Systems
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[200px]">
                Security Distribution
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Avg Security
              </th>
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
                    Loading regions...
                  </div>
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
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <GlobeAltIcon className="w-6 h-6 text-cyan-500 shrink-0" />
                      <div>
                        <Link
                          href={`/regions/${region.id}`}
                          className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                        >
                          {region.name}
                        </Link>
                        {region.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-xs">
                            {region.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Tooltip
                      content="Constellations in this region"
                      position="top"
                    >
                      <span className="font-medium text-purple-300">
                        {region.constellationCount}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-6 py-4">
                    <Tooltip
                      content="Solar systems in this region"
                      position="top"
                    >
                      <span className="font-medium text-orange-300">
                        {region.solarSystemCount}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4">
                    {region.securityStats?.avgSecurity !== null &&
                    region.securityStats?.avgSecurity !== undefined ? (
                      <span
                        className={`font-mono ${
                          region.securityStats.avgSecurity >= 0.5
                            ? "text-green-400"
                            : region.securityStats.avgSecurity > 0
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {region.securityStats.avgSecurity.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-purple-400">W-Space</span>
                    )}
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
