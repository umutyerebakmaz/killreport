'use client';

import RadioGroup from '@/components/RadioGroup/RadioGroup';
import {
  useSearchCharacterQuery,
  useSearchCharactersQuery,
  useSearchConstellationQuery,
  useSearchConstellationsQuery,
  useSearchItemGroupsQuery,
  useSearchRegionQuery,
  useSearchRegionsQuery,
  useSearchSolarSystemQuery,
  useSearchSolarSystemsQuery,
  useSearchTypeQuery,
  useSearchTypesQuery,
} from '@/generated/graphql';
import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import { useDebounce } from '@/hooks/useDebounce';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

interface KillmailFiltersProps {
  onFilterChange: (filters: {
    shipTypeId?: number;
    shipGroupIds?: number[];
    characterId?: number;
    systemId?: number;
    constellationId?: number;
    regionId?: number;
    victim?: boolean;
    attacker?: boolean;
    characterVictim?: boolean;
    characterAttacker?: boolean;
    securitySpace?: string;
    minAttackers?: number;
    maxAttackers?: number;
    minValue?: number;
    maxValue?: number;
    warRelated?: boolean;
  }) => void;
  onClearFilters: () => void;
  initialShipTypeId?: number;
  initialShipGroupIds?: number[];
  initialCharacterId?: number;
  initialSystemId?: number;
  initialConstellationId?: number;
  initialRegionId?: number;
  initialMinAttackers?: number;
  initialMaxAttackers?: number;
  initialMinValue?: number;
  initialMaxValue?: number;
  initialShipRole?: 'all' | 'victim' | 'attacker';
  initialCharacterRole?: 'all' | 'victim' | 'attacker';
  initialSecuritySpace?:
    'all' | 'highsec' | 'lowsec' | 'nullsec' | 'wormhole' | 'abyssal';
  initialWarRelated?: boolean;
}

