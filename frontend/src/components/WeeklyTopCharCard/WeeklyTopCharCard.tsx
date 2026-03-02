"use client";

import { Loader } from "@/components/Loader/Loader";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useTopWeeklyPilotsQuery } from "@/generated/graphql";
import { getSecurityStatusColor } from "@/utils/securityStatus";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function WeeklyTopCharCard() {
  const { data, loading } = useTopWeeklyPilotsQuery({
    variables: { filter: { limit: 10 } },
  });

  const pilots = data?.topWeeklyPilots ?? [];

  return (
    <div className="flex flex-col border bg-neutral-900 hover:bg-neutral-800">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-white/10">
        <CalendarDaysIcon className="w-4 h-4 text-cyan-400 shrink-0" />
        <h3 className="text-sm font-semibold text-white">Weekly Top 10</h3>
      </div>

      {/* Pilots List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader size="md" />
        </div>
      ) : pilots.length === 0 ? (
        <div className="p-4 text-xs text-center text-gray-500">
          No data available
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {pilots.slice(0, 10).map((pilot) => {
            const char = pilot.character;
            const secColor = getSecurityStatusColor(char?.securityStatus);

            return (
              <div key={pilot.rank} className="p-3 hover:bg-white/8">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex items-center justify-center w-6 shrink-0">
                    <span
                      className={`text-lg font-black tabular-nums ${
                        pilot.rank === 1
                          ? "text-yellow-400"
                          : pilot.rank === 2
                            ? "text-gray-300"
                            : pilot.rank === 3
                              ? "text-amber-600"
                              : "text-gray-600"
                      }`}
                    >
                      #{pilot.rank}
                    </span>
                  </div>

                  {/* Portrait */}
                  <div className="relative shrink-0">
                    <img
                      src={
                        char
                          ? `https://images.evetech.net/characters/${char.id}/portrait?size=64`
                          : `https://images.evetech.net/characters/0/portrait?size=64`
                      }
                      alt={char?.name ?? "Unknown"}
                      width={40}
                      height={40}
                      className="shadow-md"
                      loading="lazy"
                    />
                    {char?.securityStatus != null && (
                      <div className="absolute bottom-0 left-0 px-1 py-0 text-xs font-semibold bg-black/70 backdrop-blur-sm">
                        <span className={secColor}>
                          {char.securityStatus.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 min-w-0 gap-1">
                    {char ? (
                      <Tooltip
                        content="Show Character"
                        className="w-full min-w-0"
                      >
                        <Link
                          href={`/characters/${char.id}`}
                          className="block text-xs font-medium text-gray-300 truncate hover:text-cyan-400"
                          prefetch={false}
                        >
                          {char.name}
                        </Link>
                      </Tooltip>
                    ) : (
                      <span className="text-xs italic font-medium text-gray-500">
                        Unknown
                      </span>
                    )}
                    {char?.corporation && (
                      <span className="text-xs text-gray-500 truncate">
                        {char.corporation.name}
                      </span>
                    )}
                  </div>

                  {/* Kill Count */}
                  <div className="shrink-0">
                    <span className="text-xs font-semibold text-red-400 tabular-nums">
                      {pilot.killCount}
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
