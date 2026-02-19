"use client";

import RadioGroup from "@/components/RadioGroup/RadioGroup";
import {
  useSearchCharacterQuery,
  useSearchCharactersQuery,
  useSearchTypeQuery,
  useSearchTypesQuery,
} from "@/generated/graphql";
import { useDebounce } from "@/hooks/useDebounce";
import {
  ChevronDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

interface KillmailFiltersProps {
  onFilterChange: (filters: {
    shipTypeId?: number;
    characterId?: number;
    victim?: boolean;
    attacker?: boolean;
    minAttackers?: number;
    maxAttackers?: number;
    minValue?: number;
    maxValue?: number;
  }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
  initialShipTypeId?: number;
  initialCharacterId?: number;
  initialMinAttackers?: number;
  initialMaxAttackers?: number;
  initialMinValue?: number;
  initialMaxValue?: number;
  initialRole?: "all" | "victim" | "attacker";
}

export default function KillmailFilters({
  onFilterChange,
  onClearFilters,
  orderBy = "timeDesc",
  onOrderByChange,
  initialShipTypeId,
  initialCharacterId,
  initialMinAttackers,
  initialMaxAttackers,
  initialMinValue,
  initialMaxValue,
  initialRole = "all",
}: KillmailFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [shipTypeId, setShipTypeId] = useState<number | undefined>(
    initialShipTypeId,
  );
  const [shipTypeName, setShipTypeName] = useState("");
  const [minAttackers, setMinAttackers] = useState(
    initialMinAttackers ? String(initialMinAttackers) : "",
  );
  const [maxAttackers, setMaxAttackers] = useState(
    initialMaxAttackers ? String(initialMaxAttackers) : "",
  );
  const [minValue, setMinValue] = useState(
    initialMinValue ? String(initialMinValue) : "",
  );
  const [maxValue, setMaxValue] = useState(
    initialMaxValue ? String(initialMaxValue) : "",
  );
  const [role, setRole] = useState<"all" | "victim" | "attacker">(initialRole);

  // Pilot search state
  const [pilotSearch, setPilotSearch] = useState("");
  const [characterId, setCharacterId] = useState<number | undefined>(
    initialCharacterId,
  );
  const [characterName, setCharacterName] = useState("");
  const [showPilotDropdown, setShowPilotDropdown] = useState(false);
  const pilotDropdownRef = useRef<HTMLDivElement>(null);

  // Ship search dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const shipDropdownRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  const debouncedSearch = useDebounce(typeSearch, 500);
  const debouncedPilotSearch = useDebounce(pilotSearch, 500);

  // GraphQL query for ship type search
  const { data: typeData, loading: typeLoading } = useSearchTypesQuery({
    variables: {
      name: debouncedSearch,
      limit: 20,
    },
    skip: debouncedSearch.length < 3,
  });

  // Fetch initial character name from URL param
  const { data: initialCharacterData } = useSearchCharacterQuery({
    variables: { id: initialCharacterId! },
    skip: !initialCharacterId || !!characterName,
  });

  // Fetch initial ship type name from URL param
  const { data: initialTypeData } = useSearchTypeQuery({
    variables: { id: initialShipTypeId! },
    skip: !initialShipTypeId || !!shipTypeName,
  });

  // Populate character name from initial fetch
  useEffect(() => {
    if (initialCharacterData?.character?.name && !characterName) {
      setCharacterName(initialCharacterData.character.name);
    }
  }, [initialCharacterData, characterName]);

  // Populate ship type name from initial fetch
  useEffect(() => {
    if (initialTypeData?.type?.name && !shipTypeName) {
      setShipTypeName(initialTypeData.type.name);
    }
  }, [initialTypeData, shipTypeName]);

  // GraphQL query for pilot search
  const { data: pilotData, loading: pilotLoading } = useSearchCharactersQuery({
    variables: {
      search: debouncedPilotSearch,
      limit: 20,
    },
    skip: debouncedPilotSearch.length < 3,
  });

  const hasActiveFilters =
    shipTypeId ||
    characterId ||
    minAttackers ||
    maxAttackers ||
    minValue ||
    maxValue ||
    (shipTypeId && role !== "all");

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
        pilotDropdownRef.current &&
        !pilotDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPilotDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync state when initial props change (e.g., when URL changes)
  useEffect(() => {
    if (initialShipTypeId !== undefined) setShipTypeId(initialShipTypeId);
  }, [initialShipTypeId]);

  useEffect(() => {
    if (initialCharacterId !== undefined) setCharacterId(initialCharacterId);
  }, [initialCharacterId]);

  useEffect(() => {
    setMinAttackers(initialMinAttackers ? String(initialMinAttackers) : "");
  }, [initialMinAttackers]);

  useEffect(() => {
    setMaxAttackers(initialMaxAttackers ? String(initialMaxAttackers) : "");
  }, [initialMaxAttackers]);

  useEffect(() => {
    setMinValue(initialMinValue ? String(initialMinValue) : "");
  }, [initialMinValue]);

  useEffect(() => {
    setMaxValue(initialMaxValue ? String(initialMaxValue) : "");
  }, [initialMaxValue]);

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

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
      debouncedPilotSearch.length >= 3 &&
      pilotData?.characters?.items &&
      pilotData.characters.items.length > 0
    ) {
      setShowPilotDropdown(true);
    }
  }, [debouncedPilotSearch, pilotData]);

  const handleShipSelect = (typeId: number, typeName: string) => {
    // Store both ID and name
    setShipTypeId(typeId);
    setShipTypeName(typeName);
    setTypeSearch(""); // Clear arama inputunu
    setShowDropdown(false);
    // Filter will be applied when user clicks "Apply Filters" button
  };

  const handlePilotSelect = (id: number, name: string) => {
    setCharacterId(id);
    setCharacterName(name);
    setPilotSearch("");
    setShowPilotDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      shipTypeId,
      characterId,
      victim:
        shipTypeId || characterId
          ? role === "victim"
            ? true
            : role === "attacker"
              ? false
              : undefined
          : undefined,
      attacker:
        shipTypeId || characterId
          ? role === "attacker"
            ? true
            : role === "victim"
              ? false
              : undefined
          : undefined,
      minAttackers: minAttackers ? Number(minAttackers) : undefined,
      maxAttackers: maxAttackers ? Number(maxAttackers) : undefined,
      minValue: minValue ? Number(minValue) : undefined,
      maxValue: maxValue ? Number(maxValue) : undefined,
    });
  };

  const handleClearAll = () => {
    setTypeSearch("");
    setShipTypeId(undefined);
    setShipTypeName("");
    setPilotSearch("");
    setCharacterId(undefined);
    setCharacterName("");
    setMinAttackers("");
    setMaxAttackers("");
    setMinValue("");
    setMaxValue("");
    setRole("all");
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      {/* Top Bar: Filters, Clear, OrderBy */}
      <div className="flex items-center justify-end gap-3">
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
              {
                [
                  shipTypeId,
                  characterId,
                  minAttackers,
                  maxAttackers,
                  minValue,
                  maxValue,
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

          <div className="flex gap-6">
            {/* LEFT: Inputs */}
            <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
              {/* Pilot Search */}
              <div>
                <label
                  htmlFor="filter-pilot"
                  className="block mb-2 text-xs font-medium text-gray-400"
                >
                  Pilot
                </label>
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
                        if (e.target.value.length >= 3)
                          setShowPilotDropdown(true);
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
                                    handlePilotSelect(
                                      character.id,
                                      character.name,
                                    )
                                  }
                                  className="relative flex items-center w-full p-3 group gap-x-3 text-sm/6 hover:bg-cyan-900/50"
                                >
                                  <div className="flex items-center justify-center flex-none size-16 bg-gray-700/50 group-hover:bg-gray-700">
                                    <img
                                      src={avatarUrl}
                                      alt={character.name}
                                      className="object-cover size-16"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src =
                                          "/images/default-avatar.png";
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
              </div>

              {/* Ship Search */}
              <div>
                <label
                  htmlFor="filter-ship"
                  className="block mb-2 text-xs font-medium text-gray-400"
                >
                  Ship
                </label>
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
                                onClick={() =>
                                  handleShipSelect(type.id, type.name)
                                }
                                className="relative flex items-center w-full p-3 group gap-x-3 text-sm/6 hover:bg-cyan-900/50"
                              >
                                <div className="flex items-center justify-center flex-none size-16 bg-gray-700/50 group-hover:bg-gray-700">
                                  <img
                                    src={`https://images.evetech.net/types/${type.id}/icon?size=64`}
                                    alt={type.name}
                                    className="object-cover size-16"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        "/images/default-ship.png";
                                    }}
                                  />
                                </div>
                                <div className="flex-auto min-w-0 text-left">
                                  <div className="font-semibold text-white truncate">
                                    {type.name}
                                  </div>
                                  <div className="text-sm text-gray-400 truncate">
                                    {type.group?.name || "Unknown Group"}
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
              </div>

              {/* Min Attackers */}
              <div>
                <label
                  htmlFor="filter-min-attackers"
                  className="block mb-2 text-xs font-medium text-gray-400"
                >
                  Min Attackers
                </label>
                <input
                  type="number"
                  id="filter-min-attackers"
                  placeholder="Min attackers..."
                  value={minAttackers}
                  onChange={(e) => setMinAttackers(e.target.value)}
                  className="input"
                  min="1"
                />
              </div>

              {/* Max Attackers */}
              <div>
                <label
                  htmlFor="filter-max-attackers"
                  className="block mb-2 text-xs font-medium text-gray-400"
                >
                  Max Attackers
                </label>
                <input
                  type="number"
                  id="filter-max-attackers"
                  placeholder="Max attackers..."
                  value={maxAttackers}
                  onChange={(e) => setMaxAttackers(e.target.value)}
                  className="input"
                  min="1"
                />
              </div>

              {/* Min Value */}
              <div>
                <label
                  htmlFor="filter-min-value"
                  className="block mb-2 text-xs font-medium text-gray-400"
                >
                  Min Value (ISK)
                </label>
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
              </div>

              {/* Max Value */}
              <div>
                <label
                  htmlFor="filter-max-value"
                  className="block mb-2 text-xs font-medium text-gray-400"
                >
                  Max Value (ISK)
                </label>
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
              </div>
            </div>

            {/* RIGHT: Chips + Role */}
            {(characterId || shipTypeId) && (
              <div className="flex flex-col gap-3 min-w-48">
                <p className="text-xs font-medium text-gray-400">Selected</p>
                {characterId && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center flex-1 gap-2 px-3 py-2 text-sm text-white bg-gray-700/50">
                      <img
                        src={`https://images.evetech.net/characters/${characterId}/portrait?size=64`}
                        alt={characterName}
                        className="object-cover size-8"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/images/default-avatar.png";
                        }}
                      />
                      <span className="font-semibold truncate">
                        {characterName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCharacterId(undefined);
                        setCharacterName("");
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {shipTypeId && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center flex-1 gap-2 px-3 py-2 text-sm text-white bg-gray-700/50">
                      <img
                        src={`https://images.evetech.net/types/${shipTypeId}/icon?size=64`}
                        alt={shipTypeName}
                        className="object-cover size-8"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/images/default-ship.png";
                        }}
                      />
                      <span className="font-semibold truncate">
                        {shipTypeName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShipTypeId(undefined);
                        setShipTypeName("");
                        setRole("all");
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <RadioGroup
                  name="ship-type-role"
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: "all", label: "All" },
                    { value: "victim", label: "Victim" },
                    { value: "attacker", label: "Attacker" },
                  ]}
                />
              </div>
            )}
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