export default function KillmailFilters({
  onFilterChange,
  onClearFilters,
  initialShipTypeId,
  initialShipGroupIds,
  initialCharacterId,
  initialSystemId,
  initialConstellationId,
  initialRegionId,
  initialMinAttackers,
  initialMaxAttackers,
  initialMinValue,
  initialMaxValue,
  initialShipRole = 'all',
  initialCharacterRole = 'all',
  initialSecuritySpace = 'all',
  initialWarRelated = false,
}: KillmailFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const [shipTypeId, setShipTypeId] = useState<number | undefined>(
    initialShipTypeId,
  );
  const [shipTypeName, setShipTypeName] = useState('');

  // Ship group search state
  const [groupSearch, setGroupSearch] = useState('');
  const [shipGroupIds, setShipGroupIds] = useState<number[]>(
    initialShipGroupIds || [],
  );
  const [shipGroupNames, setShipGroupNames] = useState<Map<number, string>>(
    new Map(),
  );
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  const [minAttackers, setMinAttackers] = useState(
    initialMinAttackers ? String(initialMinAttackers) : '',
  );
  const [maxAttackers, setMaxAttackers] = useState(
    initialMaxAttackers ? String(initialMaxAttackers) : '',
  );
  const [minValue, setMinValue] = useState(
    initialMinValue ? String(initialMinValue) : '',
  );
  const [maxValue, setMaxValue] = useState(
    initialMaxValue ? String(initialMaxValue) : '',
  );
  const [shipRole, setShipRole] = useState<'all' | 'victim' | 'attacker'>(
    initialShipRole,
  );
  const [characterRole, setCharacterRole] = useState<
    'all' | 'victim' | 'attacker'
  >(initialCharacterRole);
  const [securitySpace, setSecuritySpace] = useState<
    'all' | 'highsec' | 'lowsec' | 'nullsec' | 'wormhole' | 'abyssal'
  >(initialSecuritySpace);
  const [warRelated, setWarRelated] = useState<boolean>(initialWarRelated);

  // Pilot search state
  const [pilotSearch, setPilotSearch] = useState('');
  const [characterId, setCharacterId] = useState<number | undefined>(
    initialCharacterId,
  );
  const [characterName, setCharacterName] = useState('');
  const [showPilotDropdown, setShowPilotDropdown] = useState(false);
  const pilotDropdownRef = useRef<HTMLDivElement>(null);

  // Solar system search state
  const [solarSystemSearch, setSolarSystemSearch] = useState('');
  const [systemId, setSystemId] = useState<number | undefined>(initialSystemId);
  const [solarSystemName, setSolarSystemName] = useState('');
  const [showSolarSystemDropdown, setShowSolarSystemDropdown] = useState(false);
  const solarSystemDropdownRef = useRef<HTMLDivElement>(null);

  // Constellation search state
  const [constellationSearch, setConstellationSearch] = useState('');
  const [constellationId, setConstellationId] = useState<number | undefined>(
    initialConstellationId,
  );
  const [constellationName, setConstellationName] = useState('');
  const [showConstellationDropdown, setShowConstellationDropdown] =
    useState(false);
  const constellationDropdownRef = useRef<HTMLDivElement>(null);

  // Region search state
  const [regionSearch, setRegionSearch] = useState('');
  const [regionId, setRegionId] = useState<number | undefined>(initialRegionId);
  const [regionName, setRegionName] = useState('');
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const regionDropdownRef = useRef<HTMLDivElement>(null);

  // Ship search dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const shipDropdownRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  const debouncedSearch = useDebounce(typeSearch, 500);
  const debouncedPilotSearch = useDebounce(pilotSearch, 500);
  const debouncedGroupSearch = useDebounce(groupSearch, 500);
  const debouncedSolarSystemSearch = useDebounce(solarSystemSearch, 500);
  const debouncedConstellationSearch = useDebounce(constellationSearch, 500);
  const debouncedRegionSearch = useDebounce(regionSearch, 500);

  // GraphQL query for ship type search
  const { data: typeData, loading: typeLoading } = useSearchTypesQuery({
    variables: {
      name: debouncedSearch,
      limit: 20,
    },
    skip: debouncedSearch.length < 3,
  });

  // GraphQL query for ship group search
  const { data: groupData, loading: groupLoading } = useSearchItemGroupsQuery({
    variables: {
      search: debouncedGroupSearch,
      limit: 20,
    },
    skip: debouncedGroupSearch.length < 2,
  });

  // Fetch initial character name from URL param
  const { data: initialCharacterData } = useSearchCharacterQuery({
    variables: { id: initialCharacterId! },
    skip: !initialCharacterId,
  });

  // Fetch initial ship type name from URL param
  const { data: initialTypeData } = useSearchTypeQuery({
    variables: { id: initialShipTypeId! },
    skip: !initialShipTypeId,
  });

  // Fetch initial solar system name from URL param
  const { data: initialSolarSystemData } = useSearchSolarSystemQuery({
    variables: { id: initialSystemId! },
    skip: !initialSystemId,
  });

  // Fetch initial constellation name from URL param
  const { data: initialConstellationData } = useSearchConstellationQuery({
    variables: { id: initialConstellationId! },
    skip: !initialConstellationId,
  });

  // Fetch initial region name from URL param
  const { data: initialRegionData } = useSearchRegionQuery({
    variables: { id: initialRegionId! },
    skip: !initialRegionId,
  });

  // Debug: Log region query data
  useEffect(() => {
    console.log('🔍 Region Query Debug:', {
      initialRegionId,
      initialRegionData,
      regionName: initialRegionData?.region?.name,
    });
  }, [initialRegionId, initialRegionData]);

  // Populate character name from initial fetch
  useEffect(() => {
    if (initialCharacterData?.character?.name) {
      setCharacterName(initialCharacterData.character.name);
    }
  }, [initialCharacterData]);

  // Populate ship type name from initial fetch
  useEffect(() => {
    if (initialTypeData?.type?.name) {
      setShipTypeName(initialTypeData.type.name);
    }
  }, [initialTypeData]);

  // Populate solar system name from initial fetch
  useEffect(() => {
    if (initialSolarSystemData?.solarSystem?.name) {
      setSolarSystemName(initialSolarSystemData.solarSystem.name);
    }
  }, [initialSolarSystemData]);

  // Populate constellation name from initial fetch
  useEffect(() => {
    if (initialConstellationData?.constellation?.name) {
      setConstellationName(initialConstellationData.constellation.name);
    }
  }, [initialConstellationData]);

  // Populate region name from initial fetch
  useEffect(() => {
    if (initialRegionData?.region?.name) {
      setRegionName(initialRegionData.region.name);
    }
  }, [initialRegionData]);

  // GraphQL query for pilot search
  const { data: pilotData, loading: pilotLoading } = useSearchCharactersQuery({
    variables: {
      search: debouncedPilotSearch,
      limit: 20,
    },
    skip: debouncedPilotSearch.length < 3,
  });

  // GraphQL query for solar system search
  const { data: solarSystemData, loading: solarSystemLoading } =
    useSearchSolarSystemsQuery({
      variables: {
        search: debouncedSolarSystemSearch,
        limit: 20,
      },
      skip: debouncedSolarSystemSearch.length < 3,
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

  // GraphQL query for region search
  const { data: regionsData, loading: regionLoading } = useSearchRegionsQuery({
    variables: {
      search: debouncedRegionSearch,
      limit: 40,
    },
    skip: debouncedRegionSearch.length < 3,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        shipDropdownRef.current &&
        !shipDropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
      if (
        groupDropdownRef.current &&
        !groupDropdownRef.current.contains(event.target as Node)
      ) {
        setShowGroupDropdown(false);
      }
      if (
        pilotDropdownRef.current &&
        !pilotDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPilotDropdown(false);
      }
      if (
        solarSystemDropdownRef.current &&
        !solarSystemDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSolarSystemDropdown(false);
      }
      if (
        constellationDropdownRef.current &&
        !constellationDropdownRef.current.contains(event.target as Node)
      ) {
        setShowConstellationDropdown(false);
      }
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

  // Sync state when initial props change (e.g., when URL changes)
  useEffect(() => {
    setShipTypeId(initialShipTypeId);
    // Clear name when shipTypeId is undefined
    if (!initialShipTypeId) {
      setShipTypeName('');
    }
  }, [initialShipTypeId]);

  useEffect(() => {
    if (initialShipGroupIds !== undefined) setShipGroupIds(initialShipGroupIds);
  }, [initialShipGroupIds]);

  useEffect(() => {
    setCharacterId(initialCharacterId);
    // Clear name when characterId is undefined
    if (!initialCharacterId) {
      setCharacterName('');
    }
  }, [initialCharacterId]);

  useEffect(() => {
    setSystemId(initialSystemId);
    // Clear name when systemId is undefined
    if (!initialSystemId) {
      setSolarSystemName('');
    }
  }, [initialSystemId]);

  useEffect(() => {
    setConstellationId(initialConstellationId);
    // Clear name when constellationId is undefined
    if (!initialConstellationId) {
      setConstellationName('');
    }
  }, [initialConstellationId]);

  useEffect(() => {
    setRegionId(initialRegionId);
    // Clear name when regionId is undefined
    if (!initialRegionId) {
      setRegionName('');
    }
  }, [initialRegionId]);

  useEffect(() => {
    setMinAttackers(initialMinAttackers ? String(initialMinAttackers) : '');
  }, [initialMinAttackers]);

  useEffect(() => {
    setMaxAttackers(initialMaxAttackers ? String(initialMaxAttackers) : '');
  }, [initialMaxAttackers]);

  useEffect(() => {
    setMinValue(initialMinValue ? String(initialMinValue) : '');
  }, [initialMinValue]);

  useEffect(() => {
    setMaxValue(initialMaxValue ? String(initialMaxValue) : '');
  }, [initialMaxValue]);

  useEffect(() => {
    setShipRole(initialShipRole);
  }, [initialShipRole]);

  useEffect(() => {
    setCharacterRole(initialCharacterRole);
  }, [initialCharacterRole]);

  useEffect(() => {
    setSecuritySpace(initialSecuritySpace);
  }, [initialSecuritySpace]);

  useEffect(() => {
    setWarRelated(initialWarRelated);
  }, [initialWarRelated]);

  // Show dropdown when we have results
  useEffect(() => {
    if (
      debouncedSearch.length >= 3 &&
      typeData?.types?.items &&
      typeData.types.items.length > 0
    ) {
      setShowDropdown(true);
    }
  }, [debouncedSearch, typeData]);

  useEffect(() => {
    if (
      debouncedGroupSearch.length >= 2 &&
      groupData?.itemGroups?.items &&
      groupData.itemGroups.items.length > 0
    ) {
      setShowGroupDropdown(true);
    }
  }, [debouncedGroupSearch, groupData]);

  useEffect(() => {
    if (
      debouncedPilotSearch.length >= 3 &&
      pilotData?.characters?.items &&
      pilotData.characters.items.length > 0
    ) {
      setShowPilotDropdown(true);
    }
  }, [debouncedPilotSearch, pilotData]);

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
      debouncedConstellationSearch.length >= 3 &&
      constellationData?.constellations?.items &&
      constellationData.constellations.items.length > 0
    ) {
      setShowConstellationDropdown(true);
    }
  }, [debouncedConstellationSearch, constellationData]);

  useEffect(() => {
    if (
      debouncedRegionSearch.length >= 3 &&
      regionsData?.regions?.items &&
      regionsData.regions.items.length > 0
    ) {
      setShowRegionDropdown(true);
    }
  }, [debouncedRegionSearch, regionsData]);

  const handleShipSelect = (typeId: number, typeName: string) => {
    // Store both ID and name
    setShipTypeId(typeId);
    setShipTypeName(typeName);
    setTypeSearch(''); // Clear arama inputunu
    setShowDropdown(false);
    // Filter will be applied when user clicks "Apply Filters" button
  };

  const handleGroupSelect = (groupId: number, groupName: string) => {
    // Add to selected groups if not already selected
    if (!shipGroupIds.includes(groupId)) {
      setShipGroupIds([...shipGroupIds, groupId]);
      setShipGroupNames(new Map(shipGroupNames).set(groupId, groupName));
    }
    setGroupSearch('');
    setShowGroupDropdown(false);
  };

  const handleGroupRemove = (groupId: number) => {
    setShipGroupIds(shipGroupIds.filter((id) => id !== groupId));
    const newMap = new Map(shipGroupNames);
    newMap.delete(groupId);
    setShipGroupNames(newMap);
  };

  const handlePilotSelect = (id: number, name: string) => {
    setCharacterId(id);
    setCharacterName(name);
    setPilotSearch('');
    setShowPilotDropdown(false);
  };

  const handleSolarSystemSelect = (id: number, name: string) => {
    setSystemId(id);
    setSolarSystemName(name);
    setSolarSystemSearch('');
    setShowSolarSystemDropdown(false);
  };

  const handleConstellationSelect = (id: number, name: string) => {
    setConstellationId(id);
    setConstellationName(name);
    setConstellationSearch('');
    setShowConstellationDropdown(false);
  };

  const handleRegionSelect = (id: number, name: string) => {
    setRegionId(id);
    setRegionName(name);
    setRegionSearch('');
    setShowRegionDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const filterData = {
      shipTypeId,
      shipGroupIds: shipGroupIds.length > 0 ? shipGroupIds : undefined,
      characterId,
      systemId,
      constellationId,
      regionId,
      victim:
        shipTypeId || shipGroupIds.length > 0
          ? shipRole === 'victim'
            ? true
            : shipRole === 'attacker'
              ? false
              : undefined
          : undefined,
      attacker:
        shipTypeId || shipGroupIds.length > 0
          ? shipRole === 'attacker'
            ? true
            : shipRole === 'victim'
              ? false
              : undefined
          : undefined,
      characterVictim: characterId
        ? characterRole === 'victim'
          ? true
          : characterRole === 'attacker'
            ? false
            : undefined
        : undefined,
      characterAttacker: characterId
        ? characterRole === 'attacker'
          ? true
          : characterRole === 'victim'
            ? false
            : undefined
        : undefined,
      securitySpace: securitySpace !== 'all' ? securitySpace : undefined,
      minAttackers: minAttackers ? Number(minAttackers) : undefined,
      maxAttackers: maxAttackers ? Number(maxAttackers) : undefined,
      minValue: minValue ? Number(minValue) : undefined,
      maxValue: maxValue ? Number(maxValue) : undefined,
      warRelated: warRelated || undefined,
    };

    onFilterChange(filterData);
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setTypeSearch('');
    setShipTypeId(undefined);
    setShipTypeName('');
    setGroupSearch('');
    setShipGroupIds([]);
    setShipGroupNames(new Map());
    setPilotSearch('');
    setCharacterId(undefined);
    setCharacterName('');
    setSolarSystemSearch('');
    setSystemId(undefined);
    setSolarSystemName('');
    setConstellationSearch('');
    setConstellationId(undefined);
    setConstellationName('');
    setRegionSearch('');
    setRegionId(undefined);
    setRegionName('');
    setMinAttackers('');
    setMaxAttackers('');
    setMinValue('');
    setMaxValue('');
    setShipRole('all');
    setCharacterRole('all');
    setSecuritySpace('all');
    setWarRelated(false);
    onClearFilters();
  };

  const activeFilterCount = [
    shipTypeId,
    shipGroupIds.length > 0,
    characterId,
    systemId,
    constellationId,
    regionId,
    securitySpace !== 'all',
    minAttackers,
    maxAttackers,
    minValue,
    maxValue,
    warRelated,
  ].filter(Boolean).length;

  return (
    <form onSubmit={handleSubmit} id="killmail-filters" className="mb-6">
      <FilterBar
        onOpenFilters={() => setIsOpen(true)}
        activeFilterCount={activeFilterCount}
        onClear={handleClearAll}
      />

      <FilterDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        footer={
          <button
            type="submit"
            form="killmail-filters"
            className="button button-primary"
          >
            Apply Filters
          </button>
        }
      >
        <div className="space-y-4">
          {/* Pilot Search */}
          <FilterField label="Pilot" htmlFor="filter-pilot">
            <div ref={pilotDropdownRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="filter-pilot"
                  placeholder="Search pilot (min 3 letters)..."
                  value={pilotSearch}
                  onChange={(e) => {
                    setPilotSearch(e.target.value);
                    if (e.target.value.length >= 3) setShowPilotDropdown(true);
                    else setShowPilotDropdown(false);
                  }}
                  onFocus={() => {
                    if (
                      pilotSearch.length >= 3 &&
                      pilotData?.characters?.items &&
                      pilotData.characters.items.length > 0
                    )
                      setShowPilotDropdown(true);
                  }}
                  className="search-input"
                />
                {pilotLoading && pilotSearch.length >= 3 && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
                  </div>
                )}

                {/* Pilot Dropdown */}
                {showPilotDropdown &&
                  pilotData?.characters?.items &&
                  pilotData.characters.items.length > 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 character-dropdown-scroll max-h-96">
                        {pilotData.characters.items.map((character) => {
                          const avatarUrl = `https://images.evetech.net/characters/${character.id}/portrait?size=128`;
                          return (
                            <button
                              key={character.id}
                              type="button"
                              onClick={() =>
                                handlePilotSelect(character.id, character.name)
                              }
                              className="menu-row group"
                            >
                              <div className="flex items-center justify-center flex-none size-16 bg-gray-700/50 group-hover:bg-gray-700">
                                <img
                                  src={avatarUrl}
                                  alt={character.name}
                                  className="object-cover size-16"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      '/images/default-avatar.png';
                                  }}
                                />
                              </div>
                              <div className="flex-auto min-w-0 text-left">
                                <div className="font-semibold text-white truncate">
                                  {character.name}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {character.corporation?.name && (
                                    <div className="text-gray-400 truncate">
                                      {character.corporation.name}
                                    </div>
                                  )}
                                  {character.alliance?.name && (
                                    <div className="text-gray-400 truncate">
                                      {character.alliance.name}
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
                {showPilotDropdown &&
                  debouncedPilotSearch.length >= 3 &&
                  !pilotLoading &&
                  pilotData?.characters?.items?.length === 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="p-4 text-sm text-gray-400">
                        No pilots found for "{debouncedPilotSearch}"
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Character chip + its own RadioGroup */}
            {characterId && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                <span className="chip">
                  <img
                    src={`https://images.evetech.net/characters/${characterId}/portrait?size=64`}
                    alt={characterName}
                    className="object-cover size-8"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/images/default-avatar.png';
                    }}
                  />
                  <span className="font-semibold truncate">
                    {characterName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCharacterId(undefined);
                      setCharacterName('');
                      setCharacterRole('all');
                    }}
                    className="button button-ghost p-1"
                    aria-label="Remove character filter"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
                <RadioGroup
                  name="character-role"
                  value={characterRole}
                  onChange={setCharacterRole}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'victim', label: 'Victim' },
                    { value: 'attacker', label: 'Attacker' },
                  ]}
                />
              </div>
            )}
          </FilterField>

          {/* Ship Search */}
          <FilterField label="Ship" htmlFor="filter-ship">
            <div ref={shipDropdownRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="filter-ship"
                  placeholder="Search ship (min 3 letters)..."
                  value={typeSearch}
                  onChange={(e) => {
                    setTypeSearch(e.target.value);
                    if (e.target.value.length >= 3) setShowDropdown(true);
                    else setShowDropdown(false);
                  }}
                  onFocus={() => {
                    if (
                      typeSearch.length >= 3 &&
                      typeData?.types?.items &&
                      typeData.types.items.length > 0
                    )
                      setShowDropdown(true);
                  }}
                  className="search-input"
                />
                {typeLoading && typeSearch.length >= 3 && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
                  </div>
                )}

                {/* Ship Dropdown */}
                {showDropdown &&
                  typeData?.types?.items &&
                  typeData.types.items.length > 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 character-dropdown-scroll max-h-96">
                        {typeData.types.items.map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => handleShipSelect(type.id, type.name)}
                            className="menu-row group"
                          >
                            <div className="flex items-center justify-center flex-none size-16 bg-gray-700/50 group-hover:bg-gray-700">
                              <img
                                src={`https://images.evetech.net/types/${type.id}/icon?size=64`}
                                alt={type.name}
                                className="object-cover size-16"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    '/images/default-ship.png';
                                }}
                              />
                            </div>
                            <div className="flex-auto min-w-0 text-left">
                              <div className="font-semibold text-white truncate">
                                {type.name}
                              </div>
                              <div className="text-sm text-gray-400 truncate">
                                {type.group?.name || 'Unknown Group'}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* No Results */}
                {showDropdown &&
                  debouncedSearch.length >= 3 &&
                  !typeLoading &&
                  typeData?.types?.items?.length === 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="p-4 text-sm text-gray-400">
                        No ships found for "{debouncedSearch}"
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Ship chip + its own RadioGroup */}
            {shipTypeId && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                <span className="chip">
                  <img
                    src={`https://images.evetech.net/types/${shipTypeId}/icon?size=64`}
                    alt={shipTypeName}
                    className="object-cover size-8"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/images/default-ship.png';
                    }}
                  />
                  <span className="font-semibold truncate">{shipTypeName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShipTypeId(undefined);
                      setShipTypeName('');
                      setShipRole('all');
                    }}
                    className="button button-ghost p-1"
                    aria-label="Remove ship filter"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
                <RadioGroup
                  name="ship-type-role"
                  value={shipRole}
                  onChange={setShipRole}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'victim', label: 'Victim' },
                    { value: 'attacker', label: 'Attacker' },
                  ]}
                />
              </div>
            )}
          </FilterField>

          {/* Ship Group Search */}
          <FilterField
            label="Ship Group (e.g., Assault Frigate)"
            htmlFor="filter-ship-group"
          >
            <div ref={groupDropdownRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="filter-ship-group"
                  placeholder="Search ship group (min 2 letters)..."
                  value={groupSearch}
                  onChange={(e) => {
                    setGroupSearch(e.target.value);
                    if (e.target.value.length >= 2) setShowGroupDropdown(true);
                    else setShowGroupDropdown(false);
                  }}
                  onFocus={() => {
                    if (
                      groupSearch.length >= 2 &&
                      groupData?.itemGroups?.items &&
                      groupData.itemGroups.items.length > 0
                    )
                      setShowGroupDropdown(true);
                  }}
                  className="search-input"
                />
                {groupLoading && groupSearch.length >= 2 && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
                  </div>
                )}

                {/* Ship Group Dropdown */}
                {showGroupDropdown &&
                  groupData?.itemGroups?.items &&
                  groupData.itemGroups.items.length > 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto character-dropdown-scroll max-h-96">
                        {groupData.itemGroups.items.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() =>
                              handleGroupSelect(group.id, group.name)
                            }
                            disabled={shipGroupIds.includes(group.id)}
                            className={`menu-row group ${shipGroupIds.includes(group.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex-auto min-w-0 text-left">
                              <div className="font-semibold text-white truncate">
                                {group.name}
                              </div>
                              <div className="text-sm text-gray-400 truncate">
                                {group.category?.name || 'Unknown Category'}
                              </div>
                            </div>
                            {shipGroupIds.includes(group.id) && (
                              <div className="text-xs text-green-500">
                                ✓ Selected
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* No Results */}
                {showGroupDropdown &&
                  debouncedGroupSearch.length >= 2 &&
                  !groupLoading &&
                  groupData?.itemGroups?.items?.length === 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="p-4 text-sm text-gray-400">
                        No ship groups found for "{debouncedGroupSearch}"
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Ship Groups chips */}
            {shipGroupIds.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-medium text-gray-400">
                  Ship Groups
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {shipGroupIds.map((groupId) => (
                      <span key={groupId} className="chip">
                        <span className="font-semibold truncate">
                          {shipGroupNames.get(groupId) || `Group ${groupId}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleGroupRemove(groupId)}
                          className="button button-ghost p-1"
                          aria-label="Remove ship group filter"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {!shipTypeId && (
                    <RadioGroup
                      name="ship-group-role"
                      value={shipRole}
                      onChange={setShipRole}
                      options={[
                        { value: 'all', label: 'All' },
                        { value: 'victim', label: 'Victim' },
                        { value: 'attacker', label: 'Attacker' },
                      ]}
                    />
                  )}
                </div>
              </div>
            )}
          </FilterField>

          {/* Solar System Search */}
          <FilterField label="Solar System" htmlFor="filter-solar-system">
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
                                handleSolarSystemSelect(system.id, system.name)
                              }
                              className="menu-row group"
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
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="p-4 text-sm text-gray-400">
                        No solar systems found for "{debouncedSolarSystemSearch}
                        "
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Solar System chip */}
            {systemId && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-medium text-gray-400">
                  Solar System
                </div>
                <span className="chip">
                  <span className="font-semibold truncate">
                    {solarSystemName || `System ${systemId}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      console.log(
                        '🔍 System chip remove clicked, current state:',
                        {
                          systemId,
                          solarSystemName,
                          constellationId,
                          constellationName,
                        },
                      );
                      setSystemId(undefined);
                      setSolarSystemName('');
                    }}
                    className="button button-ghost p-1"
                    aria-label="Remove solar system filter"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              </div>
            )}
          </FilterField>

          {/* Region Search */}
          <FilterField label="Region" htmlFor="filter-region">
            <div ref={regionDropdownRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="filter-region"
                  placeholder="Search region (min 3 letters)..."
                  value={regionSearch}
                  onChange={(e) => {
                    setRegionSearch(e.target.value);
                    if (e.target.value.length >= 3) setShowRegionDropdown(true);
                    else setShowRegionDropdown(false);
                  }}
                  onFocus={() => {
                    if (
                      regionSearch.length >= 3 &&
                      regionsData?.regions?.items &&
                      regionsData.regions.items.length > 0
                    )
                      setShowRegionDropdown(true);
                  }}
                  className="search-input"
                />
                {regionLoading && regionSearch.length >= 3 && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
                  </div>
                )}

                {/* Region Dropdown */}
                {showRegionDropdown &&
                  regionsData?.regions?.items &&
                  regionsData.regions.items.length > 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto character-dropdown-scroll max-h-96">
                        {regionsData.regions.items.map((region: any) => {
                          const avgSec = region.securityStats?.avgSecurity ?? 0;
                          const securityColor =
                            avgSec >= 0.5
                              ? 'text-green-400'
                              : avgSec > 0
                                ? 'text-yellow-400'
                                : 'text-red-400';

                          return (
                            <button
                              key={region.id}
                              type="button"
                              onClick={() =>
                                handleRegionSelect(region.id, region.name)
                              }
                              className="menu-row group"
                            >
                              <div className="flex-auto min-w-0 text-left">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white truncate">
                                    {region.name}
                                  </span>
                                  <span
                                    className={`text-xs font-semibold ${securityColor}`}
                                  >
                                    {avgSec.toFixed(1)}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-400">
                                  {region.constellationCount} constellations ·{' '}
                                  {region.solarSystemCount} systems
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* No Results */}
                {showRegionDropdown &&
                  debouncedRegionSearch.length >= 3 &&
                  !regionLoading &&
                  regionsData?.regions?.items?.length === 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="p-4 text-sm text-gray-400">
                        No regions found for "{debouncedRegionSearch}"
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Region chip */}
            {regionId && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-medium text-gray-400">
                  Region
                </div>
                <span className="chip">
                  <span className="font-semibold truncate">
                    {regionName || `Region ${regionId}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRegionId(undefined);
                      setRegionName('');
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

          {/* Constellation Search */}
          <FilterField label="Constellation" htmlFor="filter-constellation">
            <div ref={constellationDropdownRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="filter-constellation"
                  placeholder="Search constellation (min 3 letters)..."
                  value={constellationSearch}
                  onChange={(e) => {
                    setConstellationSearch(e.target.value);
                    if (e.target.value.length >= 3)
                      setShowConstellationDropdown(true);
                    else setShowConstellationDropdown(false);
                  }}
                  onFocus={() => {
                    if (
                      constellationSearch.length >= 3 &&
                      constellationData?.constellations?.items &&
                      constellationData.constellations.items.length > 0
                    )
                      setShowConstellationDropdown(true);
                  }}
                  className="search-input"
                />
                {constellationLoading && constellationSearch.length >= 3 && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
                  </div>
                )}

                {/* Constellation Dropdown */}
                {showConstellationDropdown &&
                  constellationData?.constellations?.items &&
                  constellationData.constellations.items.length > 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto character-dropdown-scroll max-h-96">
                        {constellationData.constellations.items.map(
                          (constellation: any) => {
                            const avgSec =
                              constellation.securityStats?.avgSecurity ?? 0;
                            const securityColor =
                              avgSec >= 0.5
                                ? 'text-green-400'
                                : avgSec > 0
                                  ? 'text-yellow-400'
                                  : 'text-red-400';

                            return (
                              <button
                                key={constellation.id}
                                type="button"
                                onClick={() =>
                                  handleConstellationSelect(
                                    constellation.id,
                                    constellation.name,
                                  )
                                }
                                className="menu-row group"
                              >
                                <div className="flex-auto min-w-0 text-left">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white truncate">
                                      {constellation.name}
                                    </span>
                                    <span
                                      className={`text-xs font-semibold ${securityColor}`}
                                    >
                                      {avgSec.toFixed(1)}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {constellation.region?.name && (
                                      <div className="text-gray-400 truncate">
                                        {constellation.region.name} ·{' '}
                                        {constellation.solarSystemCount} systems
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}

                {/* No Results */}
                {showConstellationDropdown &&
                  debouncedConstellationSearch.length >= 3 &&
                  !constellationLoading &&
                  constellationData?.constellations?.items?.length === 0 && (
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                      <div className="p-4 text-sm text-gray-400">
                        No constellations found for "
                        {debouncedConstellationSearch}"
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Constellation chip */}
            {constellationId && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-medium text-gray-400">
                  Constellation
                </div>
                <span className="chip">
                  <span className="font-semibold truncate">
                    {constellationName || `Constellation ${constellationId}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      console.log(
                        '🔍 Constellation chip remove clicked, current state:',
                        {
                          constellationId,
                          constellationName,
                          systemId,
                          solarSystemName,
                        },
                      );
                      setConstellationId(undefined);
                      setConstellationName('');
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

          {/* Min Attackers */}
          <FilterField label="Min Attackers" htmlFor="filter-min-attackers">
            <input
              type="number"
              id="filter-min-attackers"
              placeholder="Min attackers..."
              value={minAttackers}
              onChange={(e) => setMinAttackers(e.target.value)}
              className="input"
              min="1"
            />
          </FilterField>

          {/* Max Attackers */}
          <FilterField label="Max Attackers" htmlFor="filter-max-attackers">
            <input
              type="number"
              id="filter-max-attackers"
              placeholder="Max attackers..."
              value={maxAttackers}
              onChange={(e) => setMaxAttackers(e.target.value)}
              className="input"
              min="1"
            />
          </FilterField>

          {/* Min Value */}
          <FilterField label="Min Value (ISK)" htmlFor="filter-min-value">
            <input
              type="number"
              id="filter-min-value"
              placeholder="Min ISK value..."
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="input"
              min="0"
              step="1000000"
            />
          </FilterField>

          {/* Max Value */}
          <FilterField label="Max Value (ISK)" htmlFor="filter-max-value">
            <input
              type="number"
              id="filter-max-value"
              placeholder="Max ISK value..."
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              className="input"
              min="0"
              step="1000000"
            />
          </FilterField>

          {/* Security Space - Always visible */}
          <FilterField label="Security Space">
            <RadioGroup
              name="security-space"
              value={securitySpace}
              onChange={setSecuritySpace}
              options={[
                { value: 'all', label: 'All' },
                { value: 'highsec', label: 'HighSec' },
                { value: 'lowsec', label: 'LowSec' },
                { value: 'nullsec', label: 'NullSec' },
                { value: 'wormhole', label: 'Wormhole' },
                { value: 'abyssal', label: 'Abyssal' },
              ]}
            />
          </FilterField>

          {/* Sovereignty war kills */}
          <FilterField label="Sovereignty">
            <RadioGroup
              name="war-related"
              value={warRelated ? 'war' : 'all'}
              onChange={(v) => setWarRelated(v === 'war')}
              options={[
                { value: 'all', label: 'All Kills' },
                { value: 'war', label: 'War Kills Only' },
              ]}
            />
          </FilterField>
        </div>
      </FilterDialog>
    </form>
  );
}
