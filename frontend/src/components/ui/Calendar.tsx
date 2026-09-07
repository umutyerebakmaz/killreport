'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import Select, { type SelectOption } from '@/components/ui/Select';
import {
  EVE_FIRST_YEAR,
  MONTH_LABELS,
  WEEKDAY_LABELS,
  buildMonthGrid,
  parseISODate,
  toISODate,
} from '@/utils/date';

const MONTH_OPTIONS: SelectOption[] = MONTH_LABELS.map((label, month) => ({
  value: String(month),
  label,
}));

interface CalendarProps {
  /** `YYYY-MM-DD`, or empty for no selection. */
  value: string;
  /** Called with the chosen day, or with `''` when the value is cleared. */
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
}

/**
 * A month of days, drawn by us.
 *
 * The native picker this replaces was the last part of a date field out of
 * reach: the browser painted its panel a flat neutral grey and read it in the
 * visitor's own language, and no attribute changed either. Here both are
 * ours — the grid takes the app's surfaces, and every label is English
 * because `utils/date` formats it that way.
 *
 * Everything is UTC. The app's killmail data is, `getWeekMonday` counts weeks
 * from Monday, and mixing clocks in a date-only control silently moves days.
 */
export default function Calendar({ value, onSelect, min, max }: CalendarProps) {
  const today = toISODate(new Date());
  // `today` is built from a real Date, so it always parses; the fallback is
  // there so the opening month is a value and not a maybe.
  const opening = parseISODate(value) ?? new Date();

  const [viewYear, setViewYear] = useState(opening.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(opening.getUTCMonth());

  // ISO dates sort as strings, so the range check needs no parsing.
  const isDisabled = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max);

  const stepMonth = (delta: number) => {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  // The range decides which years exist at all; without one, everything from
  // EVE's first year to this one.
  const firstYear = min ? Number(min.slice(0, 4)) : EVE_FIRST_YEAR;
  const lastYear = max ? Number(max.slice(0, 4)) : new Date().getUTCFullYear();
  const yearOptions: SelectOption[] = Array.from(
    { length: Math.max(1, lastYear - firstYear + 1) },
    (_, index) => ({
      value: String(firstYear + index),
      label: String(firstYear + index),
    }),
  );

  // The step buttons stop at the edge of the range rather than walking into
  // a month with nothing selectable in it.
  const lastDayOfPreviousMonth = toISODate(
    new Date(Date.UTC(viewYear, viewMonth, 0)),
  );
  const firstDayOfNextMonth = toISODate(
    new Date(Date.UTC(viewYear, viewMonth + 1, 1)),
  );

  const days = buildMonthGrid(viewYear, viewMonth);

  // Roving tabindex: one cell is reachable by Tab, the arrows move which one.
  const [focusedIso, setFocusedIso] = useState(value || today);
  const gridRef = useRef<HTMLDivElement>(null);
  // Set right before a `focusedIso` change that comes from keyboard movement
  // inside the grid, so the focus-follow effect below knows to carry the
  // real DOM focus with it — including across a month boundary, where the
  // previously focused cell's `iso` key changes and React unmounts it,
  // which blurs to `<body>` as part of that same commit. Checking
  // `document.activeElement` in the effect can't tell that apart from focus
  // genuinely having left the grid (e.g. into an open dropdown), since by
  // the time the effect runs the old cell is already gone either way. Never
  // set by the Month/Year dropdowns, so picking one can't steal focus out of
  // that open listbox and into a day cell mid-choice.
  const followFocusRef = useRef(false);

  // Moving off the visible month has to bring the month with it, or the
  // focused day is no longer on screen. This is folded into the same setters
  // that move focus, rather than a `useEffect` on `focusedIso` — this repo
  // already carries a stack of deferred `react-hooks/set-state-in-effect`
  // errors, and a state redesign to clear them is its own piece of work.
  //
  // A disabled cell can never hold focus — a native `disabled` button
  // refuses it — so landing there the same way stranded the whole grid
  // outside the tab order. Refuse the move instead of clamping it: the
  // focus ring stops at the edge of the allowed range rather than jumping
  // to some other day the reader didn't ask for.
  const shiftFocus = (deltaDays: number) => {
    const from = parseISODate(focusedIso);
    if (!from) return;
    const next = new Date(
      Date.UTC(
        from.getUTCFullYear(),
        from.getUTCMonth(),
        from.getUTCDate() + deltaDays,
      ),
    );
    const candidate = toISODate(next);
    if (isDisabled(candidate)) return;
    followFocusRef.current = true;
    setFocusedIso(candidate);
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  // PageUp/PageDown land on the 1st of the target month, not the same day of
  // month carried forward — the 31st of a 31-day month has no equivalent in
  // a 30-day or 28/29-day one, and "roll forward" reads as a bug in review.
  const shiftFocusMonths = (deltaMonths: number) => {
    const from = parseISODate(focusedIso);
    if (!from) return;
    const next = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + deltaMonths, 1),
    );
    const candidate = toISODate(next);
    if (isDisabled(candidate)) return;
    followFocusRef.current = true;
    setFocusedIso(candidate);
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  // Landing on the 1st unconditionally strands the keyboard when `min` cuts
  // into the middle of the target month: `shiftFocus` refuses any move onto
  // a disabled day, so with `min="2011-03-10"` a focus on 2011-03-01 can
  // never arrow its way to the ten selectable days from the 10th onward —
  // every step lands on a disabled candidate and is refused. Landing on the
  // month's own first *selectable* day keeps the roving tabindex where the
  // arrows can actually reach the rest of the month. Only when `min` falls
  // after the whole month (nothing in it is selectable either way) does this
  // fall back to the 1st, same as before.
  const firstSelectableIso = (year: number, month: number): string => {
    const first = toISODate(new Date(Date.UTC(year, month, 1)));
    const last = toISODate(new Date(Date.UTC(year, month + 1, 0)));
    if (min !== undefined && min > first && min <= last) return min;
    return first;
  };

  // The Month/Year dropdowns move `viewYear`/`viewMonth` on their own. Left
  // alone, `focusedIso` would keep naming a day that isn't rendered in the
  // new month at all — no cell would carry `tabIndex={0}` and the grid would
  // drop out of the tab order entirely.
  const moveFocusToMonth = (nextYear: number, nextMonth: number) => {
    setViewYear(nextYear);
    setViewMonth(nextMonth);
    setFocusedIso(firstSelectableIso(nextYear, nextMonth));
  };

  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Monday-based, so Home and End land on the ends of the row as drawn.
    const focused = parseISODate(focusedIso);
    if (!focused) return;
    const weekdayOffset = (focused.getUTCDay() + 6) % 7;

    const moves: Record<string, () => void> = {
      ArrowLeft: () => shiftFocus(-1),
      ArrowRight: () => shiftFocus(1),
      ArrowUp: () => shiftFocus(-7),
      ArrowDown: () => shiftFocus(7),
      Home: () => shiftFocus(-weekdayOffset),
      End: () => shiftFocus(6 - weekdayOffset),
      PageUp: () => shiftFocusMonths(-1),
      PageDown: () => shiftFocusMonths(1),
    };

    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };

  // The DOM element with focus has to follow the roving tabindex once the
  // cells re-render; this reads state (and a ref) rather than setting any,
  // so it stays clear of react-hooks/set-state-in-effect. Gated on
  // `followFocusRef` rather than `document.activeElement` — the dropdown
  // handlers never set that ref, so choosing a month or year can't steal
  // focus out of the open listbox and into a day cell mid-choice.
  useEffect(() => {
    if (!followFocusRef.current) return;
    followFocusRef.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-iso="${focusedIso}"]`)
      ?.focus();
  }, [focusedIso, viewYear, viewMonth]);

  return (
    <div className="p-3 w-72">
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          disabled={isDisabled(lastDayOfPreviousMonth)}
          className="button button-ghost button-icon shrink-0"
          aria-label="Previous month"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" />
        </button>

        {/* The month and the year are the `Listbox` from #173, so the panel
            inside this panel is the same control as everywhere else. */}
        <Select
          value={String(viewMonth)}
          onChange={(next) => moveFocusToMonth(viewYear, Number(next))}
          options={MONTH_OPTIONS}
          className="flex-1 px-2 py-1 text-xs min-w-0"
          aria-label="Month"
        />
        <Select
          value={String(viewYear)}
          onChange={(next) => moveFocusToMonth(Number(next), viewMonth)}
          options={yearOptions}
          className="px-2 py-1 text-xs shrink-0"
          aria-label="Year"
        />

        <button
          type="button"
          onClick={() => stepMonth(1)}
          disabled={isDisabled(firstDayOfNextMonth)}
          className="button button-ghost button-icon shrink-0"
          aria-label="Next month"
        >
          <ChevronRightIcon aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div role="grid" ref={gridRef} onKeyDown={handleGridKeyDown}>
        <div role="row" className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              role="columnheader"
              className="py-1 text-xs text-center text-gray-500"
            >
              {label}
            </div>
          ))}
        </div>

        {Array.from({ length: 6 }, (_, week) =>
          days.slice(week * 7, (week + 1) * 7),
        ).map((week, weekIndex) => (
          <div key={weekIndex} role="row" className="grid grid-cols-7">
            {week.map((cell) => {
              const disabled = isDisabled(cell.iso);
              const selected = cell.iso === value;

              return (
                // No native `disabled` here, deliberately: the ARIA grid
                // pattern is focusable-but-not-activatable, and a disabled
                // button can never hold focus at all. If a dropdown lands
                // `focusedIso` on a day that's out of range, `disabled`
                // would strand the roving tabindex on a cell that refuses
                // to take it — the same "grid falls out of the tab order"
                // bug this whole mechanism exists to prevent, just reached
                // by a different door. `aria-disabled` plus the `onClick`
                // guard below carry the same meaning without that trap.
                <button
                  key={cell.iso}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-disabled={disabled}
                  data-iso={cell.iso}
                  tabIndex={cell.iso === focusedIso ? 0 : -1}
                  onClick={() => !disabled && onSelect(cell.iso)}
                  className={`size-9 text-sm transition-colors ${
                    selected
                      ? 'bg-blue-600 text-white'
                      : disabled
                        ? 'text-gray-700 cursor-not-allowed'
                        : cell.inMonth
                          ? 'text-gray-200 hover:bg-white/5'
                          : 'text-gray-600 hover:bg-white/5'
                  } ${
                    cell.iso === today && !selected
                      ? 'ring-1 ring-white/20'
                      : ''
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2 mt-2 border-t border-white/10">
        <button
          type="button"
          onClick={() => onSelect('')}
          className="button button-ghost"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onSelect(today)}
          disabled={isDisabled(today)}
          className="button button-ghost"
        >
          Today
        </button>
      </div>
    </div>
  );
}
