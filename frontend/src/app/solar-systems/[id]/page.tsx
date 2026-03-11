"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import KillmailsTable from "@/components/KillmailsTable";
import { Loader } from "@/components/Loader/Loader";
import Paginator from "@/components/Paginator/Paginator";
import SecurityBadge from "@/components/SecurityStatus/SecurityStatus";
import TopAllianceCard from "@/components/TopAllianceCard/TopAllianceCard";
import TopCharacterCard from "@/components/TopCharacterCard/TopCharacterCard";
import TopCorporationCard from "@/components/TopCorporationCard/TopCorporationCard";
import TopShipsCard from "@/components/TopShipsCard/TopShipsCard";
import {
  KillmailOrderBy,
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
  useSolarSystemQuery,
  useTopLast7DaysAlliancesQuery,
  useTopLast7DaysCorporationsQuery,
  useTopLast7DaysPilotsQuery,
  useTopLast7DaysShipsQuery,
} from "@/generated/graphql";
import { formatTimeAgo } from "@/utils/date";
import { getSecurityColor, getSecurityLabel } from "@/utils/security";
import {
  GlobeAltIcon,
  MapIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";

interface SolarSystemDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "attributes" | "killmails";

export default function SolarSystemDetailPage({
  params,
}: SolarSystemDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const pageSizeFromUrl = Number(searchParams.get("pageSize")) || 25;
  const tabFromUrl = (searchParams.get("tab") as TabType) || "attributes";

  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);

  const { data, loading, error } = useSolarSystemQuery({
    variables: { id: parseInt(id) },
  });

  // Fetch last 7 days top characters for this system
  const { data: weeklyPilotsData, loading: weeklyPilotsLoading } =
    useTopLast7DaysPilotsQuery({
      variables: { filter: { limit: 10, systemId: parseInt(id) } },
      skip: activeTab !== "killmails",
    });

  // Fetch last 7 days top corporations for this system
  const { data: weeklyCorporationsData, loading: weeklyCorporationsLoading } =
    useTopLast7DaysCorporationsQuery({
      variables: { filter: { limit: 10, systemId: parseInt(id) } },
      skip: activeTab !== "killmails",
    });

  // Fetch last 7 days top alliances for this system
  const { data: weeklyAlliancesData, loading: weeklyAlliancesLoading } =
    useTopLast7DaysAlliancesQuery({
      variables: { filter: { limit: 10, systemId: parseInt(id) } },
      skip: activeTab !== "killmails",
    });

  // Fetch last 7 days top ships for this system
  const { data: weeklyShipsData, loading: weeklyShipsLoading } =
    useTopLast7DaysShipsQuery({
      variables: { filter: { limit: 10, systemId: parseInt(id) } },
      skip: activeTab !== "killmails",
    });

  // Fetch killmails when killmails tab is active
  const { data: killmailsData, loading: killmailsLoading } = useKillmailsQuery({
    variables: {
      filter: {
        systemId: parseInt(id),
        page: currentPage,
        limit: pageSize,
        orderBy: KillmailOrderBy.TimeDesc,
      },
    },
    skip: activeTab !== "killmails",
  });

  // Fetch date counts for correct totals per date
  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: {
      filter: {
        systemId: parseInt(id),
      },
    },
    skip: activeTab !== "killmails",
  });

  // Memoize killmails array
  const killmails = useMemo(
    () => killmailsData?.killmails.items || [],
    [killmailsData],
  );

  // Create a map of date -> total count for that date
  const dateCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    dateCountsData?.killmailsDateCounts.forEach((dc) => {
      map.set(dc.date, dc.count);
    });
    return map;
  }, [dateCountsData]);

  const pageInfo = killmailsData?.killmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

  // URL sync for pagination and tab
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (activeTab === "killmails") {
      params.set("page", currentPage.toString());
      params.set("pageSize", pageSize.toString());
    }
    router.push(`/solar-systems/${id}?${params.toString()}`, { scroll: false });
  }, [currentPage, pageSize, activeTab, id, router]);

  const handleNext = useCallback(
    () => pageInfo?.hasNextPage && setCurrentPage((prev) => prev + 1),
    [pageInfo?.hasNextPage],
  );
  const handlePrev = useCallback(
    () => pageInfo?.hasPreviousPage && setCurrentPage((prev) => prev - 1),
    [pageInfo?.hasPreviousPage],
  );
  const handleFirst = useCallback(() => setCurrentPage(1), []);
  const handleLast = useCallback(
    () => totalPages > 0 && setCurrentPage(totalPages),
    [totalPages],
  );

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading solar system..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const system = data?.solarSystem;

  if (!system) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Solar system not found</div>
      </div>
    );
  }

  const securityColor = getSecurityColor(system.securityStatus);
  const securityLabel = getSecurityLabel(system.securityStatus);

  const tabs = [
    { id: "attributes" as TabType, label: "Attributes" },
    { id: "killmails" as TabType, label: "Killmails" },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Regions", href: "/regions" },
          system.constellation?.region
            ? {
                label: system.constellation.region.name,
                href: `/regions/${system.constellation.region.id}`,
              }
            : { label: "Unknown Region" },
          system.constellation
            ? {
                label: system.constellation.name,
                href: `/constellations/${system.constellation.id}`,
              }
            : { label: "Unknown Constellation" },
          { label: system.name },
        ]}
      />

      <div className="system-detail-card">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            <div
              className={`flex items-center justify-center w-24 h-24 shadow-md shrink-0 ${
                system.securityStatus != null && system.securityStatus >= 0.5
                  ? "bg-green-500/20 border border-green-500/50"
                  : system.securityStatus != null && system.securityStatus > 0
                    ? "bg-yellow-500/20 border border-yellow-500/50"
                    : system.securityStatus != null
                      ? "bg-red-500/20 border border-red-500/50"
                      : "bg-purple-500/20 border border-purple-500/50"
              }`}
            >
              <MapPinIcon className={`w-12 h-12 ${securityColor}`} />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">{system.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <SecurityBadge
                  securityStatus={system.securityStatus}
                  showLabel={true}
                />
              </div>
              <div className="flex flex-wrap items-center gap-6 mt-4 text-sm">
                {system.constellation && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapIcon className="w-4 h-4 text-purple-500" />
                    <span>Constellation:</span>
                    <Link
                      href={`/constellations/${system.constellation.id}`}
                      prefetch={false}
                      className="transition-colors text-cyan-400 hover:text-cyan-300"
                    >
                      {system.constellation.name}
                    </Link>
                  </div>
                )}
                {system.constellation?.region && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <GlobeAltIcon className="w-4 h-4 text-cyan-500" />
                    <span>Region:</span>
                    <Link
                      href={`/regions/${system.constellation.region.id}`}
                      prefetch={false}
                      className="transition-colors text-cyan-400 hover:text-cyan-300"
                    >
                      {system.constellation.region.name}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kill Statistics Card */}
          {system.latestKills ? (
            <div className="flex flex-col items-end space-y-2 text-xs text-gray-400">
              <span>
                {system.latestKills.ship_kills.toLocaleString()} ships,{" "}
                {system.latestKills.pod_kills.toLocaleString()}
                pods, {system.latestKills.npc_kills.toLocaleString()} NPC killed
              </span>
              <span>{formatTimeAgo(system.latestKills.timestamp)}</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent activity</p>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-8 mb-6 border-b border-white/10">
          <nav className="flex gap-4" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
                  activeTab === tab.id
                    ? "border-cyan-500 text-cyan-500"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "attributes" && (
          <div className="grid gap-6 mt-8 md:grid-cols-2 lg:grid-cols-3">
            {/* System Info */}
            <div className="p-6 border bg-white/5 border-white/10">
              <h2 className="flex items-center gap-2 mb-4 text-xl font-bold">
                <MapPinIcon className="w-5 h-5 text-orange-400" />
                System Information
              </h2>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-400">System ID</dt>
                  <dd className="text-gray-200">{system.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Security Status</dt>
                  <dd className={`${securityColor}`}>
                    {system.securityStatus != null
                      ? system.securityStatus.toFixed(5)
                      : "N/A"}
                  </dd>
                </div>

                {system.star_id && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Star ID</dt>
                    <dd className="text-gray-200">{system.star_id}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Location Hierarchy */}
            <div className="p-6 border bg-white/5 border-white/10">
              <h2 className="flex items-center gap-2 mb-4 text-xl font-bold">
                <GlobeAltIcon className="w-5 h-5 text-cyan-400" />
                Location Hierarchy
              </h2>
              <div className="space-y-4">
                {/* Region */}
                {system.constellation?.region && (
                  <div className="flex items-center gap-3 p-3 border bg-white/5 border-white/10">
                    <GlobeAltIcon className="w-6 h-6 text-cyan-500" />
                    <div>
                      <div className="text-xs text-gray-500 uppercase">
                        Region
                      </div>
                      <Link
                        href={`/regions/${system.constellation.region.id}`}
                        prefetch={false}
                        className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                      >
                        {system.constellation.region.name}
                      </Link>
                    </div>
                  </div>
                )}

                {/* Constellation */}
                {system.constellation && (
                  <div className="flex items-center gap-3 p-3 ml-4 border bg-white/5 border-white/10">
                    <MapIcon className="w-6 h-6 text-purple-500" />
                    <div>
                      <div className="text-xs text-gray-500 uppercase">
                        Constellation
                      </div>
                      <Link
                        href={`/constellations/${system.constellation.id}`}
                        prefetch={false}
                        className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                      >
                        {system.constellation.name}
                      </Link>
                    </div>
                  </div>
                )}

                {/* Current System */}
                <div className="flex items-center gap-3 p-3 ml-8 border-2 bg-white/5 border-cyan-500/50">
                  <MapPinIcon className={`w-6 h-6 ${securityColor}`} />
                  <div>
                    <div className="text-xs text-gray-500 uppercase">
                      Solar System
                    </div>
                    <span className="font-medium text-white">
                      {system.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Position Info */}
            {system.position && (
              <div className="p-6 border bg-white/5 border-white/10">
                <h2 className="flex items-center gap-2 mb-4 text-xl font-bold">
                  <StarIcon className="w-5 h-5 text-yellow-400" />
                  Position in Space
                </h2>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm text-gray-400">X Coordinate</dt>
                    <dd className="text-lg text-gray-200">
                      {system.position.x.toExponential(4)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-400">Y Coordinate</dt>
                    <dd className="text-lg text-gray-200">
                      {system.position.y.toExponential(4)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-400">Z Coordinate</dt>
                    <dd className="text-lg text-gray-200">
                      {system.position.z.toExponential(4)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        )}

        {activeTab === "killmails" && (
          <div className="grid grid-cols-1 gap-6 mt-6 lg:grid-cols-4">
            {/* Left side - Killmails Table (takes 3 columns) */}
            <div className="lg:col-span-3">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">Killmails</h2>
                {pageInfo?.totalCount !== undefined && (
                  <p className="mt-1 text-sm text-gray-400">
                    Total: {pageInfo.totalCount.toLocaleString()} killmails
                  </p>
                )}
              </div>

              <KillmailsTable
                killmails={killmails}
                loading={killmailsLoading}
                dateCountsMap={dateCountsMap}
                variant="detail"
              />

              {killmails.length > 0 && (
                <div className="mt-6">
                  <Paginator
                    hasNextPage={pageInfo?.hasNextPage ?? false}
                    hasPrevPage={pageInfo?.hasPreviousPage ?? false}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    onFirst={handleFirst}
                    onLast={handleLast}
                    loading={killmailsLoading}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Right side - Sidebar */}
            <div className="space-y-6 lg:col-span-1 lg:mt-9">
              <TopCharacterCard
                title="Top Characters"
                subtitle={
                  <>
                    Last 7 days{" "}
                    <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                      ROLLING
                    </span>
                  </>
                }
                characters={
                  weeklyPilotsData?.topLast7DaysPilots?.map((pilot) => ({
                    id: pilot.character?.id || 0,
                    name: pilot.character?.name || "Unknown",
                    killCount: pilot.killCount,
                    securityStatus: pilot.character?.securityStatus,
                    corporation: pilot.character?.corporation
                      ? {
                          id: pilot.character.corporation.id,
                          name: pilot.character.corporation.name,
                        }
                      : null,
                    alliance: pilot.character?.alliance
                      ? {
                          id: pilot.character.alliance.id,
                          name: pilot.character.alliance.name,
                        }
                      : null,
                  })) || []
                }
                loading={weeklyPilotsLoading}
                emptyText="No character activity in the last 7 days"
                variant="detail"
              />
              <TopCorporationCard
                title="Top Corporations"
                subtitle={
                  <>
                    Last 7 days{" "}
                    <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                      ROLLING
                    </span>
                  </>
                }
                corporations={
                  weeklyCorporationsData?.topLast7DaysCorporations?.map(
                    (corp) => ({
                      id: corp.corporation?.id || 0,
                      name: corp.corporation?.name || "Unknown",
                      ticker: corp.corporation?.ticker,
                      killCount: corp.killCount,
                    }),
                  ) || []
                }
                loading={weeklyCorporationsLoading}
                emptyText="No corporation activity in the last 7 days"
                variant="detail"
              />
              <TopAllianceCard
                title="Top Alliances"
                subtitle={
                  <>
                    Last 7 days{" "}
                    <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                      ROLLING
                    </span>
                  </>
                }
                alliances={
                  weeklyAlliancesData?.topLast7DaysAlliances?.map(
                    (alliance) => ({
                      id: alliance.alliance?.id || 0,
                      name: alliance.alliance?.name || "Unknown",
                      ticker: alliance.alliance?.ticker,
                      killCount: alliance.killCount,
                    }),
                  ) || []
                }
                loading={weeklyAlliancesLoading}
                emptyText="No alliance activity in the last 7 days"
                variant="detail"
              />
              <TopShipsCard
                title="Top Ships"
                subtitle={
                  <>
                    Last 7 days{" "}
                    <span className="px-1.5 py-0.5 text-xs font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20">
                      ROLLING
                    </span>
                  </>
                }
                ships={
                  weeklyShipsData?.topLast7DaysShips?.map((ship) => ({
                    id: ship.shipType?.id || 0,
                    name: ship.shipType?.name || "Unknown",
                    killCount: ship.killCount,
                    dogmaAttributes: ship.shipType?.dogmaAttributes,
                  })) || []
                }
                loading={weeklyShipsLoading}
                emptyText="No ship activity in the last 7 days"
                variant="detail"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
