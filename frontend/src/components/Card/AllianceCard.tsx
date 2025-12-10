import Tooltip from "@/components/Tooltip/Tooltip";
import { AlliancesQuery } from "@/generated/graphql";
import { UsersIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import MemberDeltaBadge from "../MemberDeltaBadge/MemberDeltaBadge";
import TotalCorporationBadge from "../TotalCorporationMember/TotalCorporationBadge";
import TotalMemberBadge from "../TotalMemberBadge/TotalMemberBadge";

// useAlliancesQuery'nin döndüğü Alliance type'ını extract et
type Alliance = AlliancesQuery["alliances"]["edges"][number]["node"];

type AllianceCardProps = {
  alliance: Alliance;
};

export default function AllianceCard({ alliance }: AllianceCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Delta verilerini al (haftalık değişim)
  const memberDelta7d = alliance.metrics?.memberCountDelta7d ?? null;
  const memberGrowthRate7d = alliance.metrics?.memberCountGrowthRate7d ?? null;
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
              <div className="absolute inset-0 animate-pulse bg-gray-800/50">
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
              className={`transition-opacity duration-300 ${
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
            <TotalMemberBadge count={alliance.memberCount} />
            {/* corporation count */}
            <TotalCorporationBadge count={alliance.corporationCount} />
            {/* member delta 7d */}
            <MemberDeltaBadge
              memberDelta={memberDelta7d}
              memberGrowthRate={memberGrowthRate7d}
            />
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
