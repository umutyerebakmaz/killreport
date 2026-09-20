'use client';

import EveImage from '@/components/ui/EveImage';
import { MapOwnerKind, type MapSovereigntyQuery } from '@/generated/graphql';
import { SOV_COLORS, SOV_UNOWNED_TINT } from '@/utils/map/sovColors';

type Owner = MapSovereigntyQuery['mapSovereignty']['owners'][number];

/** The neutral the canvas draws an owner the dictionary does not name. */
const NEUTRAL = `#${SOV_UNOWNED_TINT.toString(16).padStart(6, '0')}`;

/** The crest's drawn size in the list, square. */
const CREST_PX = 18;

/**
 * Not a continuous ramp: the colours stand for owners, and an owner is a name
 * rather than a value on a scale.
 *
 * Each row is what the map draws — the owner's crest on a disc of its colour,
 * not a swatch beside a name. A reader looking from the list to the galaxy is
 * matching the same mark in both places.
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
            data-testid={`sov-legend-disc-${owner.ownerId}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-full"
            // The dictionary hex, not a class: 101 colours cannot be Tailwind
            // classes, and this is the same value the canvas tints with.
            style={{ backgroundColor: SOV_COLORS[owner.ownerId] ?? NEUTRAL }}
          >
            {/* A faction's crest is served from the CORPORATION path; down the
                alliance path it answers 200 with the default emblem. */}
            <EveImage
              kind={
                owner.kind === MapOwnerKind.Alliance
                  ? 'alliance'
                  : 'corporation'
              }
              id={owner.ownerId}
              name={owner.name}
              size={CREST_PX}
            />
          </span>
          <span className="flex-1 truncate text-gray-100">{owner.name}</span>
          <span className="text-ink-muted tabular-nums">
            {owner.systemCount}
          </span>
        </div>
      ))}
    </div>
  );
}
