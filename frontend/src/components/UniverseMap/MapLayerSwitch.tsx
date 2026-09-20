'use client';

import { MAP_LAYERS, type MapLayerId } from '@/utils/map/layers';

const IDS = Object.keys(MAP_LAYERS) as MapLayerId[];

/**
 * Two buttons, because there are two layers. A select would hide the choice
 * behind a click, and the whole point of a layer is that switching is cheap.
 *
 * No focus ring: this app shows focus the way hover looks (globals.css).
 */
export default function MapLayerSwitch({
  value,
  onChange,
}: {
  value: MapLayerId;
  onChange: (id: MapLayerId) => void;
}) {
  return (
    <div className="float flex p-1 gap-x-1 text-xs">
      {IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={id === value}
          className={`px-2 py-1 transition-colors ${
            id === value
              ? 'bg-white/10 text-gray-100'
              : 'text-ink-muted hover:text-gray-100'
          }`}
        >
          {MAP_LAYERS[id].label}
        </button>
      ))}
    </div>
  );
}
