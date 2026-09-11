'use client';

import FilterBar from '@/components/ui/FilterBar';
import Select from '@/components/ui/Select';
import { useDebounce } from '@/hooks/useDebounce';
import { useEffect, useRef, useState } from 'react';

const ORDER_BY_OPTIONS = [
  { value: 'nameAsc', label: 'Name A-Z' },
  { value: 'nameDesc', label: 'Name Z-A' },
];

interface RegionFilterFormProps {
  onFilterChange: (filters: { search?: string }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
  initialSearch?: string;
}

/**
 * The regions list's filter row.
 *
 * No FilterDialog: RegionFilter carries nothing but search and a sort order,
 * and FilterBar draws no Filters button when none is asked for. The search box
 * filters as it is typed, like the constellations one.
 */
export default function RegionFilterForm({
  onFilterChange,
  onClearFilters,
  orderBy = 'nameAsc',
  onOrderByChange,
  initialSearch = '',
}: RegionFilterFormProps) {
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 500);

  // The first run would re-emit the search the page already read out of the
  // URL, resetting the page number to 1 on every load.
  const emitted = useRef(false);
  useEffect(() => {
    if (!emitted.current) {
      emitted.current = true;
      return;
    }
    onFilterChange({ search: debouncedSearch || undefined });
    // onFilterChange is redefined on every render of the page above, so it
    // cannot be a dependency without emitting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handleClearAll = () => {
    setSearch('');
    onClearFilters();
  };

  return (
    <FilterBar
      search={
        <div className="relative flex-1">
          <input
            type="text"
            aria-label="Search regions"
            placeholder="Search regions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />
        </div>
      }
      orderBy={
        <Select
          value={orderBy}
          onChange={onOrderByChange}
          options={ORDER_BY_OPTIONS}
          aria-label="Sort regions"
        />
      }
      hasActiveFilters={Boolean(search)}
      onClear={handleClearAll}
    />
  );
}
