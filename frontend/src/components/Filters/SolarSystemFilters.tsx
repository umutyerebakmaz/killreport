"use client";

import { useConstellationsQuery, useRegionsQuery } from "@/generated/graphql";
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

interface SolarSystemFiltersProps {
  onFilterChange: (filters: {
    search?: string;
    region_id?: number;
    constellation_id?: number;
    securityStatusMin?: number;
    securityStatusMax?: number;
  }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
  initialSearch?: string;
  initialRegionId?: string;
  initialConstellationId?: string;
  initialSecurity?: string;
}

export default function SolarSystemFilters({
  onFilterChange,
  onClearFilters,
  orderBy = "nameAsc",
  onOrderByChange,
  initialSearch = "",
  initialRegionId = "",
  initialConstellationId = "",
  initialSecurity = "all",
}: SolarSystemFiltersProps) {
  const [search, setSearch] = useState(initialSearch);
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId);
  const [selectedConstellationId, setSelectedConstellationId] = useState(
    initialConstellationId
  );
  const [securityFilter, setSecurityFilter] = useState(initialSecurity);

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

  // Fetch constellations for selected region
  const { data: constellationsData } = useConstellationsQuery({
    variables: {
      filter: {
        page: 1,
        limit: 500,
        orderBy: "nameAsc" as any,
        region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
      },
    },
    skip: !selectedRegionId,
  });

  const regions = regionsData?.regions.edges.map((edge) => edge.node) || [];
  const constellations =
    constellationsData?.constellations.edges.map((edge) => edge.node) || [];

  const hasActiveFilters =
    !!search ||
    !!selectedRegionId ||
    !!selectedConstellationId ||
    securityFilter !== "all";

  const getSecurityFilter = () => {
    switch (securityFilter) {
      case "highsec":
        return { securityStatusMin: 0.5 };
      case "lowsec":
        return { securityStatusMin: 0.1, securityStatusMax: 0.4 };
      case "nullsec":
        return { securityStatusMax: 0.0 };
      default:
        return {};
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const securityParams = getSecurityFilter();
    onFilterChange({
      search: search || undefined,
      region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
      constellation_id: selectedConstellationId
        ? parseInt(selectedConstellationId)
        : undefined,
      ...securityParams,
    });
  };

  const handleClearAll = () => {
    setSearch("");
    setSelectedRegionId("");
    setSelectedConstellationId("");
    setSecurityFilter("all");
    onClearFilters();
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    // Clear constellation when region changes
    if (selectedConstellationId) {
      setSelectedConstellationId("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      {/* Search Bar and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search solar systems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Region Filter Dropdown */}
        <div className="select-option-container">
          <select
            value={selectedRegionId}
            onChange={(e) => handleRegionChange(e.target.value)}
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

        {/* Constellation Filter Dropdown */}
        <div className="select-option-container">
          <select
            value={selectedConstellationId}
            onChange={(e) => setSelectedConstellationId(e.target.value)}
            className="select min-w-[180px]"
            disabled={!selectedRegionId}
          >
            <option value="">All Constellations</option>
            {constellations.map((constellation) => (
              <option key={constellation.id} value={constellation.id}>
                {constellation.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="chevron-down-icon" />
        </div>

        {/* Security Filter Dropdown */}
        <div className="select-option-container">
          <select
            value={securityFilter}
            onChange={(e) => setSecurityFilter(e.target.value)}
            className="select min-w-[150px]"
          >
            <option value="all">All Security</option>
            <option value="highsec">High Sec (≥0.5)</option>
            <option value="lowsec">Low Sec (0.1-0.4)</option>
            <option value="nullsec">Null Sec (≤0.0)</option>
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
            <option value="securityStatusDesc">
              {orderBy === "securityStatusDesc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Security ↓
            </option>
            <option value="securityStatusAsc">
              {orderBy === "securityStatusAsc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Security ↑
            </option>
          </select>
          <ChevronDownIcon className="chevron-down-icon" />
        </div>
      </div>
    </form>
  );
}
