"use client";

import {
  useConstellationsQuery,
  useRegionsQuery,
  useSearchConstellationQuery,
  useSearchConstellationsQuery,
  useSearchRegionQuery,
  useSearchRegionsQuery,
  useSearchSolarSystemsQuery,
} from "@/generated/graphql";
import { useDebounce } from "@/hooks/useDebounce";
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

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
  // Panel open/close state
  const [isOpen, setIsOpen] = useState(false);

  // Solar System search dropdown state
  const [solarSystemSearch, setSolarSystemSearch] = useState("");
  const [selectedSystemName, setSelectedSystemName] = useState(initialSearch);
  const [showSolarSystemDropdown, setShowSolarSystemDropdown] = useState(false);
  const solarSystemDropdownRef = useRef<HTMLDivElement>(null);

  // Region search state
  const [regionSearch, setRegionSearch] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId);
  const [selectedRegionName, setSelectedRegionName] = useState("");
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const regionDropdownRef = useRef<HTMLDivElement>(null);

  // Constellation search state
  const [constellationSearch, setConstellationSearch] = useState("");
  const [selectedConstellationId, setSelectedConstellationId] = useState(
    initialConstellationId,
  );
  const [selectedConstellationName, setSelectedConstellationName] =
    useState("");
  const [showConstellationDropdown, setShowConstellationDropdown] =
    useState(false);
  const constellationDropdownRef = useRef<HTMLDivElement>(null);

  const [securityFilter, setSecurityFilter] = useState(initialSecurity);

  // Debounce the search queries
  const debouncedSolarSystemSearch = useDebounce(solarSystemSearch, 500);
  const debouncedRegionSearch = useDebounce(regionSearch, 500);
  const debouncedConstellationSearch = useDebounce(constellationSearch, 500);

  // GraphQL query for solar system search
  const { data: solarSystemData, loading: solarSystemLoading } =
    useSearchSolarSystemsQuery({
      variables: {
        search: debouncedSolarSystemSearch,
        limit: 20,
      },
      skip: debouncedSolarSystemSearch.length < 3,
    });

  // GraphQL query for region search
  const { data: regionsData, loading: regionLoading } = useSearchRegionsQuery({
    variables: {
      search: debouncedRegionSearch,
      limit: 40,
    },
    skip: debouncedRegionSearch.length < 3,
  });

  // GraphQL query for constellation search
  const { data: constellationData, loading: constellationLoading } =
    useSearchConstellationsQuery({
      variables: {
        search: debouncedConstellationSearch,
        limit: 20,
      },
      skip: debouncedConstellationSearch.length < 3,
    });

  // GraphQL query for all regions (for dropdown)
  const { data: allRegionsData } = useRegionsQuery({
    variables: {
      filter: {
        limit: 1000,
        orderBy: "nameAsc" as any,
      },
    },
  });

  // GraphQL query for constellations filtered by region (for dropdown)
  const { data: allConstellationsData } = useConstellationsQuery({
    variables: {
      filter: {
        region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
        limit: 1000,
        orderBy: "nameAsc" as any,
      },
    },
    skip: !selectedRegionId,
  });

  // Fetch initial region name from URL param
  const { data: initialRegionData } = useSearchRegionQuery({
    variables: { id: parseInt(initialRegionId) },
    skip: !initialRegionId,
  });

  // Fetch initial constellation name from URL param
  const { data: initialConstellationData } = useSearchConstellationQuery({
    variables: { id: parseInt(initialConstellationId) },
    skip: !initialConstellationId,
  });

  // Populate region name from initial fetch
  useEffect(() => {
    if (initialRegionData?.region?.name) {
      setSelectedRegionName(initialRegionData.region.name);
    }
  }, [initialRegionData]);

  // Populate constellation name from initial fetch
  useEffect(() => {
    if (initialConstellationData?.constellation?.name) {
      setSelectedConstellationName(initialConstellationData.constellation.name);
    }
  }, [initialConstellationData]);

  // Populate constellation name from initial fetch
  useEffect(() => {
    if (initialConstellationData?.constellation?.name) {
      setSelectedConstellationName(initialConstellationData.constellation.name);
    }
  }, [initialConstellationData]);

  const hasActiveFilters =
    !!selectedSystemName ||
    !!selectedRegionId ||
    !!selectedConstellationId ||
    securityFilter !== "all";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        solarSystemDropdownRef.current &&
        !solarSystemDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSolarSystemDropdown(false);
      }
      if (
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(event.target as Node)
      ) {
        setShowRegionDropdown(false);
      }
      if (
        constellationDropdownRef.current &&
        !constellationDropdownRef.current.contains(event.target as Node)
      ) {
        setShowConstellationDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show dropdown when we have results
  useEffect(() => {
    if (
      debouncedSolarSystemSearch.length >= 3 &&
      solarSystemData?.solarSystems?.items &&
      solarSystemData.solarSystems.items.length > 0
    ) {
      setShowSolarSystemDropdown(true);
    }
  }, [debouncedSolarSystemSearch, solarSystemData]);

  useEffect(() => {
    if (
      debouncedRegionSearch.length >= 3 &&
      regionsData?.regions?.items &&
      regionsData.regions.items.length > 0
    ) {
      setShowRegionDropdown(true);
    }
  }, [debouncedRegionSearch, regionsData]);

  useEffect(() => {
    if (
      debouncedConstellationSearch.length >= 3 &&
      constellationData?.constellations?.items &&
      constellationData.constellations.items.length > 0
    ) {
      setShowConstellationDropdown(true);
    }
  }, [debouncedConstellationSearch, constellationData]);

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

  const handleSolarSystemSelect = (name: string) => {
    setSelectedSystemName(name);
    setSolarSystemSearch("");
    setShowSolarSystemDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const securityParams = getSecurityFilter();
    onFilterChange({
      search: selectedSystemName || undefined,
      region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
      constellation_id: selectedConstellationId
        ? parseInt(selectedConstellationId)
        : undefined,
      ...securityParams,
    });
  };

  const handleClearAll = () => {
    setSolarSystemSearch("");
    setSelectedSystemName("");
    setSelectedRegionId("");
    setSelectedConstellationId("");
    setSecurityFilter("all");
    onClearFilters();
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    // Set region name
    const region = regions.find((r) => r.id === parseInt(regionId));
    setSelectedRegionName(region?.name || "");
    // Clear constellation when region changes
    if (selectedConstellationId) {
      setSelectedConstellationId("");
      setSelectedConstellationName("");
    }
  };

  const handleConstellationChange = (constellationId: string) => {
    setSelectedConstellationId(constellationId);
    // Set constellation name
    const constellation = constellations.find(
      (c) => c.id === parseInt(constellationId),
    );
    setSelectedConstellationName(constellation?.name || "");
  };

  // Extract regions and constellations for dropdowns
  const regions = allRegionsData?.regions?.items || [];
  const constellations = allConstellationsData?.constellations?.items || [];

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      {/* Top Bar: Filters, Clear */}
      <div className="flex items-center justify-end gap-3">
        {/* Advanced Filters Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`button ${hasActiveFilters ? "active-filter-button" : ""}`}
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
          Filters
          {hasActiveFilters && (
            <span className="badge">
              {
                [
                  selectedSystemName,
                  selectedRegionId,
                  selectedConstellationId,
                  securityFilter !== "all",
                ].filter(Boolean).length
              }
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
      </div>

      {/* Advanced Filters Panel */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "max-h-500 opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"} p-6 space-y-4 border bg-neutral-900 border-white/5`}
      >
        <h3 className="text-sm font-medium text-gray-300">
          Solar System Filters
        </h3>

        <div className="flex gap-6">
          {/* LEFT: Inputs */}
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            {/* Solar System Search */}
            <div>
              <label
                htmlFor="filter-solar-system"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Solar System
              </label>
              <div ref={solarSystemDropdownRef}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="filter-solar-system"
                    placeholder="Search solar system (min 3 letters)..."
                    value={solarSystemSearch}
                    onChange={(e) => {
                      setSolarSystemSearch(e.target.value);
                      if (e.target.value.length >= 3)
                        setShowSolarSystemDropdown(true);
                      else setShowSolarSystemDropdown(false);
                    }}
                    onFocus={() => {
                      if (
                        solarSystemSearch.length >= 3 &&
                        solarSystemData?.solarSystems?.items &&
                        solarSystemData.solarSystems.items.length > 0
                      )
                        setShowSolarSystemDropdown(true);
                    }}
                    className="search-input"
                  />
                  {solarSystemLoading && solarSystemSearch.length >= 3 && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
                    </div>
                  )}

                  {/* Solar System Dropdown */}
                  {showSolarSystemDropdown &&
                    solarSystemData?.solarSystems?.items &&
                    solarSystemData.solarSystems.items.length > 0 && (
                      <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                        <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto character-dropdown-scroll max-h-96">
                          {solarSystemData.solarSystems.items.map((system) => {
                            const securityClass =
                              system.security_class || "Unknown";
                            const securityColor =
                              securityClass === "A" ||
                              securityClass === "B" ||
                              securityClass === "C"
                                ? "text-green-400"
                                : securityClass === "D" ||
                                    securityClass === "E" ||
                                    securityClass === "F"
                                  ? "text-yellow-400"
                                  : securityClass === "G"
                                    ? "text-orange-400"
                                    : "text-red-400";

                            return (
                              <button
                                key={system.id}
                                type="button"
                                onClick={() =>
                                  handleSolarSystemSelect(system.name)
                                }
                                className="relative flex items-center w-full p-3 group gap-x-3 text-sm/6 hover:bg-white/5"
                              >
                                <div className="flex-auto min-w-0 text-left">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white truncate">
                                      {system.name}
                                    </span>
                                    <span
                                      className={`text-xs font-semibold ${securityColor}`}
                                    >
                                      {system.securityStatus?.toFixed(1)}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {system.constellation?.region?.name && (
                                      <div className="text-gray-400 truncate">
                                        {system.constellation.region.name} ›{" "}
                                        {system.constellation?.name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* No Results */}
                  {showSolarSystemDropdown &&
                    debouncedSolarSystemSearch.length >= 3 &&
                    !solarSystemLoading &&
                    solarSystemData?.solarSystems?.items?.length === 0 && (
                      <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                        <div className="p-4 text-sm text-gray-400">
                          No solar systems found for "
                          {debouncedSolarSystemSearch}"
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Region Filter */}
            <div>
              <label
                htmlFor="filter-region"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Region
              </label>
              <div className="select-option-container">
                <select
                  id="filter-region"
                  value={selectedRegionId}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="w-full select"
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
            </div>

            {/* Constellation Filter */}
            <div>
              <label
                htmlFor="filter-constellation"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Constellation
              </label>
              <div className="select-option-container">
                <select
                  id="filter-constellation"
                  value={selectedConstellationId}
                  onChange={(e) => handleConstellationChange(e.target.value)}
                  className="w-full select"
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
            </div>

            {/* Security Filter */}
            <div>
              <label
                htmlFor="filter-security"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Security Status
              </label>
              <div className="select-option-container">
                <select
                  id="filter-security"
                  value={securityFilter}
                  onChange={(e) => setSecurityFilter(e.target.value)}
                  className="w-full select"
                >
                  <option value="all">All Security</option>
                  <option value="highsec">High Sec (≥0.5)</option>
                  <option value="lowsec">Low Sec (0.1-0.4)</option>
                  <option value="nullsec">Null Sec (≤0.0)</option>
                </select>
                <ChevronDownIcon className="chevron-down-icon" />
              </div>
            </div>

            {/* Sort By */}
            <div>
              <label
                htmlFor="filter-sort"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Sort By
              </label>
              <div className="select-option-container">
                <select
                  id="filter-sort"
                  value={orderBy}
                  onChange={(e) => onOrderByChange(e.target.value)}
                  className="w-full select"
                >
                  <option value="nameAsc">Name A-Z</option>
                  <option value="nameDesc">Name Z-A</option>
                  <option value="securityStatusDesc">
                    Security (Highest First)
                  </option>
                  <option value="securityStatusAsc">
                    Security (Lowest First)
                  </option>
                  <option value="shipKillsDesc">Ship Kills (Most First)</option>
                  <option value="shipKillsAsc">Ship Kills (Least First)</option>
                  <option value="podKillsDesc">Pod Kills (Most First)</option>
                  <option value="podKillsAsc">Pod Kills (Least First)</option>
                  <option value="npcKillsDesc">NPC Kills (Most First)</option>
                  <option value="npcKillsAsc">NPC Kills (Least First)</option>
                </select>
                <ChevronDownIcon className="chevron-down-icon" />
              </div>
            </div>
          </div>

          {/* RIGHT: Selected chips */}
          <div className="flex flex-col gap-4 min-w-48">
            <p className="text-xs font-medium text-gray-400">Selected</p>

            {/* Solar System chip */}
            {selectedSystemName && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium text-gray-400">
                  Solar System
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 gap-2 px-3 py-2 text-sm text-white bg-purple-900/30">
                    <span className="font-semibold truncate">
                      {selectedSystemName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSystemName("")}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Region chip */}
            {selectedRegionId && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium text-gray-400">Region</div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 gap-2 px-3 py-2 text-sm text-white bg-purple-900/30">
                    <span className="font-semibold truncate">
                      {selectedRegionName || `Region ${selectedRegionId}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRegionId("");
                      setSelectedRegionName("");
                      // Clear constellation when region is cleared
                      setSelectedConstellationId("");
                      setSelectedConstellationName("");
                    }}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Constellation chip */}
            {selectedConstellationId && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium text-gray-400">
                  Constellation
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 gap-2 px-3 py-2 text-sm text-white bg-purple-900/30">
                    <span className="font-semibold truncate">
                      {selectedConstellationName ||
                        `Constellation ${selectedConstellationId}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedConstellationId("");
                      setSelectedConstellationName("");
                    }}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Apply Filters Button */}

        <div className="flex justify-end pt-4 border-t border-white/5">
          <button type="submit" className="apply-filter-button">
            Apply Filters
          </button>
        </div>
      </div>
    </form>
  );
}
