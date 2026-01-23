"use client";

import KillmailsTable from "@/components/KillmailsTable";
import { Loader } from "@/components/Loader/Loader";
import MemberDeltaBadge from "@/components/MemberDeltaBadge/MemberDeltaBadge";
import Paginator from "@/components/Paginator/Paginator";
import Tooltip from "@/components/Tooltip/Tooltip";
import TotalMemberBadge from "@/components/TotalMemberBadge/TotalMemberBadge";
import {
  useCorporationKillmailsQuery,
  useCorporationQuery,
  useKillmailsDateCountsQuery,
} from "@/generated/graphql";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";

interface CorporationDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "attributes" | "killmails" | "members";

export default function CorporationDetailPage({
  params,
}: CorporationDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const pageSizeFromUrl = Number(searchParams.get("pageSize")) || 25;
  const tabFromUrl = (searchParams.get("tab") as TabType) || "attributes";

  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);

  const { data, loading, error } = useCorporationQuery({
    variables: { id: parseInt(id) },
  });

  // Fetch killmails when killmails tab is active
  const { data: killmailsData, loading: killmailsLoading } =
    useCorporationKillmailsQuery({
      variables: {
        filter: {
          corporationId: parseInt(id),
          page: currentPage,
          limit: pageSize,
        },
      },
      skip: activeTab !== "killmails", // Only fetch when killmails tab is active
    });

  // Fetch date counts for correct totals per date
  const { data: dateCountsData } = useKillmailsDateCountsQuery({
    variables: {
      filter: {
        corporationId: parseInt(id),
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
    router.push(`/corporations/${id}?${params.toString()}`, { scroll: false });
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
    return <Loader fullHeight size="lg" text="Loading corporation..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const corporation = data?.corporation;

  if (!corporation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Corporation not found</div>
      </div>
    );
  }

  const tabs = [
    { id: "attributes" as TabType, label: "Attributes" },
    { id: "killmails" as TabType, label: "Killmails" },
    { id: "members" as TabType, label: "Members" },
  ];

  // Delta verilerini al (haftalık değişim)
  const memberDelta7d = corporation.metrics?.memberCountDelta7d ?? null;
  const memberGrowthRate7d =
    corporation.metrics?.memberCountGrowthRate7d ?? null;
  // Date founded'ı formatla (DD.MM.YYYY)
  const foundedDate = corporation.date_founded
    ? new Date(corporation.date_founded).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "Unknown";

  return (
    <main>
      <div className="alliance-detail-card">
        {/* Logo and Corporation Name */}
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center justify-center gap-6">
            <img
              src={`https://images.evetech.net/corporations/${corporation.id}/logo?size=128`}
              alt={corporation.name}
              width={128}
              height={128}
              className="shadow-md"
            />
            <div className="flex-1">
              <h1 className="text-4xl font-bold">{corporation.name}</h1>
              <div className="mt-2">
                <Tooltip content="Corporation Ticker" position="top">
                  <span className="py-1 text-base font-bold text-green-500">
                    [{corporation.ticker}]
                  </span>
                </Tooltip>
              </div>

              {/* Alliance Link */}
              {corporation.alliance && (
                <div className="mt-3">
                  <Tooltip content="Alliance" position="top">
                    <Link
                      href={`/alliances/${corporation.alliance.id}`}
                      prefetch={false}
                      className="inline-flex items-center gap-2 text-base font-bold text-yellow-400 hover:text-yellow-300"
                    >
                      {corporation.alliance.name}
                    </Link>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          {/* Metric Container */}
          <div className="flex items-center gap-4">
            {/* member count */}
            <TotalMemberBadge count={corporation.member_count} />

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
            <div className="p-6 bg-white/5 border-white/10">
              <h2 className="mb-4 text-2xl font-bold">Attributes</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400">Corporation Name</span>
                  <span className="ml-2 font-semibold">{corporation.name}</span>
                </div>
                <div>
                  <span className="text-gray-400">Ticker</span>
                  <span className="ml-2 font-semibold">
                    {corporation.ticker}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">CEO</span>
                  <span className="ml-2 font-semibold">
                    {corporation.ceo ? (
                      <Link
                        href={`/characters/${corporation.ceo.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {corporation.ceo.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Creator</span>
                  <span className="ml-2 font-semibold">
                    {corporation.creator ? (
                      <Link
                        href={`/characters/${corporation.creator.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {corporation.creator.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Member Count</span>
                  <span className="ml-2 font-semibold">
                    {corporation.member_count?.toLocaleString() || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Tax Rate</span>
                  <span className="ml-2 font-semibold">
                    {corporation.tax_rate
                      ? `${(corporation.tax_rate * 100).toFixed(1)}%`
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Founded</span>
                  <span className="ml-2 font-semibold">{foundedDate}</span>
                </div>
                <div>
                  <span className="text-gray-400">Alliance</span>
                  <span className="ml-2 font-semibold">
                    {corporation.alliance ? (
                      <Link
                        href={`/alliances/${corporation.alliance.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        [{corporation.alliance.ticker}]{" "}
                        {corporation.alliance.name}
                      </Link>
                    ) : (
                      <span className="text-gray-500">No Alliance</span>
                    )}
                  </span>
                </div>
                {corporation.url && (
                  <div className="col-span-2">
                    <span className="text-gray-400">Website</span>
                    <a
                      href={corporation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 font-semibold text-cyan-400 hover:text-cyan-300"
                    >
                      {corporation.url}
                    </a>
                  </div>
                )}
              </div>
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
                corporationId={parseInt(id)}
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

          {activeTab === "members" && (
            <div className="p-6 bg-white/5 border-white/10">
              <h2 className="mb-4 text-2xl font-bold">Members</h2>
              <p className="text-gray-400">
                Corporation members will be displayed here
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
