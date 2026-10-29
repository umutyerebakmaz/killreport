'use client';

import type { TrackedEntityType } from '@/generated/graphql';
import { useTracker } from '@/hooks/useTracker';

/*
 * Add/remove button for one character, corporation or alliance. `xs` has no
 * class of its own in buttons.css: it is .button-sm with tighter padding.
 * TRACKING swaps to UNTRACK on hover or keyboard focus; on touch a tap simply
 * untracks. Both labels stay in the DOM and CSS picks which one shows.
 */
export default function TrackButton({
  type,
  id,
  size = 'sm',
}: {
  type: TrackedEntityType;
  id: number;
  size?: 'sm' | 'xs';
}) {
  const { signedIn, status, track, untrack, pending } = useTracker();
  if (!signedIn) return null;

  const current = status(type, id);
  if (current === 'self') return null;

  const sizeClass = size === 'xs' ? 'button-sm px-2 py-0.5' : 'button-sm';

  if (current === 'automatic') {
    return (
      <span
        className={`inline-flex items-center border border-ink-faint font-medium text-ink-faint ${
          size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs'
        }`}
      >
        AUTO-TRACKED
      </span>
    );
  }

  if (current === 'tracked') {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => untrack(type, id)}
        className={`button button-outline group ${sizeClass}`}
      >
        <span className="group-hover:hidden group-focus-visible:hidden">
          TRACKING
        </span>
        <span className="hidden group-hover:inline group-focus-visible:inline">
          UNTRACK
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => track(type, id)}
      className={`button button-primary ${sizeClass}`}
    >
      + TRACK
    </button>
  );
}
