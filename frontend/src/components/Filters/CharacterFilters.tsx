'use client';

import { useSearchCharactersQuery } from '@/generated/graphql';
import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import { useDebounce } from '@/hooks/useDebounce';
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface CharacterFiltersProps {
  onFilterChange: (filters: {
    search?: string;
    name?: string;
    corporation_id?: number;
    alliance_id?: number;
  }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function CharacterFilters({
  onFilterChange,
  onClearFilters,
  orderBy = 'nameAsc',
  onOrderByChange,
}: CharacterFiltersProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [corporationId, setCorporationId] = useState('');
  const [allianceId, setAllianceId] = useState('');

  // Character search dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  const debouncedSearch = useDebounce(search, 500);

  // GraphQL query for character search
  const { data: searchData, loading: searchLoading } = useSearchCharactersQuery(
    {
      variables: {
        search: debouncedSearch,
        limit: 20,
      },
      skip: debouncedSearch.length < 3, // Only search after 3 characters
    },
  );

  const activeFilterCount = [name, corporationId, allianceId].filter(
    Boolean,
  ).length;
  const hasActiveFilters = Boolean(
    search || name || corporationId || allianceId,
  );

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

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show dropdown when we have results
  useEffect(() => {
    if (
      debouncedSearch.length >= 3 &&
      searchData?.characters?.items &&
      searchData.characters.items.length > 0
    ) {
      setShowDropdown(true);
    }
  }, [debouncedSearch, searchData]);

  const handleCharacterSelect = (characterId: number) => {
    router.push(`/characters/${characterId}`);
    setSearch('');
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: search || undefined,
      name: name || undefined,
      corporation_id: corporationId ? Number(corporationId) : undefined,
      alliance_id: allianceId ? Number(allianceId) : undefined,
    });
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setSearch('');
    setName('');
    setCorporationId('');
    setAllianceId('');
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} id="character-filters" className="mb-6">
      <FilterBar
        search={
          <div className="relative flex-1" ref={dropdownRef}>
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search characters (min 3 letters)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value.length >= 3) {
                  setShowDropdown(true);
                } else {
                  setShowDropdown(false);
                }
              }}
              onFocus={() => {
                // Show dropdown if we have valid search results
                if (
                  search.length >= 3 &&
                  searchData?.characters?.items &&
                  searchData.characters.items.length > 0
                ) {
                  setShowDropdown(true);
                }
              }}
              className="search-input"
            />
            {searchLoading && search.length >= 3 && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
              </div>
            )}

            {/* Dropdown Results */}
            {showDropdown &&
              searchData?.characters?.items &&
              searchData.characters.items.length > 0 && (
                <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                  <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 character-dropdown-scroll max-h-96">
                    {searchData.characters.items.map((character) => {
                      const avatarUrl = `https://images.evetech.net/characters/${character.id}/portrait?size=128`;

                      return (
                        <button
                          key={character.id}
                          type="button"
                          onClick={() => handleCharacterSelect(character.id)}
                          className="menu-row group"
                        >
                          <div className="flex items-center justify-center flex-none size-16 bg-gray-700/50 group-hover:bg-gray-700">
                            <img
                              src={avatarUrl}
                              alt={character.name}
                              className="object-cover size-16"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/images/default-avatar.png';
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

            {/* No Results Message */}
            {showDropdown &&
              debouncedSearch.length >= 3 &&
              !searchLoading &&
              searchData?.characters?.items?.length === 0 && (
                <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                  <div className="p-4 text-sm text-gray-400">
                    No characters found for "{debouncedSearch}"
                  </div>
                </div>
              )}
          </div>
        }
        controls={
          <button type="submit" className="button button-secondary">
            <MagnifyingGlassIcon className="w-5 h-5" />
            Search
          </button>
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
              <option value="securityStatusDesc">
                {orderBy === 'securityStatusDesc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Highest Security
              </option>
              <option value="securityStatusAsc">
                {orderBy === 'securityStatusAsc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Lowest Security
              </option>
            </select>
            <ChevronDownIcon className="chevron-down-icon" />
          </div>
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
          <button
            type="submit"
            form="character-filters"
            className="button button-primary"
          >
            APPLY
          </button>
        }
      >
        <div className="space-y-4">
          {/* Name Filter */}
          <FilterField label="Name" htmlFor="filter-name">
            <input
              type="text"
              id="filter-name"
              placeholder="Character name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </FilterField>

          {/* Corporation ID Filter */}
          <FilterField label="Corporation ID" htmlFor="filter-corporation">
            <input
              type="number"
              id="filter-corporation"
              placeholder="Corporation ID..."
              value={corporationId}
              onChange={(e) => setCorporationId(e.target.value)}
              className="input"
            />
          </FilterField>

          {/* Alliance ID Filter */}
          <FilterField label="Alliance ID" htmlFor="filter-alliance">
            <input
              type="number"
              id="filter-alliance"
              placeholder="Alliance ID..."
              value={allianceId}
              onChange={(e) => setAllianceId(e.target.value)}
              className="input"
            />
          </FilterField>
        </div>
      </FilterDialog>
    </form>
  );
}
