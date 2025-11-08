"use client";

import {
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

interface AllianceFiltersProps {
  onFilterChange: (filters: {
    search?: string;
    name?: string;
    ticker?: string;
  }) => void;
  onClearFilters: () => void;
}

export default function AllianceFilters({
  onFilterChange,
  onClearFilters,
}: AllianceFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Debounce için timeout refs
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const nameTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const tickerTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const hasActiveFilters = search || name || ticker;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
      if (tickerTimeoutRef.current) clearTimeout(tickerTimeoutRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setIsTyping(true);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout (500ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      onFilterChange({ search: value || undefined, name, ticker });
      setIsTyping(false);
    }, 500);
  };
  const handleNameChange = (value: string) => {
    setName(value);
    setIsTyping(true);

    // Clear previous timeout
    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current);
    }

    // Set new timeout (500ms delay)
    nameTimeoutRef.current = setTimeout(() => {
      onFilterChange({ search, name: value || undefined, ticker });
      setIsTyping(false);
    }, 500);
  };

  const handleTickerChange = (value: string) => {
    setTicker(value);
    setIsTyping(true);

    // Clear previous timeout
    if (tickerTimeoutRef.current) {
      clearTimeout(tickerTimeoutRef.current);
    }

    // Set new timeout (500ms delay)
    tickerTimeoutRef.current = setTimeout(() => {
      onFilterChange({ search, name, ticker: value || undefined });
      setIsTyping(false);
    }, 500);
  };

  const handleClearAll = () => {
    setSearch("");
    setName("");
    setTicker("");
    setIsTyping(false);

    // Clear all pending timeouts
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    if (tickerTimeoutRef.current) clearTimeout(tickerTimeoutRef.current);

    onClearFilters();
  };

  return (
    <div className="mb-6">
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search alliances..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="block w-full rounded-lg border-0 bg-white/5 py-2.5 pl-10 pr-10 text-white placeholder:text-gray-400 focus:bg-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
          />
          {isTyping && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-x-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold shadow-sm ${
            hasActiveFilters
              ? "bg-indigo-600 text-white hover:bg-indigo-500"
              : "bg-white/10 text-white hover:bg-white/20"
          } transition-colors`}
        >
          <FunnelIcon className="w-5 h-5" />
          Filters
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold text-indigo-600 bg-white rounded-full">
              {[name, ticker].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-x-1.5 rounded-lg bg-red-600/20 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-600/30 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
            Clear
          </button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {isOpen && (
        <div className="p-4 mt-4 border rounded-lg bg-white/5 border-white/10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Name Filter */}
            <div>
              <label
                htmlFor="name-filter"
                className="block mb-2 text-sm font-medium text-gray-300"
              >
                Alliance Name
              </label>
              <input
                type="text"
                id="name-filter"
                placeholder="e.g., Goonswarm Federation"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="block w-full px-3 py-2 text-white border-0 rounded-lg bg-white/5 placeholder:text-gray-400 focus:bg-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              />
            </div>

            {/* Ticker Filter */}
            <div>
              <label
                htmlFor="ticker-filter"
                className="block mb-2 text-sm font-medium text-gray-300"
              >
                Alliance Ticker
              </label>
              <input
                type="text"
                id="ticker-filter"
                placeholder="e.g., CONDI"
                value={ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                className="block w-full px-3 py-2 text-white border-0 rounded-lg bg-white/5 placeholder:text-gray-400 focus:bg-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Filter Info */}
          <div className="mt-4 text-xs text-gray-400">
            <p>
              💡 Tip: Use the search bar for quick lookups, or use advanced
              filters for more specific searches.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
