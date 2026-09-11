'use client';

import RegionMap from '@/components/RegionMap/RegionMap';
import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import Select from '@/components/ui/Select';
import {
  ConstellationOrderBy,
  useSearchRegionsQuery,
} from '@/generated/graphql';
import { useDebounce } from '@/hooks/useDebounce';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

const ORDER_BY_OPTIONS = [
  { value: ConstellationOrderBy.NameAsc, label: 'Name A-Z' },
  { value: ConstellationOrderBy.NameDesc, label: 'Name Z-A' },
];

interface ConstellationFilterFormProps {
  onFilterChange: (filters: {
    search?: string;
    region_id?: number;
    orderBy: ConstellationOrderBy;
  }) => void;
  onClearFilters: () => void;
  initialSearch?: string;
  initialRegionId?: string;
  initialOrderBy?: ConstellationOrderBy;
}

export default function ConstellationFilterForm({
  onFilterChange,
  onClearFilters,
  initialSearch = '',
  initialRegionId = '',
  initialOrderBy = ConstellationOrderBy.NameAsc,
}: ConstellationFilterFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Both filters live in the dialog and are applied together by Apply, so the
  // state below is what is typed, not what the list is filtered by.
  const [name, setName] = useState(initialSearch);
  const [region, setRegion] = useState<{ id: number; name: string } | null>(
    initialRegionId ? { id: parseInt(initialRegionId), name: '' } : null,
  );

  // Sort sits in the bar, outside the dialog, so it acts the moment it is
  // changed. That is why the applied pair below is kept separately: emitting
  // on a sort change must not drag along a name or region that was typed into
  // the dialog and never applied.
  const [orderBy, setOrderBy] = useState(initialOrderBy);
  const [applied, setApplied] = useState<{
    search?: string;
    region_id?: number;
  }>({
    search: initialSearch || undefined,
    region_id: initialRegionId ? parseInt(initialRegionId) : undefined,
  });

  // Region typeahead, the same shape as the killmail filter's: three letters,
  // debounced, at most 40 answers.
  const [regionSearch, setRegionSearch] = useState('');
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  const debouncedRegionSearch = useDebounce(regionSearch, 500);

  const { data: regionsData, loading: regionLoading } = useSearchRegionsQuery({
    variables: { search: debouncedRegionSearch, limit: 40 },
    skip: debouncedRegionSearch.length < 3,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(event.target as Node)
      ) {
        setShowRegionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeFilterCount = [name, region].filter(Boolean).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { search: name || undefined, region_id: region?.id };
    setApplied(next);
    onFilterChange({ ...next, orderBy });
    setIsOpen(false);
  };

  const handleOrderByChange = (value: string) => {
    const next = value as ConstellationOrderBy;
    setOrderBy(next);
    onFilterChange({ ...applied, orderBy: next });
  };

  const handleClearAll = () => {
    setName('');
    setRegion(null);
    setRegionSearch('');
    setApplied({});
    setIsOpen(false);
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} id="constellation-filters">
      <FilterBar
        orderBy={
          <Select
            value={orderBy}
            onChange={handleOrderByChange}
            options={ORDER_BY_OPTIONS}
            aria-label="Sort constellations"
          />
        }
        onOpenFilters={() => setIsOpen(true)}
        activeFilterCount={activeFilterCount}
        onClear={handleClearAll}
      />

      <FilterDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Constellation Filter"
        footer={
          <>
            <button
              type="button"
              onClick={handleClearAll}
              className="button button-ghost"
            >
              CLEAR
            </button>
            <button
              type="submit"
              form="constellation-filters"
              className="button button-secondary"
            >
              APPLY
            </button>
          </>
        }
      >
        <FilterField label="Constellation Name" htmlFor="filter-name">
          <input
            type="text"
            id="filter-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </FilterField>

        <FilterField
          label="Region"
          htmlFor="filter-region"
          hint="Type at least 3 letters to search"
        >
          <div ref={regionDropdownRef}>
            <div className="relative">
              <input
                type="text"
                id="filter-region"
                aria-describedby="filter-region-hint"
                value={regionSearch}
                onChange={(e) => {
                  setRegionSearch(e.target.value);
                  setShowRegionDropdown(e.target.value.length >= 3);
                }}
                onFocus={() => {
                  if (
                    regionSearch.length >= 3 &&
                    regionsData?.regions?.items?.length
                  ) {
                    setShowRegionDropdown(true);
                  }
                }}
                className="input"
              />
              {regionLoading && regionSearch.length >= 3 && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent" />
                </div>
              )}

              {showRegionDropdown &&
                regionsData?.regions?.items &&
                regionsData.regions.items.length > 0 && (
                  <div className="absolute z-50 w-full mt-3 overflow-hidden transition float">
                    <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto max-h-96">
                      {regionsData.regions.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setRegion({ id: item.id, name: item.name });
                            setRegionSearch('');
                            setShowRegionDropdown(false);
                          }}
                          className="menu-row group"
                        >
                          {/* The map sits where the portrait does in the pilot
                              search. No tile behind it: a portrait is an opaque
                              square and needs a ground, a star map is
                              transparent and is meant to take the colour of
                              the row it sits on, hover included. */}
                          <div className="flex items-center justify-center flex-none size-16">
                            <RegionMap
                              regionId={item.id}
                              regionName={item.name}
                              size={64}
                            />
                          </div>
                          <div className="flex-auto min-w-0 text-left">
                            <div className="font-semibold text-white truncate">
                              {item.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {item.constellationCount} constellations ·{' '}
                              {item.solarSystemCount} systems
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {showRegionDropdown &&
                debouncedRegionSearch.length >= 3 &&
                !regionLoading &&
                regionsData?.regions?.items?.length === 0 && (
                  <div className="absolute z-50 w-full mt-3 overflow-hidden transition float">
                    <div className="p-4 text-sm text-gray-400">
                      No regions found for &quot;{debouncedRegionSearch}&quot;
                    </div>
                  </div>
                )}
            </div>
          </div>

          {region && (
            <div className="mt-3">
              <span className="chip">
                <span className="font-semibold truncate">
                  {region.name || `Region ${region.id}`}
                </span>
                <button
                  type="button"
                  onClick={() => setRegion(null)}
                  className="button button-ghost p-1"
                  aria-label="Remove region filter"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </span>
            </div>
          )}
        </FilterField>
      </FilterDialog>
    </form>
  );
}
