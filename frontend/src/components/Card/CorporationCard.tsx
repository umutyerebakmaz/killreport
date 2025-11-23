import Tooltip from "@/components/Tooltip/Tooltip";
import { CorporationsQuery } from "@/generated/graphql";
import {
  ArrowTrendingUpIcon,
  BuildingOffice2Icon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// useCorporationsQuery'nin döndüğü Corporation type'ını extract et
type Corporation = CorporationsQuery["corporations"]["edges"][number]["node"];

type CorporationCardProps = {
  corporation: Corporation;
};

export default function CorporationCard({ corporation }: CorporationCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Delta verilerini al (haftalık değişim)
  const memberDelta7d = corporation.metrics?.memberCountDelta7d ?? null;
  const memberGrowthRate7d =
    corporation.metrics?.memberCountGrowthRate7d ?? null;

  // Delta rengi belirle
  const deltaColor =
    memberDelta7d && memberDelta7d >= 0 ? "text-green-400" : "text-red-400";

  // Tooltip içeriği
  const tooltipContent =
    memberDelta7d !== null
      ? `Member Change (7 Days): ${
          memberDelta7d >= 0 ? "+" : ""
        }${memberDelta7d}${
          memberGrowthRate7d !== null
            ? ` (${
                memberGrowthRate7d >= 0 ? "+" : ""
              }${memberGrowthRate7d.toFixed(1)}%)`
            : ""
        }`
      : "No data available";

  // Date founded'ı formatla
  const foundedDate = corporation.date_founded
    ? new Date(corporation.date_founded).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown";

  return (
    <div className="corporation-card">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-32 h-32">
            {!imageLoaded && (
              <div className="absolute inset-0 rounded animate-pulse bg-gray-800/50">
                <div className="flex items-center justify-center w-full h-full">
                  <BuildingOffice2Icon className="w-12 h-12 text-gray-700" />
                </div>
              </div>
            )}
            <Image
              src={`https://images.evetech.net/corporations/${corporation.id}/logo?size=128`}
              alt={corporation.name}
              width={128}
              height={128}
              className={`rounded transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              unoptimized
            />
          </div>
          <Link
            href={`/corporations/${corporation.id}`}
            className="corporation-name"
          >
            {corporation.name}
          </Link>

          {/* Ticker Badge */}
          <Tooltip content="Corporation Ticker" position="top">
            <div className="corporation-ticker">[{corporation.ticker}]</div>
          </Tooltip>

          {/* Alliance */}
          <div className="flex flex-col items-center w-full gap-2 min-h-5">
            <div className="h-5">
              {corporation.alliance && (
                <Tooltip content="Alliance" position="top">
                  <Link
                    href={`/alliances/${corporation.alliance.id}`}
                    className="flex items-center gap-2 hover:text-cyan-400"
                  >
                    <span className="text-base text-yellow-400 line-clamp-1">
                      {corporation.alliance.name}
                    </span>
                  </Link>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="card-metrics">
            {/* Member count */}
            <Tooltip content="Total Members" position="top">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">
                  {corporation.member_count?.toLocaleString() || "N/A"}
                </span>
              </div>
            </Tooltip>

            {/* Member delta 7d */}
            <Tooltip content={tooltipContent} position="top">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon
                  className={`w-5 h-5 ${
                    memberDelta7d !== null ? deltaColor : "text-gray-500"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    memberDelta7d !== null ? deltaColor : "text-gray-500"
                  }`}
                >
                  {memberDelta7d !== null ? (
                    <>
                      {memberDelta7d >= 0 ? "+" : ""}
                      {memberDelta7d}
                    </>
                  ) : (
                    "N/A"
                  )}
                </span>
              </div>
            </Tooltip>
          </div>

          <div className="date-founded-section">
            {/* Founded date */}
            <Tooltip content="Date Founded" position="top">
              <div className="text-xs text-gray-400">{foundedDate}</div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
