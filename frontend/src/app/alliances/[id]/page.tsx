"use client";

import AllianceGrowthChart from "@/components/AllianceGrowthChart/AllianceGrowthChart";
import CorporationTable from "@/components/CorporationsTable/CorporationsTable";
import KillmailsTable from "@/components/KillmailsTable";
import { Loader } from "@/components/Loader/Loader";
import MemberDeltaBadge from "@/components/MemberDeltaBadge/MemberDeltaBadge";
import Paginator from "@/components/Paginator/Paginator";
import TotalCorporationBadge from "@/components/TotalCorporationMember/TotalCorporationBadge";
import TotalMemberBadge from "@/components/TotalMemberBadge/TotalMemberBadge";
import {
  CorporationOrderBy,
  useAllianceCorporationsQuery,
  useAllianceGrowthQuery,
  useAllianceKillmailsQuery,
  useAllianceQuery,
  useKillmailsDateCountsQuery,
} from "@/generated/graphql";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";

interface AllianceDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType =
  | "attributes"
  | "growth"
  | "killmails"
  | "war-history"
  | "members";

export default function AllianceDetailPage({
  params,
}: AllianceDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const pageSizeFromUrl = Number(searchParams.get("pageSize")) || 25;
  const tabFromUrl = (searchParams.get("tab") as TabType) || "attributes";

  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);

  // Separate pagination for corporations
  const [corporationsPage, setCorporationsPage] = useState(1);
  const [corporationsPageSize, setCorporationsPageSize] = useState(100);

  const { data, loading, error } = useAllianceQuery({
    variables: { id: parseInt(id) },
  });

  // Fetch corporations when members tab is active
  const { data: corporationsData, loading: corporationsLoading } =
    useAllianceCorporationsQuery({
      variables: {
        filter: {
          allianceId: parseInt(id),
          page: corporationsPage,
          limit: corporationsPageSize,
          orderBy: CorporationOrderBy.MemberCountDesc,
        },
      },
      skip: activeTab !== "members",
    });

  // Fetch killmails when killmails tab is active
  const { data: killmailsData, loading: killmailsLoading } =
    useAllianceKillmailsQuery({
      variables: {
        filter: {
          allianceId: parseInt(id),
          page: currentPage,
          limit: pageSize,
        },
      },
      skip: activeTab !== "killmails",
    });

  // Fetch date counts for correct totals per date
  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: {
      filter: {
        allianceId: parseInt(id),
      },
    },
    skip: activeTab !== "killmails",
  });

  // Fetch growth snapshots only when growth tab is active
  const { data: growthData, loading: growthLoading } = useAllianceGrowthQuery({
    variables: { id: parseInt(id), days: 90 },
    skip: activeTab !== "growth",
  });

  // Memoize killmails array
  const killmails = useMemo(
    () => killmailsData?.killmails.items || [],
    [killmailsData],
  );

  // Memoize corporations array
  const corporations = useMemo(
    () => corporationsData?.corporations.items || [],
    [corporationsData],
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

  const corporationsPageInfo = corporationsData?.corporations.pageInfo;
  const corporationsTotalPages = corporationsPageInfo?.totalPages || 0;

  // URL sync for pagination and tab
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (activeTab === "killmails") {
      params.set("page", currentPage.toString());
      params.set("pageSize", pageSize.toString());
    } else if (activeTab === "members") {
      params.set("page", corporationsPage.toString());
      params.set("pageSize", corporationsPageSize.toString());
    }
    router.push(`/alliances/${id}?${params.toString()}`, { scroll: false });
  }, [
    currentPage,
    pageSize,
    corporationsPage,
    corporationsPageSize,
    activeTab,
    id,
    router,
  ]);

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

  // Corporation pagination handlers
  const handleCorporationsNext = useCallback(
    () =>
      corporationsPageInfo?.hasNextPage &&
      setCorporationsPage((prev) => prev + 1),
    [corporationsPageInfo?.hasNextPage],
  );
  const handleCorporationsPrev = useCallback(
    () =>
      corporationsPageInfo?.hasPreviousPage &&
      setCorporationsPage((prev) => prev - 1),
    [corporationsPageInfo?.hasPreviousPage],
  );
  const handleCorporationsFirst = useCallback(() => setCorporationsPage(1), []);
  const handleCorporationsLast = useCallback(
    () =>
      corporationsTotalPages > 0 && setCorporationsPage(corporationsTotalPages),
    [corporationsTotalPages],
  );

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading alliance..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const alliance = data?.alliance;

  if (!alliance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Alliance not found</div>
      </div>
    );
  }

  const tabs = [
    { id: "attributes" as TabType, label: "Attributes" },
    { id: "killmails" as TabType, label: "Killmails" },
    { id: "war-history" as TabType, label: "War History" },
    { id: "members" as TabType, label: "Members" },
    { id: "growth" as TabType, label: "Growth" },
  ];

  // Delta verilerini al (haftalık değişim)
  const memberDelta7d = alliance.metrics?.memberCountDelta7d ?? null;
  const memberGrowthRate7d = alliance.metrics?.memberCountGrowthRate7d ?? null;

  return (
    <main>
      <div className="alliance-detail-card">
        {/* Logo and Alliance Name */}
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center justify-center gap-6">
            <img
              src={`https://images.evetech.net/Alliance/${alliance.id}_128.png`}
              alt={alliance.name}
              width={128}
              height={128}
              className="shadow-md"
            />
            <div className="flex-1">
              <h1 className="text-4xl font-bold">{alliance.name}</h1>
              <div className="mt-2">
                <span className="py-1 text-base font-bold text-yellow-400">
                  [{alliance.ticker}]
                </span>
              </div>
            </div>
          </div>

          {/* Metric Container */}
          <div className="flex items-center gap-4">
            {/*  member count */}
            <TotalMemberBadge count={alliance.memberCount} />
            {/* corporation count */}
            <TotalCorporationBadge count={alliance.corporationCount} />
            {/* member delta 7d */}
            <MemberDeltaBadge
              memberDelta={memberDelta7d}
              memberGrowthRate={memberGrowthRate7d}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-white/10">
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
        <div className="mt-6">
          {activeTab === "attributes" && (
            <div className="detail-tab-content">
              <h2 className="mb-4 text-2xl font-bold">Attributes</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Executor</span>
                  <span className="ml-2 font-semibold">
                    {alliance.executor ? (
                      <Link
                        href={`/corporations/${alliance.executor.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {alliance.executor.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Short Name</span>
                  <span className="ml-2 font-semibold">{alliance.ticker}</span>
                </div>
                <div>
                  <span className="text-gray-400">Created By Corporation</span>
                  <span className="ml-2 font-semibold">
                    {alliance.createdByCorporation ? (
                      <Link
                        href={`/corporations/${alliance.createdByCorporation.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {alliance.createdByCorporation.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Created By</span>
                  <span className="ml-2 font-semibold">
                    {alliance.createdBy ? (
                      <Link
                        href={`/characters/${alliance.createdBy.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {alliance.createdBy.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Start Date:</span>
                  <span className="ml-2 font-semibold">
                    {new Date(alliance.date_founded).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "growth" && (
            <div className="detail-tab-content">
              <AllianceGrowthChart
                snapshots={growthData?.alliance?.snapshots ?? []}
                loading={growthLoading}
              />
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
                allianceId={parseInt(id)}
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

          {activeTab === "war-history" && (
            <div className="detail-tab-content">
              <h2 className="mb-4 text-2xl font-bold">War History</h2>
              <p className="text-gray-300">
                War history information will be displayed here.
              </p>
            </div>
          )}

          {activeTab === "members" && (
            <div className="alliance-corporations-tab">
              <div className="sm:flex-auto">
                <h1 className="flex items-center gap-3 text-3xl font-semibold text-white">
                  Member Corporations
                </h1>
                <p className="mt-2 text-gray-400">
                  Browse all corporations in this alliance. Click on a
                  corporation to see detailed information and member statistics.
                </p>
                {corporationsPageInfo?.totalCount !== undefined && (
                  <p className="mt-1 text-sm text-gray-500">
                    Total: {corporationsPageInfo.totalCount.toLocaleString()}{" "}
                    corporations
                  </p>
                )}
              </div>
              {/* Member Corporation Table  */}
              <CorporationTable
                corporations={corporations}
                loading={corporationsLoading}
              />
              {corporations.length > 0 && (
                <div className="mt-6">
                  <Paginator
                    hasNextPage={corporationsPageInfo?.hasNextPage ?? false}
                    hasPrevPage={corporationsPageInfo?.hasPreviousPage ?? false}
                    onNext={handleCorporationsNext}
                    onPrev={handleCorporationsPrev}
                    onFirst={handleCorporationsFirst}
                    onLast={handleCorporationsLast}
                    loading={corporationsLoading}
                    currentPage={corporationsPage}
                    totalPages={corporationsTotalPages}
                    pageSize={corporationsPageSize}
                    onPageSizeChange={(size) => {
                      setCorporationsPageSize(size);
                      setCorporationsPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
