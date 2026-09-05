'use client';

import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

export interface FilterBarProps {
  /**
   * The whole search element, wrapper included. FilterBar renders it as-is
   * rather than wrapping it: three of the filters attach a dropdownRef to
   * that wrapper for their click-outside handler, and a slot cannot receive
   * the consumer's ref. Consumers pass their own
   * `<div className="relative flex-1" ref={...}>`.
   */
  search?: ReactNode;
  /**
   * Extra controls belonging in the bar itself, rendered between the search
   * element and the Filters button: an inline filter select, a submit
   * button. Filtering in these forms is submit-driven, so a form whose only
   * action is Apply-inside-the-dialog still needs its own visible submit
   * control here.
   */
  controls?: ReactNode;
  /** The sort dropdown, when the page has one. */
  orderBy?: ReactNode;
  /**
   * Opens the advanced-filter dialog. Omit on pages with no advanced
   * filters — the Filters button is then not rendered at all.
   */
  onOpenFilters?: () => void;
  /** Drives the badge on the Filters button. 0 hides the badge. */
  activeFilterCount?: number;
  /**
   * Whether anything at all is filtering, including the bar's own search box.
   * Drives the Clear button. Defaults to `activeFilterCount > 0` for callers
   * whose only filters live in the dialog.
   */
  hasActiveFilters?: boolean;
  /** Shown only while activeFilterCount is above zero. */
  onClear?: () => void;
}

/**
 * The row above every list: search, Filters, Clear, sort. Identical on all
 * pages, whether or not the page has advanced filters behind the button.
 */
export default function FilterBar({
  search,
  controls,
  orderBy,
  onOpenFilters,
  activeFilterCount = 0,
  hasActiveFilters = activeFilterCount > 0,
  onClear,
}: FilterBarProps) {
  const hasBadge = activeFilterCount > 0;

  return (
    <div className="flex items-center gap-3">
      {search}
      {controls}

      {onOpenFilters && (
        <button
          type="button"
          onClick={onOpenFilters}
          aria-pressed={hasBadge}
          className="button button-secondary"
        >
          <FunnelIcon className="w-5 h-5" />
          Filters
          {hasBadge && <span className="badge">{activeFilterCount}</span>}
        </button>
      )}

      {hasActiveFilters && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="button button-danger"
        >
          <XMarkIcon className="w-5 h-5" />
          Clear
        </button>
      )}

      {orderBy}
    </div>
  );
}
