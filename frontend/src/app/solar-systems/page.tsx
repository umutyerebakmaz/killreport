"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Paginator from "@/components/Paginator/Paginator";
import SecurityBadge from "@/components/SecurityBadge/SecurityBadge";
import { useSolarSystemsQuery } from "@/generated/graphql";
import { GlobeAltIcon, MapIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SolarSystemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "nameAsc";
  const searchFromUrl = searchParams.get("search") || "";
  const securityFromUrl = searchParams.get("security") || "all";

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);
  const [securityFilter, setSecurityFilter] = useState(securityFromUrl);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Build filter based on security selection
  const getSecurityFilter = () => {
    switch (securityFilter) {
      case "highsec":
        return { securityStatusMin: 0.5 };
      case "lowsec":
        return { securityStatusMin: 0.1, securityStatusMax: 0.4 };
      case "nullsec":
        return { securityStatusMax: 0.0 };
      default:
        return {};
    }
  };

  const { data, loading, error } = useSolarSystemsQuery({
    variables: {
      filter: {
        page: currentPage,
        limit: pageSize,
        orderBy: orderBy as any,
        search: debouncedSearch || undefined,
        ...getSecurityFilter(),
      },
    },
  });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("orderBy", orderBy);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (securityFilter !== "all") params.set("security", securityFilter);
    router.push(`/solar-systems?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, debouncedSearch, securityFilter]);

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
    <div className="px-4 sm:px-6 lg:px-8">
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mt-6">
        <div className="flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="Search solar systems..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-input"
          />
        </div>
        <div className="select-option-container">
          <select
            value={securityFilter}
            onChange={(e) => {
              setSecurityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="select"
          >
            <option value="all">All Security</option>
            <option value="highsec">High Sec (≥0.5)</option>
            <option value="lowsec">Low Sec (0.1-0.4)</option>
            <option value="nullsec">Null Sec (≤0.0)</option>
          </select>
        </div>
        <div className="select-option-container">
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            className="select"
          >
            <option value="nameAsc">Name A-Z</option>
            <option value="nameDesc">Name Z-A</option>
            <option value="securityStatusDesc">Security ↓</option>
            <option value="securityStatusAsc">Security ↑</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden border border-white/10">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Solar System
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Constellation
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Region
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Security Status
              </th>
              <th className="px-6 py-4 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                Security Class
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
                        className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                      >
                        {system.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {system.constellation ? (
                      <Link
                        href={`/constellations/${system.constellation.id}`}
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
