'use client';

import RegionMap from '@/components/RegionMap/RegionMap';
import SolarSystemMap from '@/components/SolarSystemMap/SolarSystemMap';
import Select from '@/components/ui/Select';

import {
  useConstellationsQuery,
  useSearchConstellationQuery,
  useSearchConstellationsQuery,
  useSearchRegionQuery,
  useSearchRegionsQuery,
  useSearchSolarSystemsQuery,
} from '@/generated/graphql';
import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import { useDebounce } from '@/hooks/useDebounce';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

// The swatch colours are the ones the security legend carried before it was
// dropped: green high, yellow low, red null. The bounds they used to spell out
// live in getSecurityFilter below. Grey rather than white for the unfiltered
// row: white is the brightest mark in the palette and would pull more attention
// than the bands it sits above.
const SECURITY_OPTIONS = [
  { value: 'all', label: 'All Security', swatch: 'bg-gray-500' },
  { value: 'highsec', label: 'High Sec', swatch: 'bg-green-500' },
  { value: 'lowsec', label: 'Low Sec', swatch: 'bg-yellow-500' },
  { value: 'nullsec', label: 'Null Sec', swatch: 'bg-red-500' },
];

const ORDER_BY_OPTIONS = [
  { value: 'nameAsc', label: 'Name A-Z' },
  { value: 'nameDesc', label: 'Name Z-A' },
  { value: 'securityStatusDesc', label: 'Security (Highest First)' },
  { value: 'securityStatusAsc', label: 'Security (Lowest First)' },
  { value: 'shipKillsDesc', label: 'Ship Kills (Most First)' },
  { value: 'shipKillsAsc', label: 'Ship Kills (Least First)' },
  { value: 'podKillsDesc', label: 'Pod Kills (Most First)' },
  { value: 'podKillsAsc', label: 'Pod Kills (Least First)' },
  { value: 'npcKillsDesc', label: 'NPC Kills (Most First)' },
  { value: 'npcKillsAsc', label: 'NPC Kills (Least First)' },
];

interface SolarSystemFilterFormProps {
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

export default function SolarSystemFilterForm({
  onFilterChange,
  onClearFilters,
  orderBy = 'nameAsc',
  onOrderByChange,
  initialSearch = '',
  initialRegionId = '',
  initialConstellationId = '',
  initialSecurity = 'all',
}: SolarSystemFilterFormProps) {
  // Panel open/close state
  const [isOpen, setIsOpen] = useState(false);

  // Solar System search dropdown state
  const [solarSystemSearch, setSolarSystemSearch] = useState('');
  const [selectedSystemName, setSelectedSystemName] = useState(initialSearch);
  const [showSolarSystemDropdown, setShowSolarSystemDropdown] = useState(false);
  const solarSystemDropdownRef = useRef<HTMLDivElement>(null);

  // Region search state
  const [regionSearch, setRegionSearch] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId);
  const [selectedRegionName, setSelectedRegionName] = useState('');
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const regionDropdownRef = useRef<HTMLDivElement>(null);

  // Constellation search state
  const [constellationSearch, setConstellationSearch] = useState('');
  const [selectedConstellationId, setSelectedConstellationId] = useState(
    initialConstellationId,
  );
  const [selectedConstellationName, setSelectedConstellationName] =
    useState('');
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

