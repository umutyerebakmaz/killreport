"use client";

import {
  ChevronDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

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
  orderBy = "nameAsc",
  onOrderByChange,
}: CharacterFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [corporationId, setCorporationId] = useState("");
  const [allianceId, setAllianceId] = useState("");

  const hasActiveFilters = search || name || corporationId || allianceId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: search || undefined,
      name: name || undefined,
      corporation_id: corporationId ? Number(corporationId) : undefined,
      alliance_id: allianceId ? Number(allianceId) : undefined,
    });
  };

  const handleClearAll = () => {
    setSearch("");
    setName("");
    setCorporationId("");
    setAllianceId("");
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
            placeholder="Search characters..."
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
              {[name, corporationId, allianceId].filter(Boolean).length}
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
            <option value="securityStatusDesc" className="option">
              {orderBy === "securityStatusDesc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Highest Security
            </option>
            <option value="securityStatusAsc" className="option">
              {orderBy === "securityStatusAsc" ? "✓" : "\u00A0\u00A0"}
              {"   "}
              Lowest Security
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Name Filter */}
            <div>
              <label
                htmlFor="filter-name"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Name
              </label>
              <input
                type="text"
                id="filter-name"
                placeholder="Character name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>

            {/* Corporation ID Filter */}
            <div>
              <label
                htmlFor="filter-corporation"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Corporation ID
              </label>
              <input
                type="number"
                id="filter-corporation"
                placeholder="Corporation ID..."
                value={corporationId}
                onChange={(e) => setCorporationId(e.target.value)}
                className="input"
              />
            </div>

            {/* Alliance ID Filter */}
            <div>
              <label
                htmlFor="filter-alliance"
                className="block mb-2 text-xs font-medium text-gray-400"
              >
                Alliance ID
              </label>
              <input
                type="number"
                id="filter-alliance"
                placeholder="Alliance ID..."
                value={allianceId}
                onChange={(e) => setAllianceId(e.target.value)}
                className="input"
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
