"use client";

import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

interface RegionFiltersProps {
  onFilterChange: (filters: { search?: string; name?: string }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function RegionFilters({
  onFilterChange,
  onClearFilters,
  orderBy = "nameAsc",
  onOrderByChange,
}: RegionFiltersProps) {
  const [search, setSearch] = useState("");

  const hasActiveFilters = !!search;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: search || undefined,
    });
  };

  const handleClearAll = () => {
    setSearch("");
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
            placeholder="Search regions..."
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
    </form>
  );
}
