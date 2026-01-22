"use client";

import { useActiveUsersUpdatesSubscription } from "@/generated/graphql";
import { UsersIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import Tooltip from "./Tooltip/Tooltip";

export default function ActiveUsersCounter() {
  const [count, setCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);

  const { data, error } = useActiveUsersUpdatesSubscription({
    onData: () => {
      setIsConnected(true);
    },
  });

  useEffect(() => {
    if (data?.activeUsersUpdates) {
      setCount(data.activeUsersUpdates.count);
    }
  }, [data]);

  if (error) {
    console.error("Active users subscription error:", error);
    return null;
  }

  return (
    <Tooltip
      content={
        <div className="min-w-70">
          <div className="mb-1 font-semibold">Real-time Active Users</div>
          <div className="text-gray-400">
            Live count of visitors currently browsing the site. Updates every 3
            seconds via WebSocket. Includes authenticated users and anonymous
            visitors active in the last 5 minutes.
          </div>
        </div>
      }
      position="bottom"
      wrapText={true}
    >
      <div className="flex items-center gap-2 text-sm text-gray-400 cursor-help">
        {isConnected && (
          <div className="relative flex size-2">
            <span className="absolute inline-flex w-full h-full bg-green-400 rounded-full opacity-75 animate-ping"></span>
            <span className="relative inline-flex bg-green-500 rounded-full size-2"></span>
          </div>
        )}
        <UsersIcon className="size-4" />
        <span className="font-medium text-white">{count}</span>
        <span className="hidden sm:inline">active</span>
      </div>
    </Tooltip>
  );
}
