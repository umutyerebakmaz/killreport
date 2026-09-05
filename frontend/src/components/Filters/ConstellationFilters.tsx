'use client';

import { useRegionsQuery } from '@/generated/graphql';
import FilterBar from '@/components/ui/FilterBar';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface ConstellationFiltersProps {
  onFilterChange: (filters: { search?: string; region_id?: number }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
  initialSearch?: string;
  initialRegionId?: string;
}

export default function ConstellationFilters({
  onFilterChange,
  onClearFilters,
  orderBy = 'nameAsc',
  onOrderByChange,
  initialSearch = '',
  initialRegionId = '',
}: ConstellationFiltersProps) {
  const [search, setSearch] = useState(initialSearch);
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId);

  // Fetch all regions for filter dropdown
  const { data: regionsData } = useRegionsQuery({
    variables: {
      filter: {
        page: 1,
        limit: 500,
        orderBy: 'nameAsc' as any,
      },
    },
  });

  const regions = regionsData?.regions.items || [];
  const activeFilterCount = [search, selectedRegionId].filter(Boolean).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: search || undefined,
      region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
    });
  };

  const handleClearAll = () => {
    setSearch('');
    setSelectedRegionId('');
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <FilterBar
        search={
          <div className="relative flex-1">
            <input
              type="text"
              aria-label="Search constellations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>
        }
        controls={
          <>
            {/* Region Filter Dropdown */}
            <div className="select-option-container">
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
                className="select min-w-[180px]"
              >
                <option value="">All Regions</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="chevron-down-icon" />
            </div>

            <button type="submit" className="button button-secondary">
              Search
            </button>
          </>
        }
        orderBy={
          <div className="select-option-container">
            <select
              value={orderBy}
              onChange={(e) => onOrderByChange(e.target.value)}
              className="select"
            >
              <option value="nameAsc">
                {orderBy === 'nameAsc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Name A-Z
              </option>
              <option value="nameDesc">
                {orderBy === 'nameDesc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Name Z-A
              </option>
            </select>
            <ChevronDownIcon className="chevron-down-icon" />
          </div>
        }
        activeFilterCount={activeFilterCount}
        onClear={handleClearAll}
      />
    </form>
  );
}
