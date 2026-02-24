"use client";

import Tooltip from "@/components/Tooltip/Tooltip";
import Link from "next/link";

export interface TopTarget {
  id: number;
  name: string;
  count: number;
}

export interface TopTargetsCardProps {
  title: string;
  subtitle?: string;
  targets: TopTarget[];
  loading?: boolean;
  emptyText?: string;
  targetType: "alliance" | "corporation" | "character";
  linkPrefix: string; // e.g., "/alliances", "/corporations", "/characters"
}

export default function TopTargetsCard({
  title,
  subtitle,
  targets,
  loading = false,
  emptyText = "No targets yet",
  targetType,
  linkPrefix,
}: TopTargetsCardProps) {
  // Get image URL based on target type
  const getImageUrl = (id: number, type: typeof targetType): string => {
    switch (type) {
      case "alliance":
        return `https://images.evetech.net/alliances/${id}/logo?size=128`;
      case "corporation":
        return `https://images.evetech.net/corporations/${id}/logo?size=128`;
      case "character":
        return `https://images.evetech.net/characters/${id}/portrait?size=128`;
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="">
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
    <div className="top-targets">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      {targets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {targets.map((target, index) => (
            <div
              key={target.id}
              className="p-3 transition-colors duration-100 bg-white/5 hover:bg-white/8"
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

                {/* Logo/Portrait */}
                <div className="relative shrink-0">
                  <img
                    src={getImageUrl(target.id, targetType)}
                    alt={target.name}
                    width={48}
                    height={48}
                    className="shadow-md bg-black/50 ring-1 ring-black/50"
                    loading="lazy"
                  />
                </div>

                {/* Info */}
                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                  <Tooltip
                    content={`Show ${targetType} info`}
                    className="w-full! min-w-0"
                  >
                    <Link
                      href={`${linkPrefix}/${target.id}`}
                      className="block min-w-0 font-medium text-gray-400 truncate hover:text-blue-400"
                      prefetch={false}
                    >
                      {target.name}
                    </Link>
                  </Tooltip>

                  {/* Kill Count */}
                  <span className="text-sm font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                    {target.count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
