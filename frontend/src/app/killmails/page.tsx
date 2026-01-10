"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import KillmailFilters from "@/components/Filters/KillmailFilters";
import { KillmailToast } from "@/components/KillmailToast/KillmailToast";
import Loader from "@/components/Loader";
import Paginator from "@/components/Paginator/Paginator";
import SecurityStatus from "@/components/SecurityStatus/SecurityStatus";
import Tooltip from "@/components/Tooltip/Tooltip";
import {
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
  useNewKillmailSubscription,
} from "@/generated/graphql";
import { FireIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

function KillmailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const orderByFromUrl = searchParams.get("orderBy") || "timeDesc";

  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(25);
  const [orderBy, setOrderBy] = useState<string>(orderByFromUrl);
  const [filters, setFilters] = useState<{
    typeName?: string;
    regionId?: number;
    systemId?: number;
  }>({});
  const [newKillmails, setNewKillmails] = useState<any[]>([]);
  const [killmailToasts, setKillmailToasts] = useState<KillmailToast[]>([]);
  const [animatingKillmails, setAnimatingKillmails] = useState<Set<string>>(
    new Set()
  );
  const [totalKillmailCount, setTotalKillmailCount] = useState<number | null>(
    null
  );
  const [dateCounts, setDateCounts] = useState<Record<string, number>>({});

  // Subscribe to new killmails
  const {
    data: subscriptionData,
    loading: subscriptionLoading,
    error: subscriptionError,
  } = useNewKillmailSubscription({
    skip: currentPage !== 1, // Only subscribe when on first page
  });

  // Debug subscription (removed for production performance)

  // Dismiss toast handler
  const handleDismissToast = useCallback((id: string) => {
    setKillmailToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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

      // Add toast notification
      setKillmailToasts((prev) => {
        // Check if toast already exists
        const exists = prev.some((t) => t.id === km.id);
        if (exists) return prev;

        // Find final blow attacker
        const finalBlowAttacker = km.attackers?.find((a: any) => a.finalBlow);

        const newToast: KillmailToast = {
          id: km.id,
          victimName: km.victim?.character?.name || null,
          victimShipName: km.victim?.shipType?.name || null,
          victimShipTypeId: km.victim?.shipType?.id || null,
          attackerName: finalBlowAttacker?.character?.name || null,
          systemName: km.solarSystem?.name || null,
          timestamp: new Date(km.killmailTime),
        };

        // Keep only last 10 toasts
        return [newToast, ...prev].slice(0, 10);
      });

      // Increment total count
      setTotalKillmailCount((prev) => (prev !== null ? prev + 1 : null));

      // Increment date count for this killmail's date
      const kmDate = new Date(km.killmailTime).toISOString().split("T")[0];
      setDateCounts((prev) => ({
        ...prev,
        [kmDate]: (prev[kmDate] || 0) + 1,
      }));

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
    typeName?: string;
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
        regionId: filters.regionId,
        systemId: filters.systemId,
      },
    },
  });

  // Fetch date counts for all dates (not paginated)
  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: {
      filter: {
        orderBy: orderBy as any,
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
    router.push(`/killmails?${params.toString()}`, { scroll: false });
  }, [currentPage, orderBy, router]);

  // Memoize killmails array to prevent unnecessary recalculations
  const killmails = useMemo(
    () => [
      ...newKillmails, // Add new real-time killmails first
      ...(data?.killmails.edges.map((edge) => edge.node) || []),
    ],
    [newKillmails, data?.killmails.edges]
  );

  const pageInfo = data?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  // Initialize total count from query data
  useEffect(() => {
    if (data?.killmails.pageInfo.totalCount && totalKillmailCount === null) {
      setTotalKillmailCount(data.killmails.pageInfo.totalCount);
    }
  }, [data, totalKillmailCount]);

  // Update date counts from query data
  useEffect(() => {
    if (dateCountsData?.killmailsDateCounts) {
      const counts: Record<string, number> = {};
      dateCountsData.killmailsDateCounts.forEach((dc) => {
        counts[dc.date] = dc.count;
      });
      setDateCounts(counts);
    }
  }, [dateCountsData]);

  // Group killmails by date (memoized for performance)
  const groupedKillmails = useMemo(() => {
    return killmails.reduce((groups, km) => {
      const dateObj = new Date(km.killmailTime);
      const date = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD format
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(km);
      return groups;
    }, {} as Record<string, typeof killmails>);
  }, [killmails]);

  const handleNext = useCallback(
    () => pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1),
    [pageInfo?.hasNextPage]
  );
  const handlePrev = useCallback(
    () => pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1),
    [pageInfo?.hasPreviousPage]
  );
  const handleFirst = useCallback(() => setCurrentPage(1), []);
  const handleLast = useCallback(
    () => totalPages > 0 && setCurrentPage(totalPages),
    [totalPages]
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
          {totalKillmailCount !== null && (
            <p className="mt-1 text-sm text-gray-500">
              Total: {totalKillmailCount.toLocaleString()} killmails
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
        />
      </div>

      {/* Grouped Killmails by Date */}
      <div className="mt-6 space-y-8">
        {loading ? (
          <Loader size="md" text="Loading killmails..." className="py-12" />
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
                    ({dateCounts[date] || typedKillmails.length} killmail
                    {(dateCounts[date] || typedKillmails.length) !== 1
                      ? "s"
                      : ""}
                    )
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
                        <th className="th-cell">Final Blow</th>
                        <th className="th-cell">System</th>
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
                                {km.victim?.shipType && (
                                  <Tooltip
                                    content="View Killmail Details"
                                    position="top"
                                  >
                                    <Link
                                      href={`/killmails/${km.id}`}
                                      className="relative block shrink-0"
                                      prefetch={false}
                                    >
                                      <img
                                        src={`https://images.evetech.net/types/${km.victim.shipType?.id}/render?size=128`}
                                        alt={
                                          km.victim?.shipType?.name || "Ship"
                                        }
                                        className="transition-opacity border border-white/10 size-20 hover:opacity-80"
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
                                    className="size-20"
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
                                          prefetch={false}
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
                                          prefetch={false}
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
                                          prefetch={false}
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
                              {finalBlowAttacker && (
                                <div className="flex items-center gap-3">
                                  {/* Alliance logo if exists, otherwise corporation logo */}
                                  {(finalBlowAttacker.alliance?.id ||
                                    finalBlowAttacker.corporation?.id) && (
                                    <img
                                      src={
                                        finalBlowAttacker.alliance?.id
                                          ? `https://images.evetech.net/alliances/${finalBlowAttacker.alliance.id}/logo?size=128`
                                          : `https://images.evetech.net/corporations/${finalBlowAttacker.corporation?.id}/logo?size=128`
                                      }
                                      alt={
                                        finalBlowAttacker.alliance?.name ||
                                        finalBlowAttacker.corporation?.name ||
                                        "Logo"
                                      }
                                      className="size-20"
                                      loading="lazy"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="font-medium text-green-400">
                                      {finalBlowAttacker.character ? (
                                        <Tooltip
                                          content="Show Character Info"
                                          position="top"
                                        >
                                          <Link
                                            href={`/characters/${finalBlowAttacker.character.id}`}
                                            className="transition-colors hover:text-green-300"
                                            prefetch={false}
                                          >
                                            {finalBlowAttacker.character.name}
                                          </Link>
                                        </Tooltip>
                                      ) : (
                                        "Unknown"
                                      )}
                                    </div>
                                    {finalBlowAttacker.corporation && (
                                      <div className="text-base text-gray-400">
                                        <Tooltip
                                          content="Show Corporation Info"
                                          position="top"
                                        >
                                          <Link
                                            href={`/corporations/${finalBlowAttacker.corporation.id}`}
                                            className="transition-colors hover:text-cyan-400"
                                            prefetch={false}
                                          >
                                            {finalBlowAttacker.corporation.name}
                                          </Link>
                                        </Tooltip>
                                      </div>
                                    )}
                                    {finalBlowAttacker.alliance && (
                                      <div className="text-base text-gray-500">
                                        <Tooltip
                                          content="Show Alliance Info"
                                          position="top"
                                        >
                                          <Link
                                            href={`/alliances/${finalBlowAttacker.alliance.id}`}
                                            className="transition-colors hover:text-cyan-400"
                                            prefetch={false}
                                          >
                                            {finalBlowAttacker.alliance.name}
                                          </Link>
                                        </Tooltip>
                                      </div>
                                    )}
                                    <div className="text-base text-gray-500">
                                      {finalBlowAttacker.shipType?.name ||
                                        "Unknown"}
                                    </div>
                                  </div>
                                </div>
                              )}
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
                                      prefetch={false}
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
                                        prefetch={false}
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
                                        prefetch={false}
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
