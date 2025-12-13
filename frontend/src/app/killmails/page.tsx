"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Paginator from "@/components/Paginator/Paginator";
import SecurityStatus from "@/components/SecurityStatus/SecurityStatus";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useKillmailsQuery } from "@/generated/graphql";
import {
  ChevronDownIcon,
  FireIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function KillmailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "timeDesc";
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

  const { data, loading, error } = useKillmailsQuery({
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
    router.push(`/killmails?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, debouncedSearch, router]);

  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;

  const killmails = data?.killmails.edges.map((edge) => edge.node) || [];
  const pageInfo = data?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  // Group killmails by date
  const groupedKillmails = killmails.reduce((groups, km) => {
    const dateObj = new Date(km.killmailTime);
    const date = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD format
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(km);
    return groups;
  }, {} as Record<string, typeof killmails>);

  const handleNext = () =>
    pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1);
  const handlePrev = () =>
    pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1);
  const handleFirst = () => setCurrentPage(1);
  const handleLast = () => totalPages > 0 && setCurrentPage(totalPages);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Killmails" }]} />

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
          {pageInfo?.totalCount && (
            <p className="mt-1 text-sm text-gray-500">
              Total: {pageInfo.totalCount.toLocaleString()} killmails
            </p>
          )}
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
            placeholder="Search by character, corporation, or alliance..."
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
            <option value="timeDesc">Newest First</option>
            <option value="timeAsc">Oldest First</option>
          </select>
          <ChevronDownIcon className="chevron-down-icon" />
        </div>
      </div>

      {/* Grouped Killmails by Date */}
      <div className="mt-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 rounded-full animate-spin border-cyan-500 border-t-transparent" />
              <span className="text-gray-400">Loading killmails...</span>
            </div>
          </div>
        ) : killmails.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No killmails found
          </div>
        ) : (
          Object.entries(groupedKillmails).map(([date, dateKillmails]) => (
            <div key={date} className="space-y-3">
              {/* Date Header */}
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <span className="text-gray-200">{date}</span>
                <span className="text-sm font-normal text-gray-500">
                  ({dateKillmails.length} killmail
                  {dateKillmails.length !== 1 ? "s" : ""})
                </span>
              </h2>

              {/* Table for this date */}
              <div className="overflow-hidden border border-white/10">
                <table className="table">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="th-cell">Time</th>
                      <th className="th-cell">Ship</th>
                      <th className="th-cell">Victim</th>
                      <th className="th-cell">System</th>
                      <th className="th-cell">Final Blow</th>
                      <th className="th-cell">Attackers</th>
                      <th className="th-cell">Damage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {dateKillmails.map((km) => {
                      const finalBlowAttacker = km.attackers?.find(
                        (a) => a?.finalBlow
                      );
                      const attackerCount = km.attackers?.length || 0;

                      return (
                        <tr
                          key={km.id}
                          className="transition-colors hover:bg-white/5"
                        >
                          <td className="px-6 py-4 text-base align-top">
                            <div className="text-gray-400">
                              {new Date(km.killmailTime).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-base align-top">
                            <div className="flex items-start gap-3">
                              {km.victim?.shipTypeId && (
                                <img
                                  src={`https://images.evetech.net/types/${km.victim.shipTypeId}/render?size=128`}
                                  alt={km.victim?.shipType?.name || "Ship"}
                                  className="border size-20 border-amber-500"
                                  loading="lazy"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-orange-400">
                                  {km.victim?.shipType?.name || "Unknown Ship"}
                                </div>
                                {km.victim?.shipType?.group && (
                                  <div className="text-base text-gray-500">
                                    {km.victim.shipType.group.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-base align-top">
                            <div className="flex items-center gap-3">
                              {/* Alliance logo if exists, otherwise corporation logo */}
                              {(km.victim?.alliance?.id ||
                                km.victim?.corporation?.id) && (
                                <img
                                  src={
                                    km.victim.alliance?.id
                                      ? `https://images.evetech.net/alliances/${km.victim.alliance.id}/logo?size=128`
                                      : `https://images.evetech.net/corporations/${km.victim?.corporation?.id}/logo?size=128`
                                  }
                                  alt={
                                    km.victim.alliance?.name ||
                                    km.victim?.corporation?.name ||
                                    "Logo"
                                  }
                                  className="border size-20 border-amber-500"
                                  loading="lazy"
                                />
                              )}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="font-medium text-white">
                                  {km.victim?.character?.name || "Unknown"}
                                </div>
                                {km.victim?.corporation && (
                                  <div className="text-base text-gray-400">
                                    <Link
                                      href={`/corporations/${km.victim.corporation.id}`}
                                      className="transition-colors hover:text-cyan-400"
                                    >
                                      {km.victim.corporation.name}
                                    </Link>
                                  </div>
                                )}
                                {km.victim?.alliance && (
                                  <div className="text-base text-gray-500">
                                    <Link
                                      href={`/alliances/${km.victim.alliance.id}`}
                                      className="transition-colors hover:text-cyan-400"
                                    >
                                      {km.victim.alliance.name}
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-base align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Tooltip content="Solar System" position="top">
                                  <Link
                                    href={`/systems/${km.solarSystem?.id}`}
                                    className="font-medium text-orange-400 transition-colors hover:text-orange-500"
                                  >
                                    {km.solarSystem?.name || "Unknown"}
                                  </Link>
                                </Tooltip>
                                {km.solarSystem?.security_status !== null &&
                                  km.solarSystem?.security_status !==
                                    undefined && (
                                    <SecurityStatus
                                      securityStatus={
                                        km.solarSystem.security_status
                                      }
                                    />
                                  )}
                              </div>
                              {km.solarSystem?.constellation?.region && (
                                <div className="text-base text-gray-500">
                                  {km.solarSystem.constellation.region.name}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-base align-top">
                            {finalBlowAttacker && (
                              <div className="space-y-1">
                                <div className="text-base text-green-400">
                                  {finalBlowAttacker.character?.name ||
                                    "Unknown"}
                                </div>
                                <div className="text-base text-gray-500">
                                  {finalBlowAttacker.shipType?.name ||
                                    "Unknown"}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-base align-top">
                            <span className="font-medium text-purple-400">
                              {attackerCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-base align-top">
                            <span className="font-medium text-red-400">
                              {km.victim?.damageTaken?.toLocaleString() || 0}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
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
