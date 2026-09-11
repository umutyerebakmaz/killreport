'use client';

import RegionMap from '@/components/RegionMap/RegionMap';
import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import Select from '@/components/ui/Select';
import { useSearchRegionsQuery } from '@/generated/graphql';
import { useDebounce } from '@/hooks/useDebounce';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

const ORDER_BY_OPTIONS = [
  { value: 'nameAsc', label: 'Name A-Z' },
  { value: 'nameDesc', label: 'Name Z-A' },
];

interface ConstellationFilterFormProps {
  onFilterChange: (filters: { search?: string; region_id?: number }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
  initialSearch?: string;
  initialRegionId?: string;
}

export default function ConstellationFilterForm({
  onFilterChange,
  onClearFilters,
  orderBy = 'nameAsc',
  onOrderByChange,
  initialSearch = '',
  initialRegionId = '',
}: ConstellationFilterFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  // The bar's own search box filters as it is typed.
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 500);

  // The region lives in the dialog and is submit-driven like every other
  // dialog field, so it needs two states: what is picked in the dialog, and
  // what the list is actually filtered by. Without the split, a region chosen
  // and then abandoned would ride along on the next keystroke's emit.
  const [appliedRegion, setAppliedRegion] = useState<{
    id: number;
    name: string;
  } | null>(
    initialRegionId ? { id: parseInt(initialRegionId), name: '' } : null,
  );
  const [pendingRegion, setPendingRegion] = useState(appliedRegion);

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

  // The first run would re-emit the filters the page already read out of the
  // URL, resetting the page number to 1 on every load.
  const emitted = useRef(false);
  useEffect(() => {
    if (!emitted.current) {
      emitted.current = true;
      return;
    }
    onFilterChange({
      search: debouncedSearch || undefined,
      region_id: appliedRegion?.id,
    });
    // onFilterChange is redefined on every render of the page above, so it
    // cannot be a dependency without emitting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, appliedRegion]);

  const activeFilterCount = appliedRegion ? 1 : 0;
  const hasActiveFilters = Boolean(search || appliedRegion);

  const handleApply = () => {
    setAppliedRegion(pendingRegion);
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setSearch('');
    setPendingRegion(null);
    setAppliedRegion(null);
    setRegionSearch('');
    setIsOpen(false);
    onClearFilters();
  };

  return (
    <>
      <FilterBar
        search={
          <div className="relative flex-1">
            <input
              type="text"
              aria-label="Search constellations"
              placeholder="Search constellations..."
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
            aria-label="Sort constellations"
          />
        }
        onOpenFilters={() => {
          setPendingRegion(appliedRegion);
          setIsOpen(true);
        }}
        activeFilterCount={activeFilterCount}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearAll}
      />

      <FilterDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
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
              type="button"
              onClick={handleApply}
              className="button button-secondary"
            >
              APPLY
            </button>
          </>
        }
      >
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
                      {regionsData.regions.items.map((region) => (
                        <button
                          key={region.id}
                          type="button"
                          onClick={() => {
                            setPendingRegion({
                              id: region.id,
                              name: region.name,
                            });
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
                              regionId={region.id}
                              regionName={region.name}
                              size={64}
                            />
                          </div>
                          <div className="flex-auto min-w-0 text-left">
                            <div className="font-semibold text-white truncate">
                              {region.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {region.constellationCount} constellations ·{' '}
                              {region.solarSystemCount} systems
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

          {pendingRegion && (
            <div className="mt-3">
              <span className="chip">
                <span className="font-semibold truncate">
                  {pendingRegion.name || `Region ${pendingRegion.id}`}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingRegion(null)}
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
    </>
  );
}
