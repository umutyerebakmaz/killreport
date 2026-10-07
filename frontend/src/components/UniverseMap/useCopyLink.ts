'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a button says "Copied" before it goes back to what it does. */
const COPIED_MS = 1_500;

/**
 * Copies a link and remembers which one, so the button that was pressed — and
 * only that one, in a list of timers — says it worked.
 *
 * A clipboard the browser refuses (no permission, an insecure origin) leaves
 * the button as it was: there is no second channel to report it through, and
 * the URL bar already holds the same link.
 */
export function useCopyLink(): {
  copied: string | null;
  copy: (key: string, url: string) => void;
} {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback((key: string, url: string) => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(key);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), COPIED_MS);
      })
      .catch(() => {});
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { copied, copy };
}
