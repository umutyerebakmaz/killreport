"use client";

import Tooltip from "@/components/Tooltip/Tooltip";
import { RegionsQuery } from "@/generated/graphql";
import { GlobeAltIcon, MapIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

// useRegionsQuery'nin döndüğü Region type'ını extract et
type Region = RegionsQuery["regions"]["edges"][number]["node"];

type RegionCardProps = {
  region: Region;
};

export default function RegionCard({ region }: RegionCardProps) {
  const constellationCount = region.constellationCount ?? 0;

  return (
    <div className="region-card">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Region Icon */}
          <div className="flex items-center justify-center w-32 h-32 bg-gray-800/50">
            <GlobeAltIcon className="w-16 h-16 text-cyan-500" />
          </div>

          {/* Region Name */}
          <Link href={`/regions/${region.id}`} className="region-name">
            {region.name}
          </Link>

          {/* Metrics */}
          <div className="card-metrics">
            {/* Constellation count */}
            <Tooltip content="Total Constellations" position="top">
              <div className="flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">
                  {constellationCount}
                </span>
              </div>
            </Tooltip>
          </div>

          {/* Description */}
          {region.description && (
            <div className="text-xs text-center text-gray-400 line-clamp-2">
              {region.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
