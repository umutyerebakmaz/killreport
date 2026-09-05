import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FilterBar, { FilterBarProps } from './FilterBar';

function renderFilterBar(overrides: Partial<FilterBarProps> = {}) {
  const props: FilterBarProps = {
    onOpenFilters: vi.fn(),
    ...overrides,
  };
  render(<FilterBar {...props} />);
  return { props };
}

describe('FilterBar', () => {
  it('marks a filter button pressed when it carries a badge', () => {
    renderFilterBar({ activeFilterCount: 2 });

    expect(screen.getByRole('button', { name: /filters/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('leaves a filter button unpressed when it has no badge', () => {
    renderFilterBar({ activeFilterCount: 0 });

    expect(screen.getByRole('button', { name: /filters/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
