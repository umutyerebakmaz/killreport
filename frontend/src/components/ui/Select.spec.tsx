import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Select, { SelectOption } from './Select';

const SECURITY: SelectOption[] = [
  { value: 'all', label: 'All Security' },
  { value: 'highsec', label: 'High Sec', swatch: 'bg-green-500' },
  { value: 'nullsec', label: 'Null Sec', swatch: 'bg-red-500' },
];

const PLAIN: SelectOption[] = [
  { value: 'nameAsc', label: 'Name A-Z' },
  { value: 'nameDesc', label: 'Name Z-A' },
];

function renderSelect(options: SelectOption[], value: string) {
  const onChange = vi.fn();
  const { container } = render(
    <Select
      value={value}
      onChange={onChange}
      options={options}
      aria-label="Test select"
    />,
  );
  return { container, onChange };
}

/**
 * The swatch is decorative — the label already names the band — so it is
 * aria-hidden and has to be found in the markup rather than by role.
 */
const swatches = (container: HTMLElement) =>
  container.querySelectorAll('[data-swatch]');

describe('Select', () => {
  it("shows the selected option's swatch on the closed button", () => {
    const { container } = renderSelect(SECURITY, 'nullsec');

    const found = swatches(container);
    expect(found).toHaveLength(1);
    expect(found[0]).toHaveClass('bg-red-500');
  });

  it('shows no swatch on the button when the selected option has none', () => {
    const { container } = renderSelect(SECURITY, 'all');

    expect(swatches(container)).toHaveLength(0);
  });

  it('keeps a swatch-free list free of swatch markup', () => {
    const { container } = renderSelect(PLAIN, 'nameAsc');

    expect(swatches(container)).toHaveLength(0);
  });

  it('still renders the label beside a swatch', () => {
    renderSelect(SECURITY, 'highsec');

    expect(screen.getByText('High Sec')).toBeInTheDocument();
  });

  it("draws the selected option's icon on the closed button", () => {
    const SORTED: SelectOption[] = [
      {
        value: 'asc',
        label: 'Name A-Z',
        icon: <span data-testid="up" />,
      },
      {
        value: 'desc',
        label: 'Name Z-A',
        icon: <span data-testid="down" />,
      },
    ];

    renderSelect(SORTED, 'desc');

    expect(screen.getByTestId('down')).toBeInTheDocument();
    expect(screen.queryByTestId('up')).not.toBeInTheDocument();
  });

  it('takes an icon in place of a swatch on the same option', () => {
    const BOTH: SelectOption[] = [
      {
        value: 'a',
        label: 'Icon wins',
        swatch: 'bg-green-500',
        icon: <span data-testid="icon" />,
      },
    ];

    const { container } = renderSelect(BOTH, 'a');

    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(swatches(container)).toHaveLength(0);
  });
});
