'use client';

import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface AllianceFilterFormProps {
  onFilterChange: (filters: {
    name?: string;
    ticker?: string;
    dateFoundedFrom?: string;
    dateFoundedTo?: string;
  }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function AllianceFilterForm({
  onFilterChange,
  onClearFilters,
  orderBy = 'memberCountDesc',
  onOrderByChange,
}: AllianceFilterFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [dateFoundedFrom, setDateFoundedFrom] = useState('');
  const [dateFoundedTo, setDateFoundedTo] = useState('');

  const activeFilterCount = [
    name,
    ticker,
    dateFoundedFrom,
    dateFoundedTo,
  ].filter(Boolean).length;
  const hasActiveFilters = Boolean(
    name || ticker || dateFoundedFrom || dateFoundedTo,
  );

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
    setName('');
    setTicker('');
    setDateFoundedFrom('');
    setDateFoundedTo('');
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} id="alliance-filters" className="mb-6">
      <FilterBar
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
                Name A-Z
              </option>
              <option value="nameDesc">
                {orderBy === 'nameDesc' ? '✓' : '\u00A0\u00A0'}
                {'   '}
                Name Z-A
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
              form="alliance-filters"
              className="button button-secondary"
            >
              APPLY
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Name Filter */}
          <FilterField label="Alliance Name" htmlFor="filter-name">
            <input
              type="text"
              id="filter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </FilterField>

          {/* Ticker Filter */}
          <FilterField label="Alliance Ticker" htmlFor="filter-ticker">
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
