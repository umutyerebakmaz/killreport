"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import SecurityStatsBar from "@/components/SecurityBadge/SecurityStatsBar";
import { useRegionQuery } from "@/generated/graphql";
import { GlobeAltIcon, MapIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { use, useState } from "react";

interface RegionDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "overview" | "constellations";

export default function RegionDetailPage({ params }: RegionDetailPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const { data, loading, error } = useRegionQuery({
    variables: { id: parseInt(id) },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 rounded-full animate-spin border-cyan-500 border-t-transparent" />
          <span className="text-lg">Loading region...</span>
        </div>
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

  const region = data?.region;

  if (!region) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Region not found</div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as TabType, label: "Overview" },
    {
      id: "constellations" as TabType,
      label: `Constellations (${region.constellationCount})`,
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[{ label: "Regions", href: "/regions" }, { label: region.name }]}
      />

      <div className="region-detail-card">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-24 h-24 shadow-md bg-gray-800/50 shrink-0">
              <GlobeAltIcon className="w-12 h-12 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">{region.name}</h1>
              {region.description && (
                <p className="max-w-2xl mt-2 text-gray-400">
                  {region.description}
                </p>
              )}
              <div className="flex items-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapIcon className="w-5 h-5 text-purple-400" />
                  <span className="font-medium text-purple-300">
                    {region.constellationCount}
                  </span>
                  <span className="text-gray-500">Constellations</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-orange-400" />
                  <span className="font-medium text-orange-300">
                    {region.solarSystemCount}
                  </span>
                  <span className="text-gray-500">Systems</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Stats Card */}
          {region.securityStats && (
            <div className="bg-white/5 border border-white/10 p-4 min-w-[280px]">
              <h3 className="mb-3 text-sm font-medium text-gray-400">
                Security Distribution
              </h3>
              <SecurityStatsBar
                stats={{
                  highSec: region.securityStats.highSec,
                  lowSec: region.securityStats.lowSec,
                  nullSec: region.securityStats.nullSec,
                  wormhole: region.securityStats.wormhole,
                }}
              />
              {region.securityStats.avgSecurity != null && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10">
                  <span className="text-sm text-gray-400">
                    Average Security:
                  </span>
                  <span
                    className={`font-medium ${
                      region.securityStats.avgSecurity >= 0.5
                        ? "text-green-400"
                        : region.securityStats.avgSecurity > 0
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {region.securityStats.avgSecurity.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-8 border-b border-white/10">
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
          {activeTab === "overview" && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Region Info */}
              <div className="p-6 border bg-white/5 border-white/10">
                <h2 className="mb-4 text-xl font-bold">Region Information</h2>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Region ID</dt>
                    <dd className="text-gray-200">{region.id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Constellations</dt>
                    <dd className="font-medium text-purple-300">
                      {region.constellationCount}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Solar Systems</dt>
                    <dd className="font-medium text-orange-300">
                      {region.solarSystemCount}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Security Breakdown */}
              <div className="p-6 border bg-white/5 border-white/10">
                <h2 className="mb-4 text-xl font-bold">Security Breakdown</h2>
                {region.securityStats && (
                  <dl className="space-y-3">
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full" />
                        <span className="text-gray-400">High Security</span>
                      </dt>
                      <dd className="font-medium text-green-400">
                        {region.securityStats.highSec} systems
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                        <span className="text-gray-400">Low Security</span>
                      </dt>
                      <dd className="font-medium text-yellow-400">
                        {region.securityStats.lowSec} systems
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <span className="text-gray-400">Null Security</span>
                      </dt>
                      <dd className="font-medium text-red-400">
                        {region.securityStats.nullSec} systems
                      </dd>
                    </div>
                    {region.securityStats.wormhole > 0 && (
                      <div className="flex items-center justify-between">
                        <dt className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-purple-500 rounded-full" />
                          <span className="text-gray-400">Wormhole</span>
                        </dt>
                        <dd className="font-medium text-purple-400">
                          {region.securityStats.wormhole} systems
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>
          )}

          {activeTab === "constellations" && (
            <div className="overflow-hidden border border-white/10">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                      Constellation
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                      Systems
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase min-w-[180px]">
                      Security Distribution
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                      Avg Security
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {region.constellations && region.constellations.length > 0 ? (
                    region.constellations.map((constellation) => (
                      <tr
                        key={constellation.id}
                        className="transition-colors hover:bg-white/5"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <MapIcon className="w-5 h-5 text-purple-400 shrink-0" />
                            <Link
                              href={`/constellations/${constellation.id}`}
                              className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                            >
                              {constellation.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-orange-400" />
                            <span className="text-orange-300">
                              {constellation.solarSystemCount}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {constellation.securityStats && (
                            <SecurityStatsBar
                              stats={{
                                highSec: constellation.securityStats.highSec,
                                lowSec: constellation.securityStats.lowSec,
                                nullSec: constellation.securityStats.nullSec,
                              }}
                              showLabels={false}
                              compact={false}
                            />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {constellation.securityStats?.avgSecurity !== null &&
                          constellation.securityStats?.avgSecurity !==
                            undefined ? (
                            <span
                              className={`${
                                constellation.securityStats.avgSecurity >= 0.5
                                  ? "text-green-400"
                                  : constellation.securityStats.avgSecurity > 0
                                  ? "text-yellow-400"
                                  : "text-red-400"
                              }`}
                            >
                              {constellation.securityStats.avgSecurity.toFixed(
                                2
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        No constellations found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
