'use client';

import FilterBar from '@/components/ui/FilterBar';
import Select from '@/components/ui/Select';
import { RegionOrderBy } from '@/generated/graphql';
import { useDebounce } from '@/hooks/useDebounce';
import { useEffect, useRef, useState } from 'react';

const ORDER_BY_OPTIONS = [
  { value: RegionOrderBy.NameAsc, label: 'Name A-Z' },
  { value: RegionOrderBy.NameDesc, label: 'Name Z-A' },
];

interface RegionFilterFormProps {
  onFilterChange: (filters: {
    search?: string;
    orderBy: RegionOrderBy;
  }) => void;
  onClearFilters: () => void;
  initialSearch?: string;
  initialOrderBy?: RegionOrderBy;
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
  initialSearch = '',
  initialOrderBy = RegionOrderBy.NameAsc,
}: RegionFilterFormProps) {
  const [search, setSearch] = useState(initialSearch);
  const [orderBy, setOrderBy] = useState(initialOrderBy);
  const debouncedSearch = useDebounce(search, 500);

  // Nothing here waits for an Apply — the search filters as it is typed and
  // the sort acts on the spot — so one effect emits whichever of the two
  // moved. The first run would re-emit what the page already read out of the
  // URL, resetting the page number to 1 on every load.
  const emitted = useRef(false);
  useEffect(() => {
    if (!emitted.current) {
      emitted.current = true;
      return;
    }
    onFilterChange({ search: debouncedSearch || undefined, orderBy });
    // onFilterChange is redefined on every render of the page above, so it
    // cannot be a dependency without emitting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, orderBy]);

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
          onChange={(value) => setOrderBy(value as RegionOrderBy)}
          options={ORDER_BY_OPTIONS}
          aria-label="Sort regions"
        />
      }
      hasActiveFilters={Boolean(search)}
      onClear={handleClearAll}
    />
  );
}
