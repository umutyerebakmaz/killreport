"use client";

import { useSovereigntyAlerts } from "@/components/Sovereignty/SovereigntyAlertsProvider";
import { formatTimeAgo } from "@/utils/date";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { BellIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

const TYPE_DOT: Record<string, string> = {
  campaign_started: "bg-orange-400",
  campaign_ended: "bg-cyan-400",
  territory_change: "bg-yellow-400",
};

export default function NotificationBell() {
  const { recent, unread, markAllRead, clear } = useSovereigntyAlerts();

  return (
    <Popover className="relative">
      <PopoverButton
        onClick={() => unread > 0 && markAllRead()}
        className="relative flex items-center text-gray-300 cursor-pointer hover:text-white"
        aria-label="Sovereignty alerts"
      >
        <BellIcon className="w-6 h-6" />
        {unread > 0 && (
          <span className="absolute flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full -top-1.5 -right-1.5">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverButton>
      <PopoverPanel
        transition
        className="absolute right-0 z-10 mt-3 overflow-hidden w-80 bg-stone-900 outline-1 -outline-offset-1 outline-white/10 data-closed:translate-y-1 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-white">Sovereignty Alerts</span>
          {recent.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </div>
        <ul className="overflow-y-auto divide-y max-h-96 divide-white/5">
          {recent.map((a, i) => (
            <li key={`${a.timestamp}-${a.solarSystemId}-${i}`} className="px-4 py-3 hover:bg-white/5">
              <Link href={`/solar-systems/${a.solarSystemId}`} prefetch={false} className="block">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[a.type] ?? "bg-gray-400"}`} />
                  <div>
                    <div className="text-sm text-white">{a.message}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{formatTimeAgo(a.timestamp)}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="px-4 py-8 text-sm text-center text-gray-500">No sovereignty alerts yet.</li>
          )}
        </ul>
      </PopoverPanel>
    </Popover>
  );
}
