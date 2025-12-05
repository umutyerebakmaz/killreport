"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Paginator from "@/components/Paginator/Paginator";
import SecurityStatsBar from "@/components/SecurityBadge/SecurityStatsBar";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useConstellationsQuery } from "@/generated/graphql";
import { GlobeAltIcon, MapIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ConstellationsPage() {
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

  const { data, loading, error } = useConstellationsQuery({
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
    router.push(`/constellations?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, debouncedSearch]);

  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;

  const constellations =
    data?.constellations.edges.map((edge) => edge.node) || [];
  const pageInfo = data?.constellations.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  const handleNext = () =>
    pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1);
  const handlePrev = () =>
    pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1);
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => totalPages > 0 && setCurrentPage(totalPages);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mt-6">
        <div className="flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="Search constellations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="select-option-container">
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            className="select"
          >
            <option value="nameAsc">Name A-Z</option>
            <option value="nameDesc">Name Z-A</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden border border-white/10">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Constellation
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Region
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-orange-400" />
                  Systems
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[180px]">
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
                    {constellation.securityStats?.avgSecurity !== null &&
                    constellation.securityStats?.avgSecurity !== undefined ? (
                      <span
                        className={`${
                          constellation.securityStats.avgSecurity >= 0.5
                            ? "text-green-400"
                            : constellation.securityStats.avgSecurity > 0
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {constellation.securityStats.avgSecurity.toFixed(2)}
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
