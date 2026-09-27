'use client';

import { ClockIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';

/** EVE time is UTC. HH:MM, so the text only has to change once a minute. */
const eveTimeNow = () => new Date().toISOString().slice(11, 16);

export default function EveTime() {
  // Empty on the server and on the first client render, so the two agree and
  // hydration does not trip over a clock that moved in between.
  const [eveTime, setEveTime] = useState('');

  useEffect(() => {
    // Wait for the next minute boundary, then tick once a minute. The first
    // update runs from a timer rather than the effect body so no state is set
    // synchronously in the effect.
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setEveTime(eveTimeNow());
    const first = setTimeout(tick, 0);
    const aligned = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      clearTimeout(first);
      clearTimeout(aligned);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <ClockIcon className="size-4" />
      <span className="font-medium text-white tabular-nums">
        {eveTime || '--:--'}
      </span>
      <span className="hidden sm:inline">EVE</span>
    </div>
  );
}
