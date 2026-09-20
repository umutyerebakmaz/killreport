'use client';

import type { MapSovereigntyQuery } from '@/generated/graphql';
import { SOV_COLORS } from '@/utils/map/sovColors';

type Owner = MapSovereigntyQuery['mapSovereignty']['owners'][number];

/**
 * Not a continuous ramp: the colours stand for owners, and an owner is a name
 * rather than a value on a scale. The biggest holders get a row each and the
 * tail is summed into one, because 101 rows is a list and a legend is a key.
 */
export default function SovLegend({
  owners,
  max,
}: {
  owners: readonly Owner[];
  max: number;
}) {
  if (owners.length === 0) {
    return (
      <div className="float px-3 py-2 text-xs text-ink-muted">
        Loading sovereignty...
      </div>
    );
  }

  const shown = owners.slice(0, max);
  const rest = owners.slice(max);
  const restSystems = rest.reduce((sum, owner) => sum + owner.systemCount, 0);

  return (
    <div className="float flex flex-col px-3 py-2 gap-y-1 text-xs">
      {shown.map((owner) => (
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

      {rest.length > 0 && (
        <div className="flex items-center gap-x-2">
          <span className="size-2 shrink-0 rounded-full bg-[#475569]" />
          <span className="flex-1 text-ink-muted">
            {rest.length} other{rest.length === 1 ? '' : 's'}
          </span>
          <span className="text-ink-muted tabular-nums">{restSystems}</span>
        </div>
      )}
    </div>
  );
}
