"use client";

import {
  ChevronDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

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
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search corporations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
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

        {/* Order By Selector */}
        <div className="relative group">
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
          <ChevronDownIcon className="absolute w-5 h-5 text-gray-400 transition-transform duration-200 pointer-events-none right-3 top-2.5 group-hover:text-gray-300" />
        </div>

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
                Corporation Name
              </label>
              <input
                type="text"
                id="name-filter"
                placeholder="e.g., Pandemic Horde"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>

            {/* Ticker Filter */}
            <div>
              <label
                htmlFor="ticker-filter"
                className="block mb-2 text-sm font-medium text-gray-300"
              >
                Corporation Ticker
              </label>
              <input
                type="text"
                id="ticker-filter"
                placeholder="e.g., HORDE"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="input"
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
                className="input scheme-dark"
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
                className="input scheme-dark"
              />
            </div>
          </div>

          {/* Apply Button in Advanced Filters */}
          <div className="flex gap-3 mt-4">
            <button type="submit" className="apply-filter-button">
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
