'use client';

import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import { useSearchCharactersQuery } from '@/generated/graphql';
import { useDebounce } from '@/hooks/useDebounce';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

import EveImage from '@/components/ui/EveImage';
import Select from '@/components/ui/Select';

const ORDER_BY_OPTIONS = [
  { value: 'nameAsc', label: 'Name A-Z' },
  { value: 'nameDesc', label: 'Name Z-A' },
  { value: 'securityStatusDesc', label: 'Highest Security' },
  { value: 'securityStatusAsc', label: 'Lowest Security' },
];

interface CharacterFilterFormProps {
  onFilterChange: (filters: { id?: number }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function CharacterFilterForm({
  onFilterChange,
  onClearFilters,
  orderBy = 'nameAsc',
  onOrderByChange,
}: CharacterFilterFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Pilot search state
  const [pilotSearch, setPilotSearch] = useState('');
  const [characterId, setCharacterId] = useState<number | undefined>();
  const [characterName, setCharacterName] = useState('');
  const [showPilotDropdown, setShowPilotDropdown] = useState(false);
  const pilotDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedPilotSearch = useDebounce(pilotSearch, 500);

  // GraphQL query for pilot search
  const { data: pilotData, loading: pilotLoading } = useSearchCharactersQuery({
    variables: {
      search: debouncedPilotSearch,
      limit: 20,
    },
    skip: debouncedPilotSearch.length < 3,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pilotDropdownRef.current &&
        !pilotDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPilotDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePilotSelect = (id: number, name: string) => {
    setCharacterId(id);
    setCharacterName(name);
    setPilotSearch('');
    setShowPilotDropdown(false);
  };

  const activeFilterCount = characterId ? 1 : 0;
  const hasActiveFilters = Boolean(characterId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ id: characterId });
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setCharacterId(undefined);
    setCharacterName('');
    setPilotSearch('');
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} id="character-filters" className="mb-6">
      <FilterBar
        orderBy={
          <Select
            value={orderBy}
            onChange={onOrderByChange}
            options={ORDER_BY_OPTIONS}
            aria-label="Sort characters"
          />
        }
        onOpenFilters={() => setIsOpen(true)}
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
              type="submit"
              form="character-filters"
              className="button button-secondary"
            >
              APPLY
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Pilot Search */}
          <FilterField
            label="Pilot"
            htmlFor="filter-pilot"
            hint="Type at least 3 letters to search"
          >
            <div ref={pilotDropdownRef}>
              <div className="relative">
                <input
                  type="text"
                  id="filter-pilot"
                  aria-describedby="filter-pilot-hint"
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
                  className="input"
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
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition float">
                      <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 max-h-96">
                        {pilotData.characters.items.map((character) => {
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
                                <EveImage
                                  kind="character"
                                  id={character.id}
                                  name={character.name}
                                  size={64}
                                  className="object-cover size-16"
                                />
                              </div>
                              <div className="flex-auto min-w-0 text-left">
                                <div className="font-medium text-white truncate">
                                  {character.name}
                                </div>
                                <div className="text-sm text-ink-muted">
                                  {character.corporation?.name && (
                                    <div className="text-ink-muted truncate">
                                      {character.corporation.name}
                                    </div>
                                  )}
                                  {character.alliance?.name && (
                                    <div className="text-ink-muted truncate">
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
                    <div className="absolute z-50 w-full mt-3 overflow-hidden transition float">
                      <div className="p-4 text-sm text-ink-muted">
                        No pilots found for &quot;{debouncedPilotSearch}&quot;
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Character chip */}
            {characterId && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                <span className="chip">
                  <EveImage
                    kind="character"
                    id={characterId}
                    name={characterName}
                    size={32}
                    className="object-cover size-8"
                  />
                  <span className="font-medium truncate">{characterName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCharacterId(undefined);
                      setCharacterName('');
                    }}
                    className="button button-ghost p-1"
                    aria-label="Remove character filter"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </span>
              </div>
            )}
          </FilterField>
        </div>
      </FilterDialog>
    </form>
  );
}
