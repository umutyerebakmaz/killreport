'use client';

export interface MapSwitchOption<T extends string> {
  id: T;
  label: string;
}

/**
 * A row of buttons, one per choice — the layer and the layout today. A select
 * would hide the choice behind a click, and the point of both is that
 * switching is cheap.
 *
 * The app's own button vocabulary rather than classes invented here:
 * `button-ghost` with `aria-pressed` is exactly the case buttons.css calls
 * "one segment of a group where something is always selected", so the
 * selected segment takes the subtle fill and not the accent one reserved for
 * an engaged toggle. The pressed state comes from ARIA, so what a screen
 * reader announces and what the panel looks like cannot drift apart. The
 * group is named because there are two of them, and a screen reader would
 * otherwise read both as the same row of buttons.
 */
export default function MapSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly MapSwitchOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="float flex gap-x-1 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={option.id === value}
          className="button button-ghost button-sm"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
