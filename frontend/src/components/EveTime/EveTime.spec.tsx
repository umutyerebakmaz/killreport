import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EveTime from './EveTime';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-28T14:32:45Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EveTime', () => {
  it('shows UTC as HH:MM once mounted', async () => {
    render(<EveTime />);

    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(screen.getByText('14:32')).toBeInTheDocument();
  });

  it('turns over on the minute boundary, not a minute after mounting', async () => {
    render(<EveTime />);
    await act(() => vi.advanceTimersByTimeAsync(0));

    // 15 seconds to 14:33:00.
    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(screen.getByText('14:33')).toBeInTheDocument();
  });

  it('keeps ticking once a minute after that', async () => {
    render(<EveTime />);
    await act(() => vi.advanceTimersByTimeAsync(15_000 + 60_000));

    expect(screen.getByText('14:34')).toBeInTheDocument();
  });
});
