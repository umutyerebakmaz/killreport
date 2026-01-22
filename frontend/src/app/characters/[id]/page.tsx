"use client";

import KillmailsTable from "@/components/KillmailsTable";
import { Loader } from "@/components/Loader/Loader";
import Paginator from "@/components/Paginator/Paginator";
import Tooltip from "@/components/Tooltip/Tooltip";
import {
  useCharacterKillmailsQuery,
  useCharacterQuery,
} from "@/generated/graphql";
import { getSecurityStatusColor } from "@/utils/securityStatus";
import Link from "next/link";
import { use, useCallback, useMemo, useState } from "react";

interface CharacterDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "attributes" | "killmails" | "statistics";

export default function CharacterDetailPage({
  params,
}: CharacterDetailPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>("attributes");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, loading, error } = useCharacterQuery({
    variables: { id: parseInt(id) },
  });

  // Fetch killmails when killmails tab is active
  const { data: killmailsData, loading: killmailsLoading } =
    useCharacterKillmailsQuery({
      variables: {
        characterId: parseInt(id),
        first: pageSize,
        after:
          currentPage > 1
            ? btoa(`cursor:${(currentPage - 1) * pageSize}`)
            : undefined,
      },
      skip: activeTab !== "killmails", // Only fetch when killmails tab is active
    });

  // Memoize killmails array
  const killmails = useMemo(
    () =>
      killmailsData?.characterKillmails.edges.map((edge) => edge.node) || [],
    [killmailsData],
  );

  const pageInfo = killmailsData?.characterKillmails.pageInfo;
  const totalPages = pageInfo?.totalPages || 0;

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

  const tabs = [
    { id: "attributes" as TabType, label: "Attributes" },
    { id: "killmails" as TabType, label: "Killmails" },
    { id: "statistics" as TabType, label: "Statistics" },
  ];

  const securityStatus = character.security_status?.toFixed(1) ?? "N/A";
  const securityColor = getSecurityStatusColor(character.security_status);

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

  return (
    <main>
      <div className="alliance-detail-card">
        {/* Portrait and Character Name */}
        <div className="flex items-center justify-center gap-6">
          <img
            src={`https://images.evetech.net/characters/${character.id}/portrait?size=256`}
            alt={character.name}
            width={128}
            height={128}
            className="shadow-md"
          />
          <div className="flex-1">
            <h1 className="text-4xl font-bold">{character.name}</h1>

            {/* Corporation */}
            {character.corporation && (
              <div className="mt-3">
                <Tooltip content="Corporation" position="top">
                  <Link
                    href={`/corporations/${character.corporation.id}`}
                    prefetch={false}
                    className="inline-flex items-center gap-2 hover:text-gray-300"
                  >
                    <span className="text-base font-semibold">
                      {`Member of ${character.corporation.name} [${character.corporation.ticker}]`}
                    </span>
                  </Link>
                </Tooltip>
              </div>
            )}

            {/* Alliance */}
            {character.alliance && (
              <div className="mt-2">
                <Tooltip content="Alliance" position="top">
                  <Link
                    href={`/alliances/${character.alliance.id}`}
                    prefetch={false}
                    className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300"
                  >
                    <span className="text-base font-bold">
                      {character.alliance.name}
                    </span>
                  </Link>
                </Tooltip>
              </div>
            )}

            {/* Age */}
            <div className="mt-2">
              <span className="text-sm text-gray-400">{age}</span>
            </div>
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
                  <span className="text-gray-400">Corporation</span>
                  <span className="ml-2 font-semibold">
                    {character.corporation ? (
                      <Link
                        href={`/corporations/${character.corporation.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {character.corporation.name}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Alliance</span>
                  <span className="ml-2 font-semibold">
                    {character.alliance ? (
                      <Link
                        href={`/alliances/${character.alliance.id}`}
                        prefetch={false}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {character.alliance.name}
                      </Link>
                    ) : (
                      "None"
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Born</span>
                  <span className="ml-2 font-semibold">{bornDate}</span>
                </div>
                <div>
                  <span className="text-gray-400">Security Status</span>
                  <span className={`ml-2 font-semibold ${securityColor}`}>
                    {securityStatus}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Gender</span>
                  <span className="ml-2 font-semibold capitalize">
                    {character.gender}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Race</span>
                  <span className="ml-2 font-semibold">
                    {character.race?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Bloodline</span>
                  <span className="ml-2 font-semibold">
                    {character.bloodline?.name || "N/A"}
                  </span>
                </div>
                {character.title && (
                  <div className="col-span-2">
                    <span className="text-gray-400">Title</span>
                    <span className="ml-2 font-semibold">
                      {character.title}
                    </span>
                  </div>
                )}
                {character.description && (
                  <div className="col-span-2">
                    <span className="text-gray-400">Description</span>
                    <p className="mt-2 text-sm text-gray-300">
                      {character.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "killmails" && (
            <div className="killmails-tab">
              <h2 className="mb-6 text-2xl font-bold">Killmails</h2>

              <KillmailsTable
                killmails={killmails}
                loading={killmailsLoading}
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
