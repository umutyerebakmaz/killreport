import Tooltip from "@/components/Tooltip/Tooltip";
import { AlliancesQuery } from "@/generated/graphql";
import {
  ArrowTrendingUpIcon,
  StarIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// useAlliancesQuery'nin döndüğü Alliance type'ını extract et
type Alliance = AlliancesQuery["alliances"]["edges"][number]["node"];

type AllianceCardProps = {
  alliance: Alliance;
};

export default function AllianceCard({ alliance }: AllianceCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Delta verilerini al (günlük değişim)
  const memberDelta1d = alliance.metrics?.memberCountDelta1d ?? null;
  const memberGrowthRate1d = alliance.metrics?.memberCountGrowthRate1d ?? null;

  // Delta rengi belirle
  const deltaColor =
    memberDelta1d && memberDelta1d >= 0 ? "text-green-400" : "text-red-400";

  // Tooltip içeriği
  const tooltipContent =
    memberDelta1d !== null
      ? `Member Change (Daily): ${
          memberDelta1d >= 0 ? "+" : ""
        }${memberDelta1d}${
          memberGrowthRate1d !== null
            ? ` (${
                memberGrowthRate1d >= 0 ? "+" : ""
              }${memberGrowthRate1d.toFixed(1)}%)`
            : ""
        }`
      : "No data available";

  // Date founded'ı formatla
  const foundedDate = alliance.date_founded
    ? new Date(alliance.date_founded).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown";

  return (
    <div className="alliance-card">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-32 h-32">
            {!imageLoaded && (
              <div className="absolute inset-0 rounded animate-pulse bg-gray-800/50">
                <div className="flex items-center justify-center w-full h-full">
                  <UsersIcon className="w-12 h-12 text-gray-700" />
                </div>
              </div>
            )}
            <Image
              src={`https://images.evetech.net/alliances/${alliance.id}/logo?size=128`}
              alt={alliance.name}
              width={128}
              height={128}
              className={`rounded transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              unoptimized
            />
          </div>
          <Link href={`/alliances/${alliance.id}`} className="alliance-name">
            {alliance.name}
          </Link>

          {/* Ticker Badge */}
          <Tooltip content="Alliance Ticker" position="top">
            <div className="alliance-ticker">[{alliance.ticker}]</div>
          </Tooltip>

          <div className="card-metrics">
            {/*  member count */}
            <Tooltip content="Total Members" position="top">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">
                  {alliance.memberCount}
                </span>
              </div>
            </Tooltip>
            {/* corporation count */}
            <Tooltip content="Total Corporations" position="top">
              <div className="flex items-center gap-2">
                <StarIcon className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-500">
                  {alliance.corporationCount}
                </span>
              </div>
            </Tooltip>
            {/* member delta 1d */}
            <Tooltip content={tooltipContent} position="top">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon
                  className={`w-5 h-5 ${
                    memberDelta1d !== null ? deltaColor : "text-gray-500"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    memberDelta1d !== null ? deltaColor : "text-gray-500"
                  }`}
                >
                  {memberDelta1d !== null ? (
                    <>
                      {memberDelta1d >= 0 ? "+" : ""}
                      {memberDelta1d}
                    </>
                  ) : (
                    "N/A"
                  )}
                </span>
              </div>
            </Tooltip>
          </div>

          {/* Founded date section */}
          <div className="date-founded-section">
            <Tooltip content="Date Founded" position="top">
              <div className="text-xs text-gray-400">{foundedDate}</div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
