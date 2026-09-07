'use client';

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { CalendarIcon } from '@heroicons/react/20/solid';
import { useId } from 'react';

import Calendar from '@/components/ui/Calendar';
import { formatDateLabel } from '@/utils/date';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  min?: string;
  max?: string;
  /** The box: `input` among form fields, `input-boxed` among buttons. */
  className?: string;
  'aria-label'?: string;
}

/**
 * The one date field in the app.
 *
 * It used to be a native date `<input>`, and the last thing out of reach was
 * the panel it opened: the browser painted it a flat neutral grey against a
 * gray ramp that carries a blue cast, and read it in the visitor's
 * own language with no attribute that overrode either. Owning the panel is
 * what fixes both, and the trigger keeps `Select`'s anatomy so the two sit
 * together without looking like two ideas.
 *
 * The value stays `YYYY-MM-DD`, which is what the filters put in the URL and
 * what the GraphQL variables expect.
 *
 * The trigger's accessible name has to carry both the field's name and its
 * current value — the native `<input type="date">` this replaced announced
 * both ("Founded From, 15/03/2011"). A plain `<label htmlFor>` or
 * `aria-label` only ever wins one half of that fight: a `<label>` pointing
 * at a labelable element *replaces* its accessible name outright, and so
 * does `aria-label`, so whichever is present the trigger's own text (the
 * formatted date, or "Select date") is never heard. `aria-labelledby` is the
 * one mechanism that outranks both and can chain two sources into one name,
 * so it is used here instead: one id names the field, the other names the
 * span carrying the visible value text — not the button's own id, because
 * the accname recursion guard treats a self-referencing `aria-labelledby` as
 * contributing nothing (computing it would otherwise recompute the button's
 * own name). A caller that passes `id` is expected to sit inside
 * `FilterField`, whose `<label>` carries the id `${htmlFor}-label`; a caller
 * with no such label (the leaderboard's date stepper) passes `aria-label`
 * instead and gets a visually hidden span standing in for one.
 */
export default function DateInput({
  value,
  onChange,
  id,
  min,
  max,
  className = '',
  'aria-label': ariaLabel,
}: DateInputProps) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const valueId = `${buttonId}-value`;
  const hiddenLabelId = ariaLabel ? `${buttonId}-name` : undefined;
  const labelId = hiddenLabelId ?? (id ? `${id}-label` : undefined);

  return (
    <Popover>
      {hiddenLabelId && (
        <span id={hiddenLabelId} className="sr-only">
          {ariaLabel}
        </span>
      )}
      <PopoverButton
        id={buttonId}
        aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
        className={`group grid cursor-pointer grid-cols-1 py-2.5 pr-2 pl-4 text-left text-sm font-medium text-white ${className}`}
      >
        <span
          id={valueId}
          className={`col-start-1 row-start-1 pr-6 truncate ${
            value ? '' : 'text-gray-400'
          }`}
        >
          {value ? formatDateLabel(value) : 'Select date'}
        </span>
        <CalendarIcon
          aria-hidden="true"
          className="self-center col-start-1 row-start-1 text-gray-400 size-5 justify-self-end sm:size-4"
        />
      </PopoverButton>

      {/* Anchored, so the filter dialog and the cards that hide their
          overflow do not clip it — the same arrangement as `Select`. */}
      <PopoverPanel
        transition
        anchor="bottom start"
        className="float [--anchor-gap:--spacing(1)] data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0"
      >
        {({ close }) => (
          <Calendar
            value={value}
            min={min}
            max={max}
            onSelect={(iso) => {
              onChange(iso);
              close();
            }}
          />
        )}
      </PopoverPanel>
    </Popover>
  );
}
