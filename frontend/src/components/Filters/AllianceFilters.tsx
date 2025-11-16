"use client";

import {
  ChevronDownIcon,
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
    dateFoundedFrom?: string;
    dateFoundedTo?: string;
  }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function AllianceFilters({
  onFilterChange,
  onClearFilters,
  orderBy = "memberCountDesc",
  onOrderByChange,
}: AllianceFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [dateFoundedFrom, setDateFoundedFrom] = useState("");
  const [dateFoundedTo, setDateFoundedTo] = useState("");

  const hasActiveFilters =
    search || name || ticker || dateFoundedFrom || dateFoundedTo;

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
      {/* Search Bar and OrderBy */}
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
        <button
          type="submit"
          className="inline-flex items-center gap-x-1.5 px-4 py-2 text-sm font-medium text-gray-300 transition-all duration-200 border cursor-pointer bg-gray-900/50 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-600"
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
          Search
        </button>

        {/* Advanced Filters Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-x-1.5 px-4 py-2 text-sm font-medium transition-all duration-200 border cursor-pointer ${
            hasActiveFilters
              ? "bg-indigo-600/80 border-indigo-500/50 text-white hover:bg-indigo-600 hover:border-indigo-500"
              : "bg-gray-900/50 border-gray-700/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600 hover:text-white"
          } focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-600`}
        >
          <FunnelIcon className="w-5 h-5" />
          Filters
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold text-indigo-600 bg-white rounded-full">
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
            className="inline-flex items-center gap-x-1.5 bg-red-600/20 border border-red-500/30 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-600/30 transition-colors cursor-pointer"
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
            <option value="memberCountDesc" className="option">
              {orderBy === "memberCountDesc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Most Members
            </option>
            <option value="memberCountAsc" className="option">
              {orderBy === "memberCountAsc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Least Members
            </option>
            <option value="nameAsc" className="option">
              {orderBy === "nameAsc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Name A-Z
            </option>
            <option value="nameDesc" className="option">
              {orderBy === "nameDesc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Name Z-A
            </option>
          </select>
          <ChevronDownIcon className="chevron-down-icon" />
        </div>
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

            {/* Date Founded From Filter */}
            <div>
              <label
                htmlFor="date-founded-from-filter"
                className="block mb-2 text-sm font-medium text-gray-300"
              >
                Founded From (yyyy-mm-dd)
              </label>
              <input
                type="date"
                id="date-founded-from-filter"
                value={dateFoundedFrom}
                onChange={(e) => setDateFoundedFrom(e.target.value)}
                placeholder="yyyy-mm-dd"
                className="block w-full px-3 py-2 text-white border-0 bg-white/5 placeholder:text-gray-400 focus:bg-white/10 focus:outline-none sm:text-sm sm:leading-6 scheme-dark"
              />
            </div>

            {/* Date Founded To Filter */}
            <div>
              <label
                htmlFor="date-founded-to-filter"
                className="block mb-2 text-sm font-medium text-gray-300"
              >
                Founded To (yyyy-mm-dd)
              </label>
              <input
                type="date"
                id="date-founded-to-filter"
                value={dateFoundedTo}
                onChange={(e) => setDateFoundedTo(e.target.value)}
                placeholder="yyyy-mm-dd"
                className="block w-full px-3 py-2 text-white border-0 bg-white/5 placeholder:text-gray-400 focus:bg-white/10 focus:outline-none sm:text-sm sm:leading-6 scheme-dark"
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
