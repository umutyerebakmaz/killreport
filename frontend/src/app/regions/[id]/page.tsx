"use client";

import Tooltip from "@/components/Tooltip/Tooltip";
import { useRegionQuery } from "@/generated/graphql";
import { GlobeAltIcon, MapIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { use, useState } from "react";

interface RegionDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "attributes" | "constellations";

export default function RegionDetailPage({ params }: RegionDetailPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>("attributes");

  const { data, loading, error } = useRegionQuery({
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

  const region = data?.region;

  if (!region) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Region not found</div>
      </div>
    );
  }

  const tabs = [
    { id: "attributes" as TabType, label: "Attributes" },
    { id: "constellations" as TabType, label: "Constellations" },
  ];

  const constellationCount = region.constellations?.length ?? 0;
  const systemCount =
    region.constellations?.reduce(
      (acc, c) => acc + (c.solarSystems?.length ?? 0),
      0
    ) ?? 0;

  return (
    <main>
      <div className="region-detail-card">
        {/* Icon and Region Name */}
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center justify-center w-32 h-32 rounded shadow-md bg-gray-800/50">
              <GlobeAltIcon className="w-16 h-16 text-cyan-500" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold">{region.name}</h1>
              {region.description && (
                <p className="mt-2 text-gray-400">{region.description}</p>
              )}
            </div>
          </div>

          {/* Metric Container */}
          <div className="flex items-center gap-4">
            {/* Constellation count */}
            <Tooltip content="Total Constellations" position="top">
              <div className="flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">
                  {constellationCount}
                </span>
              </div>
            </Tooltip>
            {/* System count */}
            <Tooltip content="Total Solar Systems" position="top">
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-5 h-5 text-orange-400" />
                <span className="text-sm font-medium text-orange-300">
                  {systemCount}
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
                  <span className="text-gray-400">Region ID</span>
                  <span className="ml-2 font-semibold">{region.id}</span>
                </div>
                <div>
                  <span className="text-gray-400">Constellations</span>
                  <span className="ml-2 font-semibold">
                    {constellationCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Solar Systems</span>
                  <span className="ml-2 font-semibold">{systemCount}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "constellations" && (
            <div className="p-6 bg-white/5 border-white/10">
              <h2 className="mb-4 text-2xl font-bold">
                Constellations ({constellationCount})
              </h2>
              {region.constellations && region.constellations.length > 0 ? (
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {region.constellations.map((constellation) => (
                        <tr
                          key={constellation.id}
                          className="transition-colors hover:bg-white/5"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <MapIcon className="w-5 h-5 text-purple-400" />
                              <Link
                                href={`/constellations/${constellation.id}`}
                                className="text-cyan-400 hover:text-cyan-300"
                              >
                                {constellation.name}
                              </Link>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <MapPinIcon className="w-4 h-4 text-orange-400" />
                              {constellation.solarSystems?.length ?? 0}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400">No constellations found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
