import Tooltip from "@/components/Tooltip/Tooltip";
import { CorporationsQuery } from "@/generated/graphql";
import { BuildingOffice2Icon, UsersIcon } from "@heroicons/react/24/outline";
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

  // Date founded'ı formatla
  const foundedDate = corporation.date_founded
    ? new Date(corporation.date_founded).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unknown";

  return (
    <div className="alliance-card">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24">
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
              width={96}
              height={96}
              className={`rounded transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              unoptimized
            />
          </div>
          <Link
            href={`/corporations/${corporation.id}`}
            className="flex items-center justify-center h-12 text-sm font-semibold text-center text-gray-200 hover:text-cyan-400 line-clamp-2"
          >
            {corporation.name}
          </Link>

          {/* Ticker Badge */}
          <div className="px-3 py-1 text-xs font-bold rounded-full bg-green-500/20 text-green-400">
            [{corporation.ticker}]
          </div>

          <div className="flex flex-col items-center justify-center w-full gap-3 pt-3 border-t border-white/10">
            {/* Member count */}
            <Tooltip content="Total Members" position="top">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">
                  {corporation.member_count?.toLocaleString() || "N/A"}
                </span>
              </div>
            </Tooltip>

            {/* Alliance info */}
            {corporation.alliance ? (
              <Tooltip
                content={`Alliance: ${corporation.alliance.name}`}
                position="top"
              >
                <Link
                  href={`/alliances/${corporation.alliance.id}`}
                  className="text-xs text-yellow-400 hover:text-yellow-300 line-clamp-1"
                >
                  [{corporation.alliance.ticker}] {corporation.alliance.name}
                </Link>
              </Tooltip>
            ) : (
              <span className="text-xs text-gray-500">No Alliance</span>
            )}

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
