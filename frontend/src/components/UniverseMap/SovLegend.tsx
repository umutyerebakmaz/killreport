'use client';

import type { MapSovereigntyQuery } from '@/generated/graphql';
import { SOV_COLORS } from '@/utils/map/sovColors';

type Owner = MapSovereigntyQuery['mapSovereignty']['owners'][number];

/**
 * Not a continuous ramp: the colours stand for owners, and an owner is a name
 * rather than a value on a scale.
 *
 * Every owner gets a row. The cap and its "N others" tail were dropped on
 * 2026-09-20: the panel is as tall as the map and scrolls, so there is nowhere
 * for a cap to help — an owner left out of a list with room for it is just
 * missing, and the ones past the top ten are exactly the ones whose colour a
 * reader cannot place from memory.
 */
export default function SovLegend({ owners }: { owners: readonly Owner[] }) {
  if (owners.length === 0) {
    return (
      <div className="float px-3 py-2 text-xs text-ink-muted">
        Loading sovereignty...
      </div>
    );
  }

  return (
    <div
      data-testid="sov-legend-list"
      // `min-h-0` is what makes the scroll work: a flex child's default
      // min-height is its content, so without it the panel grows past the
      // column instead of overflowing inside it.
      className="float flex min-h-0 flex-col gap-y-1 overflow-y-auto px-3 py-2 text-xs"
    >
      {owners.map((owner) => (
        <div key={owner.ownerId} className="flex items-center gap-x-2">
          <span
            className="size-2 shrink-0 rounded-full"
            // The dictionary hex, not a class: 101 colours cannot be Tailwind
            // classes, and this is the same value the canvas tints with.
            style={{ backgroundColor: SOV_COLORS[owner.ownerId] ?? '#475569' }}
          />
          <span className="flex-1 truncate text-gray-100">{owner.name}</span>
          <span className="text-ink-muted tabular-nums">
            {owner.systemCount}
          </span>
        </div>
      ))}
    </div>
  );
}
