"use client";

import Tooltip from "@/components/Tooltip/Tooltip";
import { useAllianceQuery } from "@/generated/graphql";
import {
  ArrowTrendingUpIcon,
  StarIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { use, useState } from "react";

interface AllianceDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "attributes" | "war-history" | "members";

export default function AllianceDetailPage({
  params,
}: AllianceDetailPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>("attributes");

  const { data, loading, error } = useAllianceQuery({
    variables: { id: parseInt(id) },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
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
    { id: "war-history" as TabType, label: "War History" },
    { id: "members" as TabType, label: "Members" },
  ];

  // Delta verilerini al
  const memberDelta30d = alliance.metrics?.memberCountDelta30d ?? null;
  const memberGrowthRate30d =
    alliance.metrics?.memberCountGrowthRate30d ?? null;

  // Delta rengi belirle
  const deltaColor =
    memberDelta30d && memberDelta30d >= 0 ? "text-green-400" : "text-red-400";

  // Tooltip içeriği
  const tooltipContent =
    memberDelta30d !== null
      ? `Member Change (30 days): ${
          memberDelta30d >= 0 ? "+" : ""
        }${memberDelta30d}${
          memberGrowthRate30d !== null
            ? ` (${
                memberGrowthRate30d >= 0 ? "+" : ""
              }${memberGrowthRate30d.toFixed(1)}%)`
            : ""
        }`
      : "No data available";

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
            </div>
          </div>

          {/* Metric Container */}
          <div className="flex items-center gap-4">
            {/*  member count */}
            <Tooltip content="Total Members" position="top">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">
                  {alliance.memberCount}
                </span>
              </div>
            </Tooltip>
            {/* corporation count */}
            <Tooltip content="Total Corporations" position="top">
              <div className="flex items-center gap-2">
                <StarIcon className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-500">
                  {alliance.corporationCount}
                </span>
              </div>
            </Tooltip>
            {/* member delta 30d */}
            <Tooltip content={tooltipContent} position="top">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon
                  className={`w-5 h-5 ${
                    memberDelta30d !== null ? deltaColor : "text-gray-500"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    memberDelta30d !== null ? deltaColor : "text-gray-500"
                  }`}
                >
                  {memberDelta30d !== null ? (
                    <>
                      {memberDelta30d >= 0 ? "+" : ""}
                      {memberDelta30d}
                    </>
                  ) : (
                    "N/A"
                  )}
                </span>
              </div>
            </Tooltip>
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
                  <span className="text-gray-400">Executor</span>
                  <span className="ml-2 font-semibold">
                    {alliance.executor?.name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Short Name</span>
                  <span className="ml-2 font-semibold">{alliance.ticker}</span>
                </div>
                <div>
                  <span className="text-gray-400">Created By Corporation</span>
                  <span className="ml-2 font-semibold">
                    {alliance.createdByCorporation?.name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Created By</span>
                  <span className="ml-2 font-semibold">
                    {alliance.createdBy?.name}
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

          {activeTab === "war-history" && (
            <div className="p-6 bg-white/5 border-white/10">
              <h2 className="mb-4 text-2xl font-bold">War History</h2>
              <p className="text-gray-300">
                War history information will be displayed here.
              </p>
            </div>
          )}

          {activeTab === "members" && (
            <div className="p-6 bg-white/5 border-white/10">
              <h2 className="mb-4 text-2xl font-bold">Members</h2>
              <p className="text-gray-300">
                Member corporations will be displayed here.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
