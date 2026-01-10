"use client";

import { useSearchTypesQuery } from "@/generated/graphql";
import { useDebounce } from "@/hooks/useDebounce";
import {
  ChevronDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface KillmailFiltersProps {
  onFilterChange: (filters: {
    typeName?: string;
    regionId?: number;
    systemId?: number;
  }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function KillmailFilters({
  onFilterChange,
  onClearFilters,
  orderBy = "timeDesc",
  onOrderByChange,
}: KillmailFiltersProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState(""); // TypeName aramasi icin
  const [selectedTypeName, setSelectedTypeName] = useState(""); // Secilen TypeName
  const [regionId, setRegionId] = useState("");
  const [systemId, setSystemId] = useState("");

  // Ship search dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  const debouncedSearch = useDebounce(typeSearch, 500);

  // GraphQL query for ship type search
  const { data: typeData, loading: typeLoading } = useSearchTypesQuery({
    variables: {
      name: debouncedSearch,
      limit: 20,
    },
    skip: debouncedSearch.length < 3, // Only search after 3 characters
  });

  const hasActiveFilters = selectedTypeName || regionId || systemId;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show dropdown when we have results
  useEffect(() => {
    if (
      debouncedSearch.length >= 3 &&
      typeData?.types?.edges &&
      typeData.types.edges.length > 0
    ) {
      setShowDropdown(true);
    }
  }, [debouncedSearch, typeData]);

  const handleShipSelect = (shipTypeName: string) => {
    // Set the ship type name for filtering
    setSelectedTypeName(shipTypeName);
    setTypeSearch(""); // Clear arama inputunu
    setShowDropdown(false);

    // Apply filter immediately
    onFilterChange({
      typeName: shipTypeName,
      regionId: regionId ? Number(regionId) : undefined,
      systemId: systemId ? Number(systemId) : undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      typeName: selectedTypeName || undefined,
      regionId: regionId ? Number(regionId) : undefined,
      systemId: systemId ? Number(systemId) : undefined,
    });
  };

  const handleClearAll = () => {
    setTypeSearch("");
    setSelectedTypeName("");
    setRegionId("");
    setSystemId("");
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      {/* Search Bar and OrderBy */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1" ref={dropdownRef}>
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search ships (min 3 letters)..."
            value={typeSearch}
            onChange={(e) => {
              setTypeSearch(e.target.value);
              if (e.target.value.length >= 3) {
                setShowDropdown(true);
              } else {
                setShowDropdown(false);
              }
            }}
            onFocus={() => {
              // Show dropdown if we have valid search results
              if (
                typeSearch.length >= 3 &&
                typeData?.types?.edges &&
                typeData.types.edges.length > 0
              ) {
                setShowDropdown(true);
              }
            }}
            className="search-input"
          />
          {typeLoading && typeSearch.length >= 3 && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
            </div>
          )}

          {/* Dropdown Results */}
          {showDropdown &&
            typeData?.types?.edges &&
            typeData.types.edges.length > 0 && (
              <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 character-dropdown-scroll max-h-96">
                  {typeData.types.edges.map((edge) => {
                    const type = edge.node;
                    const iconUrl = `https://images.evetech.net/types/${type.id}/icon?size=64`;

                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleShipSelect(type.name)}
                        className="relative flex items-center w-full p-3 group gap-x-3 text-sm/6 hover:bg-cyan-900/50"
                      >
                        <div className="flex items-center justify-center flex-none size-16 bg-gray-700/50 group-hover:bg-gray-700">
                          <img
                            src={iconUrl}
                            alt={type.name}
                            className="object-cover size-16"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/images/default-ship.png";
                            }}
                          />
                        </div>
                        <div className="flex-auto min-w-0 text-left">
                          <div className="font-semibold text-white truncate">
                            {type.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            <div className="text-gray-400 truncate">
                              {type.group?.name || "Unknown Group"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* No Results Message */}
          {showDropdown &&
            debouncedSearch.length >= 3 &&
            !typeLoading &&
            typeData?.types?.edges?.length === 0 && (
              <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                <div className="p-4 text-sm text-gray-400">
                  No ships found for "{debouncedSearch}"
                </div>
              </div>
            )}
        </div>

        {/* Search Button */}
        <button type="submit" className="button">
          <MagnifyingGlassIcon className="w-5 h-5" />
          Search
        </button>

        {/* Advanced Filters Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`button ${hasActiveFilters ? "active-filter-button" : ""}`}
        >
          <FunnelIcon className="w-5 h-5" />
          Filters
          {hasActiveFilters && (
            <span className="badge">
              {[selectedTypeName, regionId, systemId].filter(Boolean).length}
            </span>
          )}
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
            <option value="timeDesc">
              {orderBy === "timeDesc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Newest First
            </option>
            <option value="timeAsc">
              {orderBy === "timeAsc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Oldest First
            </option>
          </select>
          <ChevronDownIcon className="chevron-down-icon" />
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {isOpen && (
        <div className="p-6 mt-4 space-y-4 border bg-gray-900/30 border-gray-700/50">
          <h3 className="text-sm font-medium text-gray-300">
            Advanced Filters
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Selected Ship Display */}
            <div>
              <label
                htmlFor="filter-ship"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Selected Ship
              </label>
              <input
                type="text"
                id="filter-ship"
                placeholder="No ship selected"
                value={selectedTypeName}
                readOnly
                className="input bg-gray-800/50"
              />
            </div>

            {/* Region ID Filter */}
            <div>
              <label
                htmlFor="filter-region"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Region ID
              </label>
              <input
                type="number"
                id="filter-region"
                placeholder="Region ID..."
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="input"
              />
            </div>

            {/* System ID Filter */}
            <div>
              <label
                htmlFor="filter-system"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                System ID
              </label>
              <input
                type="number"
                id="filter-system"
                placeholder="System ID..."
                value={systemId}
                onChange={(e) => setSystemId(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-700/50">
            <button type="submit" className="apply-filter-button">
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
