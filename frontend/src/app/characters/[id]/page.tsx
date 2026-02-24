"use client";

import EveHtmlRenderer from "@/components/EveHtmlRenderer";
import KillmailsTable from "@/components/KillmailsTable";
import { Loader } from "@/components/Loader/Loader";
import Paginator from "@/components/Paginator/Paginator";
import Tooltip from "@/components/Tooltip/Tooltip";
import TopTargetsCard from "@/components/TopTargetsCard";
import {
  useCharacterKillmailsQuery,
  useCharacterQuery,
  useKillmailsDateCountsQuery,
} from "@/generated/graphql";
import { getSecurityStatusColor } from "@/utils/securityStatus";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";

interface CharacterDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "bio" | "killmails" | "statistics";

export default function CharacterDetailPage({
  params,
}: CharacterDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageFromUrl = Number(searchParams.get("page")) || 1;
  const pageSizeFromUrl = Number(searchParams.get("pageSize")) || 25;
  const tabFromUrl = (searchParams.get("tab") as TabType) || "killmails";

  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);

  const { data, loading, error } = useCharacterQuery({
    variables: { id: parseInt(id) },
  });

  // Fetch killmails when killmails tab is active
  const { data: killmailsData, loading: killmailsLoading } =
    useCharacterKillmailsQuery({
      variables: {
        filter: {
          characterId: parseInt(id),
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
        characterId: parseInt(id),
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
    router.push(`/characters/${id}?${params.toString()}`, { scroll: false });
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
    return <Loader fullHeight size="lg" text="Loading character..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const character = data?.character;

  if (!character) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Character not found</div>
      </div>
    );
  }

  // Map alliance targets from GraphQL
  const allianceTargets =
    character?.topAllianceTargets?.map((target) => ({
      id: target.alliance.id,
      name: target.alliance.name,
      count: target.killCount,
    })) || [];

  // Map corporation targets from GraphQL
  const corporationTargets =
    character?.topCorporationTargets?.map((target) => ({
      id: target.corporation.id,
      name: target.corporation.name,
      count: target.killCount,
    })) || [];

  const tabs = [
    { id: "bio" as TabType, label: "Bio" },
    { id: "killmails" as TabType, label: "Killmails" },
    { id: "statistics" as TabType, label: "Statistics" },
  ];

  const securityStatus = character.securityStatus?.toFixed(1) ?? "N/A";
  const securityColor = getSecurityStatusColor(character.securityStatus);

  // Born tarihi formatı: 2023.12.10 17:30
  const formatBornDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  // Yaş hesaplama: 2 years, 4 months and 17 days
  const calculateAge = (dateString: string | null | undefined) => {
    if (!dateString) return "Unknown";
    const birthDate = new Date(dateString);
    const now = new Date();

    let years = now.getFullYear() - birthDate.getFullYear();
    let months = now.getMonth() - birthDate.getMonth();
    let days = now.getDate() - birthDate.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
    if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);

    if (parts.length === 0) return "Today";
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts.join(" and ");
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  };

  const bornDate = formatBornDate(character.birthday);
  const age = calculateAge(character.birthday);
  const updatedAt = formatBornDate(character.updatedAt);
  const updatedAtHuman = calculateAge(character.updatedAt);

  return (
    <main>
      <div className="character-detail-card">
        {/* Portrait and Character Name */}
        <div className="flex items-center justify-center">
          <img
            src={`https://images.evetech.net/characters/${character.id}/portrait?size=256`}
            alt={character.name}
            width={128}
            height={128}
            className="shadow-md"
          />

          {/* Alliance & Corporation Logos - Bottom Right */}
          <div className="flex flex-col">
            {/* Corporation Logo */}
            {character.corporation?.id && (
              <Tooltip
                content={`Corporation: ${
                  character.corporation?.name || "Unknown"
                }`}
              >
                <img
                  src={`https://images.evetech.net/corporations/${character.corporation?.id}/logo?size=64`}
                  alt={character.corporation?.name || "Corporation"}
                  width={64}
                  height={64}
                  className="shadow-md"
                  loading="lazy"
                />
              </Tooltip>
            )}

            {/* Alliance Logo */}
            {character.alliance?.id && (
              <Tooltip
                content={`Alliance: ${character.alliance?.name || "Unknown"}`}
              >
                <img
                  src={`https://images.evetech.net/alliances/${character.alliance?.id}/logo?size=64`}
                  alt={character.alliance?.name || "Alliance"}
                  width={64}
                  height={64}
                  className="shadow-md"
                  loading="lazy"
                />
              </Tooltip>
            )}
          </div>

          <div className="flex-1 min-w-0 pl-6">
            {character.title && (
              <div className="col-span-2">
                <div className="mt-2">
                  <EveHtmlRenderer
                    html={character.title}
                    className="text-sm font-semibold"
                  />
                </div>
              </div>
            )}
            <h1 className="text-4xl font-bold truncate">{character.name}</h1>

            {/* Corporation */}
            {character.corporation && (
              <div className="min-w-0">
                <Tooltip content="Corporation" position="top">
                  <Link
                    href={`/corporations/${character.corporation.id}`}
                    prefetch={false}
                    className="inline-flex items-center max-w-full min-w-0 gap-2 hover:text-gray-300"
                  >
                    <span className="text-base truncate">
                      {`Member of ${character.corporation.name} [${character.corporation.ticker}]`}
                    </span>
                  </Link>
                </Tooltip>
              </div>
            )}

            {/* Alliance */}
            {character.alliance && (
              <div className="min-w-0">
                <Tooltip content="Alliance" position="top">
                  <Link
                    href={`/alliances/${character.alliance.id}`}
                    prefetch={false}
                    className="inline-flex items-center max-w-full min-w-0 gap-2 text-yellow-400 hover:text-yellow-300"
                  >
                    <span className="text-base truncate">
                      {character.alliance.name}
                    </span>
                  </Link>
                </Tooltip>
              </div>
            )}

            {/* Age */}
            <div>
              <span className="text-sm text-gray-400">{age}</span>
            </div>

            {/* Security Status */}
            {character.securityStatus && (
              <div>
                <span
                  className={`text-sm font-semibold ${getSecurityStatusColor(character.securityStatus)}`}
                >
                  {character.securityStatus.toFixed(1)}
                </span>
              </div>
            )}
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
          {activeTab === "bio" && (
            <div className="p-6 bg-white/5 border-white/10">
              <div className="grid grid-cols-2 gap-4">
                {character.description && (
                  <div className="col-span-2">
                    <div className="mt-2">
                      <EveHtmlRenderer html={character.description} />
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-end justify-end col-start-2 col-end-3 text-xs text-gray-500 justify-self-end">
                  <div>{updatedAt}</div>
                  <div>{updatedAtHuman} ago</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "killmails" && (
            <div className="killmails-tab">
              <div className="mb-6">
                {pageInfo?.totalCount !== undefined && (
                  <p className="mt-1 text-sm text-gray-500">
                    Total: {pageInfo.totalCount.toLocaleString()} killmails
                  </p>
                )}
              </div>

              {/* 2-column grid layout */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {/* Left side - Killmails Table (takes 3 columns) */}
                <div className="lg:col-span-3">
                  <KillmailsTable
                    killmails={killmails}
                    loading={killmailsLoading}
                    characterId={parseInt(id)}
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

                {/* Right side - Top Targets Cards */}
                <div className="space-y-6 lg:col-span-1 lg:-mt-9">
                  <TopTargetsCard
                    title="Top Alliance Targets"
                    subtitle="Most killed alliances"
                    targets={allianceTargets}
                    targetType="alliance"
                    linkPrefix="/alliances"
                    emptyText="No alliance targets yet"
                    loading={loading}
                  />

                  <TopTargetsCard
                    title="Top Corp Targets"
                    subtitle="Most killed corporations"
                    targets={corporationTargets}
                    targetType="corporation"
                    linkPrefix="/corporations"
                    emptyText="No corporation targets yet"
                    loading={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "statistics" && (
            <div className="p-6 bg-white/5 border-white/10">
              <h2 className="mb-4 text-2xl font-bold">Statistics</h2>
              <p className="text-gray-400">Statistics coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
