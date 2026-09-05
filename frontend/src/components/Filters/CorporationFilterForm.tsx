'use client';

import { useSearchCorporationsQuery } from '@/generated/graphql';
import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import { useDebounce } from '@/hooks/useDebounce';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface CorporationFilterFormProps {
  onFilterChange: (filters: {
    name?: string;
    ticker?: string;
    dateFoundedFrom?: string;
    dateFoundedTo?: string;
  }) => void;
  onClearFilters: () => void;
  orderBy: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function CorporationFilterForm({
  onFilterChange,
  onClearFilters,
  orderBy,
  onOrderByChange,
}: CorporationFilterFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [dateFoundedFrom, setDateFoundedFrom] = useState('');
  const [dateFoundedTo, setDateFoundedTo] = useState('');

  // Corporation search dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  const debouncedSearch = useDebounce(search, 500);

  // GraphQL query for corporation search
  const { data: searchData, loading: searchLoading } =
    useSearchCorporationsQuery({
      variables: {
        search: debouncedSearch,
        limit: 20,
      },
      skip: debouncedSearch.length < 3, // Only search after 3 characters
    });

  const activeFilterCount = [
    name,
    ticker,
    dateFoundedFrom,
    dateFoundedTo,
  ].filter(Boolean).length;
  const hasActiveFilters = Boolean(
    name || ticker || dateFoundedFrom || dateFoundedTo,
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
      searchData?.corporations?.items &&
      searchData.corporations.items.length > 0
    ) {
      setShowDropdown(true);
    }
  }, [debouncedSearch, searchData]);

  const handleCorporationSelect = (corporationId: number) => {
    router.push(`/corporations/${corporationId}`);
    setSearch('');
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      name: name || undefined,
      ticker: ticker || undefined,
      dateFoundedFrom: dateFoundedFrom || undefined,
      dateFoundedTo: dateFoundedTo || undefined,
    });
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setSearch('');
    setName('');
    setTicker('');
    setDateFoundedFrom('');
    setDateFoundedTo('');
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} id="corporation-filters" className="mb-6">
      <FilterBar
        search={
          <div className="relative flex-1" ref={dropdownRef}>
            <input
              type="text"
              id="filter-corporation-search"
              aria-label="Go to corporation"
              aria-describedby="filter-corporation-search-hint"
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
                  searchData?.corporations?.items &&
                  searchData.corporations.items.length > 0
                ) {
                  setShowDropdown(true);
                }
              }}
              className="input"
            />
            <p
              id="filter-corporation-search-hint"
              className="mt-1 text-[11px] text-gray-500"
            >
              Type at least 3 letters to find a corporation.
            </p>
            {searchLoading && search.length >= 3 && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <div className="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
              </div>
            )}

            {/* Dropdown Results */}
            {showDropdown &&
              searchData?.corporations?.items &&
              searchData.corporations.items.length > 0 && (
                <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                  <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 character-dropdown-scroll max-h-96">
                    {searchData.corporations.items.map((corporation) => {
                      const logoUrl = `https://images.evetech.net/corporations/${corporation.id}/logo?size=128`;

                      return (
                        <button
                          key={corporation.id}
                          type="button"
                          onClick={() =>
                            handleCorporationSelect(corporation.id)
                          }
                          className="menu-row group"
                        >
                          <div className="flex items-center justify-center flex-none size-16 bg-gray-700/50 group-hover:bg-gray-700">
                            <img
                              src={logoUrl}
                              alt={corporation.name}
                              className="object-cover size-16"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/images/default-corporation.png';
                              }}
                            />
                          </div>
                          <div className="flex-auto min-w-0 text-left">
                            <div className="font-semibold text-white truncate">
                              {corporation.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              <div className="text-gray-400 truncate">
                                [{corporation.ticker}] •{' '}
                                {corporation.member_count} members
                              </div>
                              {corporation.alliance?.name && (
                                <div className="text-gray-400 truncate">
                                  {corporation.alliance.name}
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
              searchData?.corporations?.items?.length === 0 && (
                <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                  <div className="p-4 text-sm text-gray-400">
                    No corporations found for "{debouncedSearch}"
                  </div>
                </div>
              )}
          </div>
        }
        orderBy={
          <div className="select-option-container">
            <select
              value={orderBy}
              onChange={(e) => onOrderByChange(e.target.value)}
              className="select"
            >
              <option value="memberCountDesc">
                {orderBy === 'memberCountDesc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Most Members
              </option>
              <option value="memberCountAsc">
                {orderBy === 'memberCountAsc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Least Members
              </option>
              <option value="nameAsc">
                {orderBy === 'nameAsc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Name (A to Z)
              </option>
              <option value="nameDesc">
                {orderBy === 'nameDesc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Name (Z to A)
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
              form="corporation-filters"
              className="button button-secondary"
            >
              APPLY
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Name Filter */}
          <FilterField label="Corporation Name" htmlFor="filter-name">
            <input
              type="text"
              id="filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </FilterField>

          {/* Ticker Filter */}
          <FilterField label="Corporation Ticker" htmlFor="filter-ticker">
            <input
              type="text"
              id="filter-ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="input"
            />
          </FilterField>

          {/* Date Founded From Filter */}
          <FilterField label="Founded From" htmlFor="filter-date-from">
            <input
              type="date"
              id="filter-date-from"
              value={dateFoundedFrom}
              onChange={(e) => setDateFoundedFrom(e.target.value)}
              className="input scheme-dark"
            />
          </FilterField>

          {/* Date Founded To Filter */}
          <FilterField label="Founded To" htmlFor="filter-date-to">
            <input
              type="date"
              id="filter-date-to"
              value={dateFoundedTo}
              onChange={(e) => setDateFoundedTo(e.target.value)}
              className="input scheme-dark"
            />
          </FilterField>
        </div>
      </FilterDialog>
    </form>
  );
}
