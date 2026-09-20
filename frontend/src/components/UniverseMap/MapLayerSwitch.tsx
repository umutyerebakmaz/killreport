'use client';

import { MAP_LAYERS, type MapLayerId } from '@/utils/map/layers';

const IDS = Object.keys(MAP_LAYERS) as MapLayerId[];

/**
 * Two buttons, because there are two layers. A select would hide the choice
 * behind a click, and the whole point of a layer is that switching is cheap.
 *
 * The app's own button vocabulary rather than classes invented here:
 * `button-ghost` with `aria-pressed` is exactly the case buttons.css calls
 * "one segment of a group where something is always selected", so the
 * selected segment takes the subtle fill and not the accent one reserved for
 * an engaged toggle. The pressed state comes from ARIA, so what a screen
 * reader announces and what the panel looks like cannot drift apart.
 */
export default function MapLayerSwitch({
  value,
  onChange,
}: {
  value: MapLayerId;
  onChange: (id: MapLayerId) => void;
}) {
  return (
    <div className="float flex gap-x-1 p-1">
      {IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={id === value}
          className="button button-ghost button-sm"
        >
          {MAP_LAYERS[id].label}
        </button>
      ))}
    </div>
  );
}
