'use client';

import EveImage from '@/components/ui/EveImage';
import { MapOwnerKind, type MapSovereigntyQuery } from '@/generated/graphql';
import { SOV_COLORS, SOV_UNOWNED_TINT } from '@/utils/map/sovColors';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

type Owner = MapSovereigntyQuery['mapSovereignty']['owners'][number];

/** The neutral the canvas draws an owner the dictionary does not name. */
const NEUTRAL = `#${SOV_UNOWNED_TINT.toString(16).padStart(6, '0')}`;

/**
 * The crest's drawn size in the list, square. The disc around it is `size-5`
 * — 20 px — which leaves exactly the 1 px rim of owner colour the map's own
 * disc shows. Move one and the other has to move with it.
 */
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
 *
 * It collapses because a list that tall is also a wall in front of the map,
 * and the galaxy is the thing being read. Open by default: a key nobody can
 * see is a key nobody uses, and the count in the header is what makes the
 * collapsed state worth reopening. Component state rather than the URL, for
 * the same reason the layer itself is — see `UniverseMap`.
 */
export default function SovLegend({ owners }: { owners: readonly Owner[] }) {
  const [open, setOpen] = useState(true);

  if (owners.length === 0) {
    return (
      <div className="float px-3 py-2 text-xs text-ink-muted">
        Loading sovereignty...
      </div>
    );
  }

  return (
    // Fixed in both directions while it is open, and auto only when there is
    // nothing under the header to size. The width is fixed because the rows
    // `truncate`: left to the content, the longest alliance name sets it and
    // nothing ever truncates. The height is fixed so the panel is the same
    // shape whoever holds sovereignty — 98 owners today, 30 after a war — and
    // `max-h-full` still hands it back on a viewport too short for it.
    <div
      className={`float flex w-56 max-w-full flex-col text-xs ${
        open ? 'h-96 max-h-full min-h-0' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        // The app's button vocabulary, as the layer switch above it wears.
        // No `aria-pressed`: this opens a panel, it is not a segment of a
        // group, and buttons.css reserves the selected fill for that.
        className="button button-ghost button-sm button-block shrink-0 gap-x-2"
      >
        {open ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
        <span className="flex-1 text-left">Sovereignty</span>
        <span className="tabular-nums">{owners.length}</span>
      </button>

      {open && (
        <div
          data-testid="sov-legend-list"
          // `min-h-0` is what makes the scroll work: a flex child's default
          // min-height is its content, so without it the panel grows past the
          // column instead of overflowing inside it.
          className="flex min-h-0 flex-1 flex-col gap-y-1 overflow-y-auto px-3 pb-2"
        >
          {owners.map((owner) => (
            <div key={owner.ownerId} className="flex items-center gap-x-2">
              <span
                data-testid={`sov-legend-disc-${owner.ownerId}`}
                className="flex size-5 shrink-0 items-center justify-center rounded-full"
                // The dictionary hex, not a class: 101 colours cannot be
                // Tailwind classes, and this is the same value the canvas
                // tints with.
                style={{
                  backgroundColor: SOV_COLORS[owner.ownerId] ?? NEUTRAL,
                }}
              >
                {/* A faction's crest is served from the CORPORATION path; down
                    the alliance path it answers 200 with the default emblem. */}
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
              <span className="flex-1 truncate text-ink">{owner.name}</span>
              <span className="text-ink-muted tabular-nums">
                {owner.systemCount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
