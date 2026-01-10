"use client";

import { useSearchCorporationsQuery } from "@/generated/graphql";
import { useDebounce } from "@/hooks/useDebounce";
import {
  ChevronDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface CorporationFiltersProps {
  onFilterChange: (filters: {
    search?: string;
    name?: string;
    ticker?: string;
    dateFoundedFrom?: string;
    dateFoundedTo?: string;
  }) => void;
  onClearFilters: () => void;
  orderBy: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function CorporationFilters({
  onFilterChange,
  onClearFilters,
  orderBy,
  onOrderByChange,
}: CorporationFiltersProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [dateFoundedFrom, setDateFoundedFrom] = useState("");
  const [dateFoundedTo, setDateFoundedTo] = useState("");

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

  const hasActiveFilters =
    search || name || ticker || dateFoundedFrom || dateFoundedTo;

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
      searchData?.corporations?.edges &&
      searchData.corporations.edges.length > 0
    ) {
      setShowDropdown(true);
    }
  }, [debouncedSearch, searchData]);

  const handleCorporationSelect = (corporationId: number) => {
    router.push(`/corporations/${corporationId}`);
    setSearch("");
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: search || undefined,
      name: name || undefined,
      ticker: ticker || undefined,
      dateFoundedFrom: dateFoundedFrom || undefined,
      dateFoundedTo: dateFoundedTo || undefined,
    });
  };

  const handleClearAll = () => {
    setSearch("");
    setName("");
    setTicker("");
    setDateFoundedFrom("");
    setDateFoundedTo("");
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1" ref={dropdownRef}>
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search corporations (min 3 letters)..."
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
                searchData?.corporations?.edges &&
                searchData.corporations.edges.length > 0
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
            searchData?.corporations?.edges &&
            searchData.corporations.edges.length > 0 && (
              <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                <div className="grid grid-cols-1 gap-1 p-1 overflow-y-auto md:grid-cols-2 character-dropdown-scroll max-h-96">
                  {searchData.corporations.edges.map((edge) => {
                    const corporation = edge.node;
                    const logoUrl = `https://images.evetech.net/corporations/${corporation.id}/logo?size=128`;

                    return (
                      <button
                        key={corporation.id}
                        type="button"
                        onClick={() => handleCorporationSelect(corporation.id)}
                        className="relative flex items-center w-full p-3 group gap-x-3 text-sm/6 hover:bg-cyan-900/50"
                      >
                        <div className="flex items-center justify-center flex-none size-16 bg-gray-700/50 group-hover:bg-gray-700">
                          <img
                            src={logoUrl}
                            alt={corporation.name}
                            className="object-cover size-16"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/images/default-corporation.png";
                            }}
                          />
                        </div>
                        <div className="flex-auto min-w-0 text-left">
                          <div className="font-semibold text-white truncate">
                            {corporation.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            <div className="text-gray-400 truncate">
                              [{corporation.ticker}] •{" "}
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
            searchData?.corporations?.edges?.length === 0 && (
              <div className="absolute z-50 w-full mt-3 overflow-hidden transition bg-stone-900 outline-1 -outline-offset-1 outline-white/10">
                <div className="p-4 text-sm text-gray-400">
                  No corporations found for "{debouncedSearch}"
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
              {
                [name, ticker, dateFoundedFrom, dateFoundedTo].filter(Boolean)
                  .length
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
            <option value="memberCountDesc">
              {orderBy === "memberCountDesc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Most Members
            </option>
            <option value="memberCountAsc">
              {orderBy === "memberCountAsc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Least Members
            </option>
            <option value="nameAsc">
              {orderBy === "nameAsc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Name (A to Z)
            </option>
            <option value="nameDesc">
              {orderBy === "nameDesc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Name (Z to A)
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Name Filter */}
            <div>
              <label
                htmlFor="filter-name"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Corporation Name
              </label>
              <input
                type="text"
                id="filter-name"
                placeholder="Corporation name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>

            {/* Ticker Filter */}
            <div>
              <label
                htmlFor="filter-ticker"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Corporation Ticker
              </label>
              <input
                type="text"
                id="filter-ticker"
                placeholder="Ticker..."
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="input"
              />
            </div>

            {/* Date Founded From Filter */}
            <div>
              <label
                htmlFor="filter-date-from"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Founded From
              </label>
              <input
                type="date"
                id="filter-date-from"
                value={dateFoundedFrom}
                onChange={(e) => setDateFoundedFrom(e.target.value)}
                className="input scheme-dark"
              />
            </div>

            {/* Date Founded To Filter */}
            <div>
              <label
                htmlFor="filter-date-to"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Founded To
              </label>
              <input
                type="date"
                id="filter-date-to"
                value={dateFoundedTo}
                onChange={(e) => setDateFoundedTo(e.target.value)}
                className="input scheme-dark"
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
