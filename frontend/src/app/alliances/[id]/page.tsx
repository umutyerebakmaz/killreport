"use client";

import { Loader } from "@/components/Loader/Loader";
import MemberDeltaBadge from "@/components/MemberDeltaBadge/MemberDeltaBadge";
import TotalCorporationBadge from "@/components/TotalCorporationMember/TotalCorporationBadge";
import TotalMemberBadge from "@/components/TotalMemberBadge/TotalMemberBadge";
import { useAllianceQuery } from "@/generated/graphql";
import Link from "next/link";
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
    { id: "war-history" as TabType, label: "War History" },
    { id: "members" as TabType, label: "Members" },
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

          {activeTab === "war-history" && (
            <div className="detail-tab-content">
              <h2 className="mb-4 text-2xl font-bold">War History</h2>
              <p className="text-gray-300">
                War history information will be displayed here.
              </p>
            </div>
          )}

          {activeTab === "members" && (
            <div className="detail-tab-content">
              <h2 className="mb-4 text-2xl font-bold">
                Member Corporations ({alliance.corporations?.length || 0})
              </h2>
              {alliance.corporations && alliance.corporations.length > 0 ? (
                <div className="overflow-hidden border border-white/10">
                  <table className="table">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="th-cell">Corporation</th>
                        <th className="th-cell">Ticker</th>
                        <th className="th-cell">Members</th>
                        <th className="th-cell">CEO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {alliance.corporations.map((corp) => (
                        <tr
                          key={corp.id}
                          className="transition-colors hover:bg-white/5"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <img
                                src={`https://images.evetech.net/Corporation/${corp.id}_64.png`}
                                alt={corp.name}
                                width={32}
                                height={32}
                              />
                              <Link
                                href={`/corporations/${corp.id}`}
                                prefetch={false}
                                className="text-cyan-400 hover:text-cyan-300"
                              >
                                {corp.name}
                              </Link>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-yellow-400 whitespace-nowrap">
                            [{corp.ticker}]
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                            <TotalMemberBadge count={corp.member_count} />
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap">
                            {corp.ceo ? (
                              <Link
                                href={`/characters/${corp.ceo.id}`}
                                prefetch={false}
                                className="text-cyan-400 hover:text-cyan-300"
                              >
                                {corp.ceo.name}
                              </Link>
                            ) : (
                              <span className="text-gray-500">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400">No corporations found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
