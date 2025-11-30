"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import SecurityBadge from "@/components/SecurityBadge/SecurityBadge";
import SecurityStatsBar from "@/components/SecurityBadge/SecurityStatsBar";
import { useConstellationQuery } from "@/generated/graphql";
import { GlobeAltIcon, MapIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { use, useState } from "react";

interface ConstellationDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "overview" | "systems";

export default function ConstellationDetailPage({
  params,
}: ConstellationDetailPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const { data, loading, error } = useConstellationQuery({
    variables: { id: parseInt(id) },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 rounded-full animate-spin border-cyan-500 border-t-transparent" />
          <span className="text-lg">Loading constellation...</span>
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

  const constellation = data?.constellation;

  if (!constellation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Constellation not found</div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as TabType, label: "Overview" },
    {
      id: "systems" as TabType,
      label: `Solar Systems (${constellation.solarSystemCount})`,
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: "Regions", href: "/regions" },
          constellation.region
            ? {
                label: constellation.region.name,
                href: `/regions/${constellation.region.id}`,
              }
            : { label: "Unknown Region" },
          { label: constellation.name },
        ]}
      />

      <div className="constellation-detail-card">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-24 h-24 shadow-md bg-gray-800/50 shrink-0">
              <MapIcon className="w-12 h-12 text-purple-500" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">
                {constellation.name}
              </h1>
              {constellation.region && (
                <div className="flex items-center gap-2 mt-2 text-gray-400">
                  <GlobeAltIcon className="w-4 h-4 text-cyan-500" />
                  <span>Region:</span>
                  <Link
                    href={`/regions/${constellation.region.id}`}
                    className="transition-colors text-cyan-400 hover:text-cyan-300"
                  >
                    {constellation.region.name}
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-orange-400" />
                  <span className="font-medium text-orange-300">
                    {constellation.solarSystemCount}
                  </span>
                  <span className="text-gray-500">Solar Systems</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Stats Card */}
          {constellation.securityStats && (
            <div className="bg-white/5 border border-white/10 p-4 min-w-[280px]">
              <h3 className="mb-3 text-sm font-medium text-gray-400">
                Security Distribution
              </h3>
              <SecurityStatsBar
                stats={{
                  highSec: constellation.securityStats.highSec,
                  lowSec: constellation.securityStats.lowSec,
                  nullSec: constellation.securityStats.nullSec,
                  wormhole: constellation.securityStats.wormhole,
                }}
              />
              {constellation.securityStats.avgSecurity != null && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10">
                  <span className="text-sm text-gray-400">
                    Average Security:
                  </span>
                  <span
                    className={`font-mono font-medium ${
                      constellation.securityStats.avgSecurity >= 0.5
                        ? "text-green-400"
                        : constellation.securityStats.avgSecurity > 0
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {constellation.securityStats.avgSecurity.toFixed(2)}
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
              {/* Constellation Info */}
              <div className="p-6 border bg-white/5 border-white/10">
                <h2 className="mb-4 text-xl font-bold">
                  Constellation Information
                </h2>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Constellation ID</dt>
                    <dd className="font-mono text-gray-200">
                      {constellation.id}
                    </dd>
                  </div>
                  {constellation.region && (
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Region</dt>
                      <dd>
                        <Link
                          href={`/regions/${constellation.region.id}`}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          {constellation.region.name}
                        </Link>
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Solar Systems</dt>
                    <dd className="font-medium text-orange-300">
                      {constellation.solarSystemCount}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Security Breakdown */}
              <div className="p-6 border bg-white/5 border-white/10">
                <h2 className="mb-4 text-xl font-bold">Security Breakdown</h2>
                {constellation.securityStats && (
                  <dl className="space-y-3">
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full" />
                        <span className="text-gray-400">High Security</span>
                      </dt>
                      <dd className="font-medium text-green-400">
                        {constellation.securityStats.highSec} systems
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                        <span className="text-gray-400">Low Security</span>
                      </dt>
                      <dd className="font-medium text-yellow-400">
                        {constellation.securityStats.lowSec} systems
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <span className="text-gray-400">Null Security</span>
                      </dt>
                      <dd className="font-medium text-red-400">
                        {constellation.securityStats.nullSec} systems
                      </dd>
                    </div>
                    {(constellation.securityStats.wormhole ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <dt className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-purple-500 rounded-full" />
                          <span className="text-gray-400">Wormhole</span>
                        </dt>
                        <dd className="font-medium text-purple-400">
                          {constellation.securityStats.wormhole} systems
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>

              {/* Position Info */}
              {constellation.position && (
                <div className="p-6 border bg-white/5 border-white/10 md:col-span-2">
                  <h2 className="mb-4 text-xl font-bold">Position in Space</h2>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-400">X</div>
                      <div className="font-mono text-gray-200">
                        {constellation.position.x.toExponential(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Y</div>
                      <div className="font-mono text-gray-200">
                        {constellation.position.y.toExponential(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Z</div>
                      <div className="font-mono text-gray-200">
                        {constellation.position.z.toExponential(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "systems" && (
            <div className="overflow-hidden border border-white/10">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                      Solar System
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                      Security Status
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase">
                      Security Class
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {constellation.solarSystems &&
                  constellation.solarSystems.length > 0 ? (
                    constellation.solarSystems.map((system) => (
                      <tr
                        key={system.id}
                        className="transition-colors hover:bg-white/5"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <MapPinIcon className="w-5 h-5 text-orange-400 shrink-0" />
                            <Link
                              href={`/solar-systems/${system.id}`}
                              className="font-medium transition-colors text-cyan-400 hover:text-cyan-300"
                            >
                              {system.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <SecurityBadge
                            securityStatus={system.security_status}
                          />
                        </td>
                        <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                          {system.security_class || "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        No solar systems found
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
