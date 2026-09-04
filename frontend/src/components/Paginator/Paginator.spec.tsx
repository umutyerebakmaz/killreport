import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Paginator from './Paginator';

function renderPaginator(
  overrides: Partial<React.ComponentProps<typeof Paginator>> = {},
) {
  const props = {
    hasNextPage: true,
    hasPrevPage: true,
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onFirst: vi.fn(),
    onLast: vi.fn(),
    ...overrides,
  };
  render(<Paginator {...props} />);
  const [first, prev, next, last] = screen.getAllByRole('button');
  return { props, first, prev, next, last };
}

describe('Paginator', () => {
  it('renders four navigation buttons', () => {
    renderPaginator();

    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('calls the matching handler for each button', async () => {
    const user = userEvent.setup();
    const { props, first, prev, next, last } = renderPaginator();

    await user.click(first);
    await user.click(prev);
    await user.click(next);
    await user.click(last);

    expect(props.onFirst).toHaveBeenCalledTimes(1);
    expect(props.onPrev).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onLast).toHaveBeenCalledTimes(1);
  });

  it('disables backwards navigation on the first page', () => {
    const { first, prev, next, last } = renderPaginator({ hasPrevPage: false });

    expect(first).toBeDisabled();
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();
    expect(last).toBeEnabled();
  });

  it('disables forwards navigation on the last page', () => {
    const { first, prev, next, last } = renderPaginator({ hasNextPage: false });

    expect(first).toBeEnabled();
    expect(prev).toBeEnabled();
    expect(next).toBeDisabled();
    expect(last).toBeDisabled();
  });

  it('disables everything while loading', () => {
    renderPaginator({ loading: true });

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });

  it('shows the page number with and without a total', () => {
    renderPaginator({ currentPage: 3, totalPages: 10 });
    expect(screen.getByText('Page 3 of 10')).toBeInTheDocument();
  });

  it('shows only the current page when the total is unknown', () => {
    renderPaginator({ currentPage: 7 });
    expect(screen.getByText('Page 7')).toBeInTheDocument();
  });

  it('renders the page size selector only when a handler is given', () => {
    renderPaginator();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('reports page size changes as numbers', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    renderPaginator({ pageSize: 25, onPageSizeChange });

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('25');

    await user.selectOptions(select, '100');

    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });
});
