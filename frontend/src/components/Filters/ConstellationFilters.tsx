"use client";

import { useRegionsQuery } from "@/generated/graphql";
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

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
  orderBy = "nameAsc",
  onOrderByChange,
  initialSearch = "",
  initialRegionId = "",
}: ConstellationFiltersProps) {
  const [search, setSearch] = useState(initialSearch);
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId);

  // Fetch all regions for filter dropdown
  const { data: regionsData } = useRegionsQuery({
    variables: {
      filter: {
        page: 1,
        limit: 500,
        orderBy: "nameAsc" as any,
      },
    },
  });

  const regions = regionsData?.regions.items || [];
  const hasActiveFilters = !!search || !!selectedRegionId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: search || undefined,
      region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
    });
  };

  const handleClearAll = () => {
    setSearch("");
    setSelectedRegionId("");
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      {/* Search Bar, Region Filter, and OrderBy */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search constellations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

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

        {/* Search Button */}
        <button type="submit" className="button">
          <MagnifyingGlassIcon className="w-5 h-5" />
          Search
        </button>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="clear-filter-button"
          >
            <XMarkIcon className="w-5 h-5" />
            Clear
          </button>
        )}

        {/* OrderBy Dropdown */}
        <div className="select-option-container">
          <select
            value={orderBy}
            onChange={(e) => onOrderByChange(e.target.value)}
            className="select"
          >
            <option value="nameAsc">
              {orderBy === "nameAsc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Name A-Z
            </option>
            <option value="nameDesc">
              {orderBy === "nameDesc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Name Z-A
            </option>
          </select>
          <ChevronDownIcon className="chevron-down-icon" />
        </div>
      </div>
    </form>
  );
}
