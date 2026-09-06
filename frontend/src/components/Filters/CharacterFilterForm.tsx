'use client';

import FilterBar from '@/components/ui/FilterBar';
import FilterDialog from '@/components/ui/FilterDialog';
import FilterField from '@/components/ui/FilterField';
import { useState } from 'react';

import Select from '@/components/ui/Select';

const ORDER_BY_OPTIONS = [
  { value: 'nameAsc', label: 'Name A-Z' },
  { value: 'nameDesc', label: 'Name Z-A' },
  { value: 'securityStatusDesc', label: 'Highest Security' },
  { value: 'securityStatusAsc', label: 'Lowest Security' },
];

interface CharacterFilterFormProps {
  onFilterChange: (filters: {
    name?: string;
    corporation_id?: number;
    alliance_id?: number;
  }) => void;
  onClearFilters: () => void;
  orderBy?: string;
  onOrderByChange: (orderBy: string) => void;
}

export default function CharacterFilterForm({
  onFilterChange,
  onClearFilters,
  orderBy = 'nameAsc',
  onOrderByChange,
}: CharacterFilterFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [corporationId, setCorporationId] = useState('');
  const [allianceId, setAllianceId] = useState('');

  const activeFilterCount = [name, corporationId, allianceId].filter(
    Boolean,
  ).length;
  const hasActiveFilters = Boolean(name || corporationId || allianceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      name: name || undefined,
      corporation_id: corporationId ? Number(corporationId) : undefined,
      alliance_id: allianceId ? Number(allianceId) : undefined,
    });
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setName('');
    setCorporationId('');
    setAllianceId('');
    onClearFilters();
  };

  return (
    <form onSubmit={handleSubmit} id="character-filters" className="mb-6">
      <FilterBar
        orderBy={
          <Select
            value={orderBy}
            onChange={onOrderByChange}
            options={ORDER_BY_OPTIONS}
            aria-label="Sort characters"
          />
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
              form="character-filters"
              className="button button-secondary"
            >
              APPLY
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Name Filter */}
          <FilterField label="Name" htmlFor="filter-name">
            <input
              type="text"
              id="filter-name"
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
