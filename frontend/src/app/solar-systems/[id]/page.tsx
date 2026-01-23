"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import KillmailsTable from "@/components/KillmailsTable";
import { Loader } from "@/components/Loader/Loader";
import Paginator from "@/components/Paginator/Paginator";
import SecurityBadge from "@/components/SecurityStatus/SecurityStatus";
import {
  KillmailOrderBy,
  useKillmailsDateCountsQuery,
  useKillmailsQuery,
  useSolarSystemQuery,
} from "@/generated/graphql";
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
    () => killmailsData?.killmails.edges.map((edge) => edge.node) || [],
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

  const securityColor = getSecurityColor(system.security_status);
  const securityLabel = getSecurityLabel(system.security_status);

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
                system.security_status != null && system.security_status >= 0.5
                  ? "bg-green-500/20 border border-green-500/50"
                  : system.security_status != null && system.security_status > 0
                    ? "bg-yellow-500/20 border border-yellow-500/50"
                    : system.security_status != null
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
                  securityStatus={system.security_status}
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

          {/* Quick Info Card */}
          <div className="p-4 border bg-white/5 border-white/10 min-w-70">
            <h3 className="mb-3 text-sm font-medium text-gray-400">
              Quick Info
            </h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-400">Security</dt>
                <dd className={`font-medium ${securityColor}`}>
                  {system.security_status != null
                    ? system.security_status.toFixed(2)
                    : "W-Space"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Type</dt>
                <dd className={`font-medium ${securityColor}`}>
                  {securityLabel}
                </dd>
              </div>
              {system.security_class && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Class</dt>
                  <dd className="text-gray-200">{system.security_class}</dd>
                </div>
              )}
            </dl>
          </div>
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
                    {system.security_status != null
                      ? system.security_status.toFixed(5)
                      : "N/A"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Security Class</dt>
                  <dd className="text-gray-200">
                    {system.security_class || "N/A"}
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
          <div className="killmails-tab">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Killmails</h2>
              {pageInfo?.totalCount !== undefined && (
                <p className="mt-1 text-sm text-gray-500">
                  Total: {pageInfo.totalCount.toLocaleString()} killmails
                </p>
              )}
            </div>

            <KillmailsTable
              killmails={killmails}
              loading={killmailsLoading}
              dateCountsMap={dateCountsMap}
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
        )}
      </div>
    </div>
  );
}
