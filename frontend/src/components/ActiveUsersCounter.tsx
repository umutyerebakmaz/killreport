'use client';

import { useActiveUsersUpdatesSubscription } from '@/generated/graphql';
import { UsersIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import Tooltip from './Tooltip/Tooltip';

export default function ActiveUsersCounter() {
  const [isConnected, setIsConnected] = useState(false);

  // Tranquility's player count rides on this readout rather than on one of
  // its own. It came from Header.tsx, which fetched it once on mount and
  // nothing more; this does the same, and a failed request leaves the dash.
  const [players, setPlayers] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://esi.evetech.net/latest/status/?datasource=tranquility')
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => setPlayers(status?.players ?? null))
      .catch(() => setPlayers(null));
  }, []);

  const { data, error } = useActiveUsersUpdatesSubscription({
    onData: () => {
      setIsConnected(true);
    },
  });

  // Apollo keeps the last event's data until the next arrives, so the count
  // is read from it directly rather than copied into state by an effect.
  const count = data?.activeUsersUpdates?.count ?? 0;

  if (error) {
    console.error('Active users subscription error:', error);
    return null;
  }

  return (
    <Tooltip
      content={
        <div className="min-w-70">
          <div className="mb-1 font-medium">Real-time Active Users</div>
          <div className="text-ink-muted">
            Live count of visitors currently browsing the site. Updates every 3
            seconds via WebSocket. Includes authenticated users and anonymous
            visitors active in the last 5 minutes.
          </div>
          <div className="mt-3 mb-1 font-medium">Tranquility</div>
          <div className="text-ink-muted">
            Players online on the EVE Online server right now, as ESI reports
            it.
          </div>
        </div>
      }
      position="bottom"
      wrapText={true}
    >
      <div className="flex items-center gap-2 text-sm text-ink-muted cursor-help">
        {isConnected && (
          <div className="relative flex size-2">
            <span className="absolute inline-flex w-full h-full bg-success rounded-full opacity-75 animate-ping"></span>
            <span className="relative inline-flex bg-success rounded-full size-2"></span>
          </div>
        )}
        <UsersIcon className="size-4" />
        <span className="font-medium text-white">{count}</span>
        <span className="hidden sm:inline">active</span>
        <span aria-hidden="true">·</span>
        <span className="font-medium text-white">
          {players?.toLocaleString() ?? '-'}
        </span>
        <span className="hidden sm:inline">in game</span>
      </div>
    </Tooltip>
  );
}
