import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Calendar from './Calendar';

const NOW = new Date(Date.UTC(2026, 8, 7, 12, 0, 0));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Calendar', () => {
  it('opens on the month of the selected value', () => {
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent(
      'March',
    );
    expect(screen.getByRole('button', { name: 'Year' })).toHaveTextContent(
      '2011',
    );
  });

  it('opens on the current month when nothing is selected', () => {
    render(<Calendar value="" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent(
      'September',
    );
    expect(screen.getByRole('button', { name: 'Year' })).toHaveTextContent(
      '2026',
    );
  });

  it('names the weekdays from Monday', () => {
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} />);
    const heads = screen.getAllByRole('columnheader');
    expect(heads.map((head) => head.textContent)).toEqual([
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
      'Sa',
      'Su',
    ]);
  });

  it('reports the day that was clicked as YYYY-MM-DD', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar value="2011-03-15" onSelect={onSelect} />);

    await user.click(screen.getByRole('gridcell', { name: '20' }));

    expect(onSelect).toHaveBeenCalledWith('2011-03-20');
  });

  it('marks the selected day', () => {
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} />);
    expect(screen.getByRole('gridcell', { name: '15' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('refuses days after max', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Calendar value="2026-09-07" onSelect={onSelect} max="2026-09-07" />,
    );

    // Grid runs Aug 31 → Oct 11; first "8" is 8 September
    const tomorrow = screen.getAllByRole('gridcell', { name: '8' })[0];
    expect(tomorrow).toHaveAttribute('aria-disabled', 'true');

    await user.click(tomorrow);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('refuses days before min', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Calendar value="2011-03-15" onSelect={onSelect} min="2011-03-10" />,
    );

    // Grid runs Feb 28 → Apr 10 in order; first "9" is 9 March
    const beforeMin = screen.getAllByRole('gridcell', { name: '9' })[0];
    await user.click(beforeMin);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('walks months with the arrows', async () => {
    const user = userEvent.setup();
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent(
      'February',
    );

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent(
      'April',
    );
  });

  it('clears through the footer', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar value="2011-03-15" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSelect).toHaveBeenCalledWith('');
  });

  it('jumps to today through the footer', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar value="2011-03-15" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(onSelect).toHaveBeenCalledWith('2026-09-07');
  });

  it('jumps years without walking through every month', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar value="2011-03-15" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Year' }));
    await user.click(screen.getByRole('option', { name: '2024' }));

    expect(screen.getByRole('button', { name: 'Year' })).toHaveTextContent(
      '2024',
    );

    // The interesting claim: the year jump actually re-dated the grid, not
    // just the header.
    await user.click(screen.getByRole('gridcell', { name: '15' }));
    expect(onSelect).toHaveBeenCalledWith('2024-03-15');
  });

  it('jumps months from the header', async () => {
    const user = userEvent.setup();
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Month' }));
    await user.click(screen.getByRole('option', { name: 'November' }));

    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent(
      'November',
    );
  });

  it('offers only the years the range allows', async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        value="2011-03-15"
        onSelect={vi.fn()}
        min="2010-01-01"
        max="2012-12-31"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '2010',
      '2011',
      '2012',
    ]);
  });

  it('walks the grid with the arrow keys and selects with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar value="2011-03-15" onSelect={onSelect} />);

    screen.getByRole('gridcell', { name: '15' }).focus();
    await user.keyboard('{ArrowRight}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('2011-03-16');
  });

  it('moves a week with the vertical arrows', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar value="2011-03-15" onSelect={onSelect} />);

    screen.getByRole('gridcell', { name: '15' }).focus();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('2011-03-22');
  });

  it('crosses into the next month rather than stopping at its edge', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar value="2011-03-31" onSelect={onSelect} />);

    screen.getByRole('gridcell', { name: '31' }).focus();
    await user.keyboard('{ArrowRight}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('2011-04-01');
  });

  it('steps a month with PageUp and PageDown', async () => {
    const user = userEvent.setup();
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} />);

    screen.getByRole('gridcell', { name: '15' }).focus();
    await user.keyboard('{PageDown}');

    expect(screen.getByRole('button', { name: 'Month' })).toHaveTextContent(
      'April',
    );
  });

  it('leaves exactly one cell reachable by tab after picking a year', async () => {
    const user = userEvent.setup();
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Year' }));
    await user.click(screen.getByRole('option', { name: '2024' }));

    const focusable = screen
      .getAllByRole('gridcell')
      .filter((cell) => (cell as HTMLButtonElement).tabIndex === 0);
    expect(focusable).toHaveLength(1);
  });

  it('does not move focus into the grid when a year is picked', async () => {
    const user = userEvent.setup();
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} />);

    const yearTrigger = screen.getByRole('button', { name: 'Year' });
    await user.click(yearTrigger);
    await user.click(screen.getByRole('option', { name: '2024' }));

    expect(document.activeElement).toBe(yearTrigger);
  });

  it('refuses to arrow left past min, keeping focus and selection at the boundary', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Calendar value="2011-03-10" onSelect={onSelect} min="2011-03-10" />,
    );

    // Grid runs Feb 28 → Apr 10; first "10" is 10 March
    screen.getAllByRole('gridcell', { name: '10' })[0].focus();
    await user.keyboard('{ArrowLeft}{Enter}');

    expect(onSelect).toHaveBeenCalledWith('2011-03-10');
  });

  it('lets a disabled day cell take focus', () => {
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} min="2011-03-10" />);

    // Grid runs Feb 28 → Apr 10 in order; first "9" is 9 March, disabled.
    const beforeMin = screen.getAllByRole('gridcell', { name: '9' })[0];
    expect(beforeMin).toHaveAttribute('aria-disabled', 'true');
    expect(beforeMin).not.toBeDisabled();

    beforeMin.focus();
    expect(document.activeElement).toBe(beforeMin);
  });

  it('stays tab-reachable when the Month dropdown lands on an out-of-range month', async () => {
    const user = userEvent.setup();
    render(<Calendar value="2011-03-15" onSelect={vi.fn()} min="2011-03-10" />);

    // February 2011 is entirely before the min, so its 1st is disabled.
    await user.click(screen.getByRole('button', { name: 'Month' }));
    await user.click(screen.getByRole('option', { name: 'February' }));

    const focusable = screen
      .getAllByRole('gridcell')
      .filter((cell) => (cell as HTMLButtonElement).tabIndex === 0);
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toHaveAttribute('aria-disabled', 'true');
    expect(focusable[0]).not.toBeDisabled();
  });

  it('lands on the first selectable day when a mid-month min clips the target month', async () => {
    const user = userEvent.setup();
    render(<Calendar value="2011-04-15" onSelect={vi.fn()} min="2011-03-10" />);

    // March is only partly out of range — the 1st through the 9th are
    // disabled, but the 10th through the 31st are selectable. Landing on
    // the 1st would strand every arrow key on a disabled day.
    await user.click(screen.getByRole('button', { name: 'Month' }));
    await user.click(screen.getByRole('option', { name: 'March' }));

    const focusable = () =>
      screen
        .getAllByRole('gridcell')
        .find((cell) => (cell as HTMLButtonElement).tabIndex === 0);

    const focused = focusable();
    expect(focused).toHaveTextContent('10');
    expect(focused).not.toHaveAttribute('aria-disabled', 'true');

    focused?.focus();
    await user.keyboard('{ArrowRight}');

    expect(focusable()).toHaveTextContent('11');
  });
});
