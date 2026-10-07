'use client';

import { useEffect, useState } from 'react';

/**
 * The time, refreshed every `intervalMs` while `enabled`.
 *
 * For the React side of the timers — the panel rows and the popup line. The
 * chips on the map do not use it: they rewrite their own text from an
 * interval, so the whole map is not re-rendered once a second.
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
