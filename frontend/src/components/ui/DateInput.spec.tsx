import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import DateInput from './DateInput';

describe('DateInput', () => {
  it('shows the value in English, whatever the reader s locale', () => {
    render(
      <DateInput value="2011-03-15" onChange={vi.fn()} aria-label="Founded" />,
    );
    expect(screen.getByRole('button', { name: /Founded/ })).toHaveTextContent(
      'Mar 15, 2011',
    );
  });

  it('says so when nothing is chosen', () => {
    render(<DateInput value="" onChange={vi.fn()} aria-label="Founded" />);
    expect(screen.getByRole('button', { name: /Founded/ })).toHaveTextContent(
      'Select date',
    );
  });

  it('reports a chosen day and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateInput value="2011-03-15" onChange={onChange} aria-label="Founded" />,
    );

    await user.click(screen.getByRole('button', { name: /Founded/ }));
    await user.click(screen.getByRole('gridcell', { name: '20' }));

    expect(onChange).toHaveBeenCalledWith('2011-03-20');
    // The panel closes through Headless UI's `transition`, which finishes
    // across a couple of animation frames rather than within the same tick
    // — the same reason `NavPopover.spec.tsx` waits for its own close.
    await waitFor(() =>
      expect(screen.queryByRole('gridcell')).not.toBeInTheDocument(),
    );
  });

  it('reports an empty value when cleared', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateInput value="2011-03-15" onChange={onChange} aria-label="Founded" />,
    );

    await user.click(screen.getByRole('button', { name: /Founded/ }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('passes its range down to the calendar', async () => {
    const user = userEvent.setup();
    render(
      <DateInput
        value="2026-09-07"
        max="2026-09-07"
        onChange={vi.fn()}
        aria-label="Date"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Date/ }));
    // Two cells read "8" in this month's six-week grid: September 8th and,
    // trailing off the end of the grid, October 8th — both past `max` and so
    // both disabled. The grid renders chronologically, so the in-month one
    // is first.
    const [sept8] = screen.getAllByRole('gridcell', { name: '8' });
    expect(sept8).toHaveAttribute('aria-disabled', 'true');
  });

  describe('accessible name', () => {
    // On `main` the trigger was a native `<input type="date">`: a
    // `<label htmlFor>` named it and the input announced its own value in
    // the same breath. As a `<button>`, a `<label>` or an `aria-label`
    // *replaces* the accessible name rather than adding to it, so either
    // one on its own loses half the information. Both cases below must
    // carry the field's name and its current value.

    it('carries both the field name and the value, when a label points at it', () => {
      render(
        <>
          <label id="filter-date-from-label" htmlFor="filter-date-from">
            Founded From
          </label>
          <DateInput
            id="filter-date-from"
            value="2011-03-15"
            onChange={vi.fn()}
          />
        </>,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAccessibleName(/Founded From/);
      expect(trigger).toHaveAccessibleName(/Mar 15, 2011/);
    });

    it('carries both the field name and the value, when using aria-label', () => {
      render(
        <DateInput
          value="2011-03-15"
          onChange={vi.fn()}
          aria-label="Leaderboard date"
        />,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAccessibleName(/Leaderboard date/);
      expect(trigger).toHaveAccessibleName(/Mar 15, 2011/);
    });

    it('carries the "Select date" placeholder as the value half of the name', () => {
      render(
        <DateInput value="" onChange={vi.fn()} aria-label="Leaderboard date" />,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAccessibleName(/Leaderboard date/);
      expect(trigger).toHaveAccessibleName(/Select date/);
    });
  });

  it('reaches the grid entirely from the keyboard, selects, and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateInput value="2011-03-15" onChange={onChange} aria-label="Founded" />,
    );

    const trigger = screen.getByRole('button', { name: /Founded/ });
    trigger.focus();
    await user.keyboard('{Enter}');

    // `Popover` does not move focus into the panel on open, so the journey
    // from here is: Tab past Previous month / Month / Year / Next month,
    // then the one focusable day cell — five stops.
    await user.keyboard('{Tab}{Tab}{Tab}{Tab}{Tab}');
    await user.keyboard('{ArrowRight}{Enter}');

    expect(onChange).toHaveBeenCalledWith('2011-03-16');
    // Same transition-timing note as the click-driven close test above.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
