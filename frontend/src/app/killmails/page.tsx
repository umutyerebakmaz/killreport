"use client";

import { useKillmailsQuery } from "@/generated/graphql";
import Link from "next/link";
import { useState } from "react";

export default function KillmailsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);

  const { data, loading, error } = useKillmailsQuery({
    variables: {
      first: pageSize,
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-300">Loading killmails...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  const killmails = data?.killmails?.edges || [];
  const pageInfo = data?.killmails?.pageInfo;

  return (
    <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Recent Killmails</h1>
        <p className="mt-2 text-gray-400">
          Latest killmails from EVE Online universe
        </p>
        {pageInfo && (
          <p className="mt-1 text-sm text-gray-500">
            Total: {pageInfo.totalCount?.toLocaleString()} killmails
          </p>
        )}
      </div>

      {/* Killmails List */}
      <div className="space-y-4">
        {killmails.map((edge) => {
          const km = edge.node;
          if (!km) return null;

          const finalBlowAttacker = km.attackers?.find((a) => a?.finalBlow);
          const attackerCount = km.attackers?.length || 0;

          return (
            <Link
              key={km.id}
              href={`/killmails/${km.killmailId}`}
              className="block transition-all duration-200 rounded-lg bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10 hover:bg-white/10"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Victim Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium text-red-400 rounded bg-red-400/10">
                          LOSS
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(km.killmailTime).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {km.victim?.character?.name || "Unknown"}
                        </span>
                        {km.victim?.corporation && (
                          <span className="text-sm text-gray-400">
                            [{km.victim.corporation.name}]
                          </span>
                        )}
                        {km.victim?.alliance && (
                          <span className="text-sm text-gray-500">
                            ({km.victim.alliance.name})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">
                          {km.victim?.shipType?.name || "Unknown Ship"}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-500">
                          {km.solarSystem?.name || "Unknown System"}
                        </span>
                        {km.solarSystem?.constellation?.region && (
                          <>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-600">
                              {km.solarSystem.constellation.region.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Final Blow & Stats */}
                  <div className="text-right shrink-0">
                    {finalBlowAttacker && (
                      <div className="mb-1">
                        <div className="text-sm text-green-400">
                          {finalBlowAttacker.character?.name || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {finalBlowAttacker.shipType?.name || "Unknown Ship"}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      {attackerCount} attacker{attackerCount !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-gray-600">
                      {km.victim?.damageTaken?.toLocaleString()} dmg
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {pageInfo && pageInfo.totalPages && pageInfo.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            disabled={!pageInfo.hasPreviousPage}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-white/5 inset-ring inset-ring-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {pageInfo.currentPage} of {pageInfo.totalPages}
          </span>
          <button
            disabled={!pageInfo.hasNextPage}
            onClick={() =>
              setCurrentPage((p) => Math.min(pageInfo.totalPages!, p + 1))
            }
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-white/5 inset-ring inset-ring-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {killmails.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-400">No killmails found</p>
        </div>
      )}
    </div>
  );
}
