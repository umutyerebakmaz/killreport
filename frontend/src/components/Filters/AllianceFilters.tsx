"use client";

import {
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

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

  const hasActiveFilters = search || name || ticker;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: search || undefined,
      name: name || undefined,
      ticker: ticker || undefined,
    });
  };

  const handleClearAll = () => {
    setSearch("");
    setName("");
    setTicker("");
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
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
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full border-0 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder:text-gray-400 focus:bg-white/10 focus:outline-none sm:text-sm sm:leading-6"
          />
        </div>

        {/* Search Button */}
        <button type="submit" className="secondary-button-xl">
          <MagnifyingGlassIcon className="w-5 h-5" />
          Search
        </button>

        {/* Advanced Filters Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-x-1.5 px-3.5 py-2.5 text-sm font-semibold text-white ring-1 ring-inset transition-colors cursor-pointer ${
            hasActiveFilters
              ? "bg-indigo-600 ring-indigo-500/50 hover:bg-indigo-500"
              : "bg-white/10 ring-white/5 hover:bg-white/20"
          }`}
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
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-x-1.5 bg-red-600/20 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-600/30 transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
            Clear
          </button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      <div
        className={`mt-4 overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 border bg-white/5 border-white/10">
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
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-3 py-2 text-white border-0 bg-white/5 placeholder:text-gray-400 focus:bg-white/10 focus:outline-none sm:text-sm sm:leading-6"
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
                onChange={(e) => setTicker(e.target.value)}
                className="block w-full px-3 py-2 text-white border-0 bg-white/5 placeholder:text-gray-400 focus:bg-white/10 focus:outline-none sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Apply Button in Advanced Filters */}
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="flex-1 inline-flex justify-center items-center gap-x-1.5 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors cursor-pointer"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              Apply Filters
            </button>
          </div>

          {/* Filter Info */}
          <div className="mt-4 text-xs text-gray-400">
            <p>
              💡 Tip: Use the search bar for quick lookups, or use advanced
              filters for more specific searches.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
