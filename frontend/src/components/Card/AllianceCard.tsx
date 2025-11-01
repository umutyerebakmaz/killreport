import Tooltip from "@/components/Tooltip/Tooltip";
import { Alliance } from "@/generated/graphql";
import { ArrowTrendingUpIcon, UsersIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

type AllianceCardProps = {
  alliance: Alliance;
};

export default function AllianceCard({ alliance }: AllianceCardProps) {
  // Mock data - gerçek veri backend'e eklendikten sonra kaldırılacak
  const memberCount = Math.floor(Math.random() * 5000) + 100;
  const delta = Math.floor(Math.random() * 200) - 100; // -100 ile +100 arası
  const deltaColor = delta >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="bg-neutral-900 outline-1 -outline-offset-1 outline-white/10 outline">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          <img
            src={`https://images.evetech.net/alliances/${alliance.id}/logo?size=128`}
            alt={alliance.name}
            width={128}
            height={128}
            className="rounded"
          />
          <Link
            href={`/alliances/${alliance.id}`}
            className="flex items-center justify-center h-12 text-sm font-semibold text-center text-gray-200 hover:text-cyan-400 line-clamp-2"
          >
            {alliance.name}
          </Link>

          <div className="flex items-center justify-between w-full gap-4 pt-3 border-t border-white/10">
            <Tooltip content="Total Members" position="top">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">
                  {memberCount.toLocaleString()}
                </span>
              </div>
            </Tooltip>
            <Tooltip content="Member Change (30 days)" position="top">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon className={`w-5 h-5 ${deltaColor}`} />
                <span className={`text-sm font-medium ${deltaColor}`}>
                  {delta >= 0 ? "+" : ""}
                  {delta}
                </span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
