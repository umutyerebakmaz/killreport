'use client';

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { ChevronUpDownIcon } from '@heroicons/react/16/solid';
import { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /**
   * Tailwind background class for a small round swatch drawn before the label,
   * e.g. `bg-red-500`. Decorative: it repeats what the label already says, so
   * it is hidden from assistive technology. Options in the same list may leave
   * it out — a list where any option has one keeps the others aligned.
   */
  swatch?: string;
  /**
   * An icon drawn before the label, in the same place a swatch would go and
   * winning over one if both are given. Decorative like the swatch: pass
   * `aria-hidden` icons, because the label already says what this row is.
   */
  icon?: ReactNode;
}

/**
 * The slot before a label. Fixed size whatever it holds — a swatch, an icon or
 * nothing — so every label in a list starts at the same x.
 */
function Leading({ option }: { option: SelectOption }) {
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center flex-none size-4"
    >
      {option.icon ??
        (option.swatch ? (
          <span
            data-swatch
            className={`flex-none rounded-full size-2.5 ${option.swatch}`}
          />
        ) : null)}
    </span>
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  /** Sits on the button, so `w-full` widens the control and its panel alike. */
  className?: string;
  'aria-label'?: string;
}

/**
 * The one select in the app.
 *
 * A native `<select>` never handed its picker over: `option` padding was
 * dropped by every browser and the tick beside the selected row had to be a
 * `✓` glyph typed into the label. `Listbox` owns the panel and the rows, so
 * both become ours — along with the keyboard (arrows, Home/End, Escape,
 * type-ahead) and the listbox semantics.
 *
 * Nothing is invented here. The panel is `.float` because it is a floating
 * layer, the rows hover like `.menu-row`, and selection is marked by weight
 * and a tick rather than a coloured ground — the accent stays with actions.
 * The chevron and the tick keep the block's own geometry; only their colours
 * are ours, because indigo is a palette family this app no longer carries.
 */
export default function Select({
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}: SelectProps) {
  const selected = options.find((option) => option.value === value);

  // One option carrying a mark indents every label in the list, so the rows
  // that have none get an empty slot of the same size rather than sitting
  // closer to the edge than their neighbours.
  const hasLeading = options.some((option) => option.swatch || option.icon);

  // A native `<select>` takes the width of its widest option and keeps it. A
  // button takes the width of whatever is currently chosen, so the control
  // would shrink and grow as the selection changed. The sizer restores the
  // old behaviour: it contributes its width to the grid column and no height.
  const widest = options.reduce(
    (longest, option) =>
      option.label.length > longest.length ? option.label : longest,
    '',
  );

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <ListboxButton
        aria-label={ariaLabel}
        className={`group grid cursor-pointer grid-cols-1 border py-2.5 pr-2 pl-4 text-left text-sm font-medium text-white transition-colors bg-surface border-white/10 hover:bg-surface-inset hover:border-white/20 focus:outline-none focus-visible:outline-1 focus-visible:outline-accent data-disabled:cursor-not-allowed data-disabled:text-gray-500 data-disabled:opacity-50 data-disabled:hover:bg-surface data-disabled:hover:border-white/10 ${className}`}
      >
        <span className="flex items-center col-start-1 row-start-1 gap-2 pr-6">
          {selected && hasLeading && <Leading option={selected} />}
          <span className="truncate">{selected?.label ?? ''}</span>
        </span>
        <span
          aria-hidden="true"
          className="h-0 col-start-1 row-start-1 pr-6 overflow-hidden invisible"
        >
          {widest}
        </span>
        <ChevronUpDownIcon
          aria-hidden="true"
          className="self-center col-start-1 row-start-1 text-gray-400 size-5 justify-self-end sm:size-4"
        />
      </ListboxButton>

      {/* `anchor` portals the panel, so it is not clipped by the filter
          dialog or by a card that hides its overflow. `--button-width` comes
          with the anchoring, which is what keeps the two the same width. */}
      <ListboxOptions
        transition
        anchor="bottom start"
        className="float w-(--button-width) max-h-60 overflow-auto py-1 text-sm [--anchor-gap:--spacing(1)] data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0"
      >
        {options.map((option) => (
          <ListboxOption
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="relative py-2 pl-8 pr-4 text-gray-200 transition-colors cursor-pointer select-none group data-focus:bg-white/5 data-focus:text-white data-focus:outline-hidden data-disabled:cursor-not-allowed data-disabled:text-gray-500 data-disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              {hasLeading && <Leading option={option} />}
              <span className="block truncate group-data-selected:font-semibold group-data-selected:text-white">
                {option.label}
              </span>
            </span>
            <span className="absolute inset-y-0 left-0 flex items-center pl-1.5 text-blue-400 group-not-data-selected:hidden group-data-focus:text-white">
              <CheckIcon aria-hidden="true" className="size-5" />
            </span>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
