'use client';

import Select from '@/components/ui/Select';

import { useRegionsQuery } from '@/generated/graphql';
import FilterBar from '@/components/ui/FilterBar';
import { useState } from 'react';

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
            <Select
              value={selectedRegionId}
              onChange={setSelectedRegionId}
              options={[
                { value: '', label: 'All Regions' },
                ...regions.map((region) => ({
                  value: String(region.id),
                  label: region.name,
                })),
              ]}
              className="min-w-[180px]"
              aria-label="Filter by region"
            />

            <button type="submit" className="button button-secondary">
              Search
            </button>
          </>
        }
        orderBy={
          <Select
            value={orderBy}
            onChange={onOrderByChange}
            options={ORDER_BY_OPTIONS}
            aria-label="Sort constellations"
          />
        }
        activeFilterCount={activeFilterCount}
        onClear={handleClearAll}
      />
    </form>
  );
}