  // GraphQL query for constellations filtered by region (for dropdown)
  const { data: allConstellationsData } = useConstellationsQuery({
    variables: {
      filter: {
        region_id: selectedRegionId ? parseInt(selectedRegionId) : undefined,
        limit: 1000,
        orderBy: 'nameAsc' as any,
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

  const activeFilterCount = [
    selectedSystemName,
    selectedRegionId,
    selectedConstellationId,
    securityFilter !== 'all',
  ].filter(Boolean).length;

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

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      case 'highsec':
        return { securityStatusMin: 0.5 };
      case 'lowsec':
        return { securityStatusMin: 0.1, securityStatusMax: 0.4 };
      case 'nullsec':
        return { securityStatusMax: 0.0 };
      default:
        return {};
    }
  };

  const handleSolarSystemSelect = (name: string) => {
    setSelectedSystemName(name);
    setSolarSystemSearch('');
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
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setSolarSystemSearch('');
    setSelectedSystemName('');
    setSelectedRegionId('');
    setSelectedConstellationId('');
    setSecurityFilter('all');
    onClearFilters();
  };

  const handleRegionSelect = (id: number, name: string) => {
    setSelectedRegionId(String(id));
    setSelectedRegionName(name);
    setRegionSearch('');
    setShowRegionDropdown(false);
    // Clear constellation when region changes
    if (selectedConstellationId) {
      setSelectedConstellationId('');
      setSelectedConstellationName('');
    }
  };

  const handleConstellationChange = (constellationId: string) => {
    setSelectedConstellationId(constellationId);
    // Set constellation name
    const constellation = constellations.find(
      (c) => c.id === parseInt(constellationId),
    );
    setSelectedConstellationName(constellation?.name || '');
  };

  // Extract constellations for the dropdown
  const constellations = allConstellationsData?.constellations?.items || [];

  return (
    <form onSubmit={handleSubmit} id="solar-system-filters" className="mb-6">
      <FilterBar
        onOpenFilters={() => setIsOpen(true)}
        activeFilterCount={activeFilterCount}
        onClear={handleClearAll}
      />

      <FilterDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Solar System Filters"
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
              form="solar-system-filters"
              className="button button-secondary"
            >
              APPLY
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Solar System Search */}
          <FilterField
            label="Solar System"
            htmlFor="filter-solar-system"
            hint="Type at least 3 letters to search"
          >
            <div ref={solarSystemDropdownRef}>
              <div className="relative">
                <input
                  type="text"
                  id="filter-solar-system"
                  aria-describedby="filter-solar-system-hint"
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
                  className="input"
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
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition float">
                      <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 max-h-96">
                        {solarSystemData.solarSystems.items.map((system) => {
                          const securityClass =
                            system.security_class || 'Unknown';
                          const securityColor =
                            securityClass === 'A' ||
                            securityClass === 'B' ||
                            securityClass === 'C'
                              ? 'text-green-400'
                              : securityClass === 'D' ||
                                  securityClass === 'E' ||
                                  securityClass === 'F'
                                ? 'text-yellow-400'
                                : securityClass === 'G'
                                  ? 'text-orange-400'
                                  : 'text-red-400';

                          return (
                            <button
                              key={system.id}
                              type="button"
                              onClick={() =>
                                handleSolarSystemSelect(system.name)
                              }
                              className="menu-row group"
                            >
                              {/* The diagram sits where the portrait does in
                                  the pilot search. It removes itself for the
                                  401 systems that have neither a star nor a
                                  planet, so the row falls back to text. */}
                              <div className="flex items-center justify-center flex-none size-16">
                                <SolarSystemMap
                                  systemId={system.id}
                                  systemName={system.name}
                                  size={64}
                                />
                              </div>
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
                                      {system.constellation.region.name} ›{' '}
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
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition float">
                      <div className="p-4 text-sm text-gray-400">
                        No solar systems found for "{debouncedSolarSystemSearch}
                        "
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Solar System chip */}
            {selectedSystemName && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-medium text-gray-400">
                  Solar System
                </div>
                <span className="chip">
                  <span className="font-semibold truncate">
                    {selectedSystemName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSystemName('')}
                    className="button button-ghost p-1"
                    aria-label="Remove solar system filter"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              </div>
            )}
          </FilterField>

          {/* Region Filter */}
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

                {/* Region Dropdown */}
                {showRegionDropdown &&
                  regionsData?.regions?.items &&
                  regionsData.regions.items.length > 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition float">
                      <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 max-h-96">
                        {regionsData.regions.items.map((region) => (
                          <button
                            key={region.id}
                            type="button"
                            onClick={() =>
                              handleRegionSelect(region.id, region.name)
                            }
                            className="menu-row group"
                          >
                            {/* The map sits where the portrait does in the
                                pilot search. No tile behind it: RegionMap is
                                transparent and takes the colour of the row it
                                sits on, hover included. */}
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

                {/* No Results */}
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

            {/* Region chip */}
            {selectedRegionId && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-medium text-gray-400">
                  Region
                </div>
                <span className="chip">
                  <span className="font-semibold truncate">
                    {selectedRegionName || `Region ${selectedRegionId}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRegionId('');
                      setSelectedRegionName('');
                      // Clear constellation when region is cleared
                      setSelectedConstellationId('');
                      setSelectedConstellationName('');
                    }}
                    className="button button-ghost p-1"
                    aria-label="Remove region filter"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              </div>
            )}
          </FilterField>

          {/* Constellation Filter */}
          <FilterField label="Constellation" htmlFor="filter-constellation">
            <Select
              value={selectedConstellationId}
              onChange={handleConstellationChange}
              disabled={!selectedRegionId}
              options={[
                { value: '', label: 'All Constellations' },
                ...constellations.map((constellation) => ({
                  value: String(constellation.id),
                  label: constellation.name,
                })),
              ]}
              className="w-full"
              aria-label="Constellation"
            />

            {/* Constellation chip */}
            {selectedConstellationId && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-medium text-gray-400">
                  Constellation
                </div>
                <span className="chip">
                  <span className="font-semibold truncate">
                    {selectedConstellationName ||
                      `Constellation ${selectedConstellationId}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedConstellationId('');
                      setSelectedConstellationName('');
                    }}
                    className="button button-ghost p-1"
                    aria-label="Remove constellation filter"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              </div>
            )}
          </FilterField>

          {/* Security Filter */}
          <FilterField label="Security Status" htmlFor="filter-security">
            <Select
              value={securityFilter}
              onChange={setSecurityFilter}
              options={SECURITY_OPTIONS}
              className="w-full"
              aria-label="Security status"
            />
          </FilterField>

          {/* Sort By */}
          <FilterField label="Sort By" htmlFor="filter-sort">
            <Select
              value={orderBy}
              onChange={onOrderByChange}
              options={ORDER_BY_OPTIONS}
              className="w-full"
              aria-label="Sort solar systems"
            />
          </FilterField>
        </div>
      </FilterDialog>
    </form>
  );
}
