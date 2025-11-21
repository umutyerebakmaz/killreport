"use client";

import Tooltip from "@/components/Tooltip/Tooltip";
import { useCharacterQuery } from "@/generated/graphql";
import { getSecurityStatusColor } from "@/utils/securityStatus";
import {
  CakeIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { use, useState } from "react";

interface CharacterDetailPageProps {
  params: Promise<{ id: string }>;
}

type TabType = "attributes" | "killmails" | "statistics";

export default function CharacterDetailPage({
  params,
}: CharacterDetailPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>("attributes");

  const { data, loading, error } = useCharacterQuery({
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

  // Birthday formatla
  const birthday = character.birthday
    ? new Date(character.birthday).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  return (
    <main>
      <div className="alliance-detail-card">
        {/* Portrait and Character Name */}
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center justify-center gap-6">
            <img
              src={`https://images.evetech.net/characters/${character.id}/portrait?size=256`}
              alt={character.name}
              width={128}
              height={128}
              className="rounded shadow-md"
            />
            <div className="flex-1">
              <h1 className="text-4xl font-bold">{character.name}</h1>

              {/* Corporation */}
              {character.corporation && (
                <div className="mt-3">
                  <Tooltip content="Corporation" position="top">
                    <Link
                      href={`/corporations/${character.corporation.id}`}
                      className="inline-flex items-center gap-2 text-green-400 hover:text-green-300"
                    >
                      <span className="text-base font-bold">
                        {character.corporation.name}
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
                      className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300"
                    >
                      <span className="text-base font-bold">
                        {character.alliance.name}
                      </span>
                    </Link>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          {/* Metric Container */}
          <div className="flex items-center gap-4">
            {/* Security Status */}
            <Tooltip content="Security Status" position="top">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className={`w-6 h-6 ${securityColor}`} />
                <span className={`text-lg font-bold ${securityColor}`}>
                  {securityStatus}
                </span>
              </div>
            </Tooltip>

            {/* Birthday */}
            <Tooltip content={`Birthday: ${birthday}`} position="top">
              <div className="flex items-center gap-2">
                <CakeIcon className="w-6 h-6 text-pink-400" />
              </div>
            </Tooltip>

            {/* Gender Icon */}
            <Tooltip
              content={`Gender: ${character.gender || "Unknown"}`}
              position="top"
            >
              <div className="flex items-center gap-2">
                {character.gender === "male" ? (
                  <svg
                    className="w-6 h-6 text-cyan-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7l-1.5 1.5m0 0l-3 3m3-3v3m0-3h-3m6-3h2v2m-5-5l5 5"
                    />
                  </svg>
                ) : (
                  <UserIcon className="w-6 h-6 text-gray-400" />
                )}
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
                  <span className="text-gray-400">Corporation</span>
                  <span className="ml-2 font-semibold">
                    {character.corporation ? (
                      <Link
                        href={`/corporations/${character.corporation.id}`}
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
                  <span className="text-gray-400">Birthday</span>
                  <span className="ml-2 font-semibold">{birthday}</span>
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
                  <span className="text-gray-400">Bloodline ID</span>
                  <span className="ml-2 font-semibold">
                    {character.bloodline_id}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Race ID</span>
                  <span className="ml-2 font-semibold">
                    {character.race_id}
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
            <div className="p-6 bg-white/5 border-white/10">
              <h2 className="mb-4 text-2xl font-bold">Killmails</h2>
              <p className="text-gray-400">Killmail tracking coming soon...</p>
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
