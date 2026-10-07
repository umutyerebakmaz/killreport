'use client';

import { useEffect, useState } from 'react';

/**
 * The time, refreshed every `intervalMs` while `enabled`.
 *
 * For the React side of the timers — the panel rows and the popup line — and
 * the map's slower tick that turns a ring red when its timer opens.
 */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
}
