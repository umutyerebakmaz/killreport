"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import { KillmailToast } from "@/components/KillmailToast/KillmailToast";
import Paginator from "@/components/Paginator/Paginator";
import SecurityStatus from "@/components/SecurityStatus/SecurityStatus";
import Tooltip from "@/components/Tooltip/Tooltip";
import {
  useKillmailsQuery,
  useNewKillmailSubscription,
} from "@/generated/graphql";
import {
  ChevronDownIcon,
  FireIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
  const [newKillmails, setNewKillmails] = useState<any[]>([]);
  const [killmailToasts, setKillmailToasts] = useState<KillmailToast[]>([]);
  const [animatingKillmails, setAnimatingKillmails] = useState<Set<string>>(
    new Set()
  );
  const [totalKillmailCount, setTotalKillmailCount] = useState<number | null>(
    null
  );

  // Subscribe to new killmails
  const {
    data: subscriptionData,
    loading: subscriptionLoading,
    error: subscriptionError,
  } = useNewKillmailSubscription({
    skip: currentPage !== 1, // Only subscribe when on first page
  });

  // Debug subscription
  useEffect(() => {
    console.log("🔔 Subscription state:", {
      loading: subscriptionLoading,
      error: subscriptionError?.message,
      hasData: !!subscriptionData,
      data: subscriptionData,
    });
  }, [subscriptionData, subscriptionLoading, subscriptionError]);

  // Dismiss toast handler
  const handleDismissToast = useCallback((id: string) => {
    setKillmailToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Add new killmail to the list when received
  useEffect(() => {
    if (subscriptionData?.newKillmail && currentPage === 1) {
      const km = subscriptionData.newKillmail;
      console.log("📨 New killmail received:", km.id);

      setNewKillmails((prev) => {
        // Check if killmail already exists
        const exists = prev.some((k) => k.id === km.id);
        if (exists) return prev;

        // Add new killmail to the top of the list
        return [km, ...prev];
      });

      // Add toast notification
      setKillmailToasts((prev) => {
        // Check if toast already exists
        const exists = prev.some((t) => t.id === km.id);
        if (exists) return prev;

        // Find final blow attacker
        const finalBlowAttacker = km.attackers?.find((a: any) => a.finalBlow);

        const newToast: KillmailToast = {
          id: km.id,
          killmailId: km.killmailId,
          victimName: km.victim?.character?.name || null,
          victimShipName: km.victim?.shipType?.name || null,
          victimShipTypeId: km.victim?.shipTypeId || null,
          attackerName: finalBlowAttacker?.character?.name || null,
          systemName: km.solarSystem?.name || null,
          timestamp: new Date(km.killmailTime),
        };

        // Keep only last 10 toasts
        return [newToast, ...prev].slice(0, 10);
      });

      // Increment total count
      setTotalKillmailCount((prev) => (prev !== null ? prev + 1 : null));

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
  }, [currentPage, orderBy, debouncedSearch]);

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

  const killmails = [
    ...newKillmails, // Add new real-time killmails first
    ...(data?.killmails.edges.map((edge) => edge.node) || []),
  ];
  const pageInfo = data?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  // Initialize total count from query data
  useEffect(() => {
    if (data?.killmails.pageInfo.totalCount && totalKillmailCount === null) {
      setTotalKillmailCount(data.killmails.pageInfo.totalCount);
    }
  }, [data, totalKillmailCount]);

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
          {totalKillmailCount !== null && (
            <p className="mt-1 text-sm text-gray-500">
              Total: {totalKillmailCount.toLocaleString()} killmails
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
          Object.entries(groupedKillmails).map(([date, dateKillmails]) => {
            const typedKillmails = dateKillmails as typeof killmails;
            return (
              <div key={date} className="space-y-3">
                {/* Date Header */}
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <span className="text-gray-200">{date}</span>
                  <span className="text-sm font-normal text-gray-500">
                    ({typedKillmails.length} killmail
                    {typedKillmails.length !== 1 ? "s" : ""})
                  </span>
                </h2>

                {/* Table for this date */}
                <div className="border border-white/10">
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
                      {typedKillmails.map((km) => {
                        const finalBlowAttacker = km.attackers?.find(
                          (a: any) => a?.finalBlow
                        );
                        const attackerCount = km.attackers?.length || 0;

                        const isAnimating = animatingKillmails.has(km.id);

                        return (
                          <tr
                            key={km.id}
                            className={`transition-colors hover:bg-white/5 ${
                              isAnimating ? "animate-slide-in-row" : ""
                            }`}
                            style={
                              isAnimating ? { display: "table-row" } : undefined
                            }
                          >
                            <td className="px-6 py-4 text-base align-top">
                              <Tooltip
                                content={`${new Date(
                                  km.killmailTime
                                ).toLocaleDateString("en-US", {
                                  timeZone: "UTC",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })} ${new Date(
                                  km.killmailTime
                                ).toLocaleTimeString("en-US", {
                                  timeZone: "UTC",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  hour12: false,
                                })} UTC`}
                                position="top"
                              >
                                <div className="text-gray-400">
                                  {new Date(km.killmailTime).toLocaleTimeString(
                                    "en-US",
                                    {
                                      timeZone: "UTC",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                      hour12: false,
                                    }
                                  )}
                                </div>
                              </Tooltip>
                            </td>
                            <td className="px-6 py-4 text-base align-top">
                              <div className="flex items-start gap-3">
                                {km.victim?.shipTypeId && (
                                  <Tooltip
                                    content="View Killmail Details"
                                    position="top"
                                  >
                                    <Link
                                      href={`/killmails/${km.killmailId}`}
                                      className="relative block shrink-0"
                                    >
                                      <img
                                        src={`https://images.evetech.net/types/${km.victim.shipTypeId}/render?size=128`}
                                        alt={
                                          km.victim?.shipType?.name || "Ship"
                                        }
                                        className="transition-opacity border size-20 border-amber-500 hover:opacity-80"
                                        loading="lazy"
                                      />
                                      <div className="absolute w-3 h-3 bg-red-500 rounded-full -top-1 -right-1 animate-pulse" />
                                    </Link>
                                  </Tooltip>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-orange-400">
                                    {km.victim?.shipType?.name ||
                                      "Unknown Ship"}
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
                                  <div className="font-medium text-red-500">
                                    {km.victim?.character ? (
                                      <Tooltip
                                        content="Show Character Info"
                                        position="top"
                                      >
                                        <Link
                                          href={`/characters/${km.victim.character.id}`}
                                          className="transition-colors hover:text-red-400"
                                        >
                                          {km.victim.character.name}
                                        </Link>
                                      </Tooltip>
                                    ) : (
                                      "Unknown"
                                    )}
                                  </div>
                                  {km.victim?.corporation && (
                                    <div className="text-base text-gray-400">
                                      <Tooltip
                                        content="Show Corporation Info"
                                        position="top"
                                      >
                                        <Link
                                          href={`/corporations/${km.victim.corporation.id}`}
                                          className="transition-colors hover:text-cyan-400"
                                        >
                                          {km.victim.corporation.name}
                                        </Link>
                                      </Tooltip>
                                    </div>
                                  )}
                                  {km.victim?.alliance && (
                                    <div className="text-base text-gray-500">
                                      <Tooltip
                                        content="Show Alliance Info"
                                        position="top"
                                      >
                                        <Link
                                          href={`/alliances/${km.victim.alliance.id}`}
                                          className="transition-colors hover:text-cyan-400"
                                        >
                                          {km.victim.alliance.name}
                                        </Link>
                                      </Tooltip>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-base align-top">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Tooltip
                                    content="Show Solar System Info"
                                    position="top"
                                  >
                                    <Link
                                      href={`/solar-systems/${km.solarSystem?.id}`}
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
                                {km.solarSystem?.constellation && (
                                  <div className="text-base text-purple-500">
                                    <Tooltip
                                      content="Show Constellation Info"
                                      position="top"
                                    >
                                      <Link
                                        href={`/constellations/${km.solarSystem.constellation?.id}`}
                                        className="transition-colors hover:text-purple-400"
                                      >
                                        {km.solarSystem.constellation.name}
                                      </Link>
                                    </Tooltip>
                                  </div>
                                )}
                                {km.solarSystem?.constellation?.region && (
                                  <div className="text-base text-cyan-400">
                                    <Tooltip
                                      content="Show Region Info"
                                      position="top"
                                    >
                                      <Link
                                        href={`/regions/${km.solarSystem.constellation.region.id}`}
                                        className="transition-colors hover:text-cyan-300"
                                      >
                                        {
                                          km.solarSystem.constellation.region
                                            .name
                                        }
                                      </Link>
                                    </Tooltip>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-base align-top">
                              {finalBlowAttacker && (
                                <div className="space-y-1">
                                  <div className="text-base text-green-400">
                                    {finalBlowAttacker.character ? (
                                      <Tooltip
                                        content="Show Character Info"
                                        position="top"
                                      >
                                        <Link
                                          href={`/characters/${finalBlowAttacker.character.id}`}
                                          className="transition-colors hover:text-green-300"
                                        >
                                          {finalBlowAttacker.character.name}
                                        </Link>
                                      </Tooltip>
                                    ) : (
                                      "Unknown"
                                    )}
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
            );
          })
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
