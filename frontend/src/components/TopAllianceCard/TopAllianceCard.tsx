"use client";

import Tooltip from "@/components/Tooltip/Tooltip";
import Link from "next/link";

export interface TopAlliance {
  id: number;
  name: string;
  ticker?: string | null;
  killCount: number;
}

export interface TopAllianceCardProps {
  title: string;
  subtitle?: string;
  alliances: TopAlliance[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopAllianceCard({
  title,
  subtitle,
  alliances,
  loading = false,
  emptyText = "No alliances",
}: TopAllianceCardProps) {
  if (loading) {
    return (
      <div>
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="top-alliance-card">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      {alliances.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {alliances.map((alliance, index) => {
            return (
              <div
                key={alliance.id}
                className="p-3 transition-colors duration-100 bg-neutral-900 hover:bg-neutral-800"
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8 shrink-0">
                    <span
                      className={`text-xl font-black tabular-nums ${
                        index === 0
                          ? "text-yellow-400"
                          : index === 1
                            ? "text-gray-300"
                            : index === 2
                              ? "text-amber-600"
                              : "text-gray-600"
                      }`}
                    >
                      #{index + 1}
                    </span>
                  </div>

                  {/* Logo */}
                  <div className="relative shrink-0">
                    <img
                      src={`https://images.evetech.net/alliances/${alliance.id}/logo?size=128`}
                      alt={alliance.name}
                      width={48}
                      height={48}
                      className="shadow-md bg-black/50 ring-1 ring-black/50"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                    <div className="flex flex-col min-w-0 gap-0.5 leading-tight">
                      <Tooltip
                        content="Show alliance info"
                        className="w-full! min-w-0"
                      >
                        <Link
                          href={`/alliances/${alliance.id}?tab=killmails`}
                          className="block min-w-0 font-medium leading-tight text-gray-400 truncate hover:text-blue-400"
                          prefetch={false}
                        >
                          {alliance.name}
                        </Link>
                      </Tooltip>
                      {alliance.ticker && (
                        <span className="block text-sm leading-tight text-gray-500 truncate">
                          &lt;{alliance.ticker}&gt;
                        </span>
                      )}
                    </div>

                    {/* Kill Count */}
                    <span className="text-base font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                      {alliance.killCount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
