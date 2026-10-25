import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterCorporationHistoryQuery } from '@/generated/graphql';
import EmploymentHistoryList from './EmploymentHistoryList';

type Entry = CharacterCorporationHistoryQuery['characterCorporationHistory'][0];

const NOW = new Date('2026-10-25T12:00:00Z');

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  recordId: 1,
  corporationId: 98148202,
  startDate: '2022-09-18T09:56:00.000Z',
  endDate: '2026-01-17T18:13:00.000Z',
  isDeleted: false,
  corporation: { id: 98148202, name: 'Kenshin.', ticker: '300M' },
  ...overrides,
});

const renderList = (entries: Entry[]) =>
  render(<EmploymentHistoryList entries={entries} now={NOW} />);

describe('EmploymentHistoryList', () => {
  it('puts the corporation and its ticker above the dates, the days apart', () => {
    const { container } = renderList([entry()]);

    const link = screen.getByRole('link', { name: 'Kenshin.' });
    expect(link.getAttribute('href')).toBe('/corporations/98148202');
    expect(screen.getByText('[300M]')).toBeTruthy();
    expect(
      screen.getByText('2022.09.18 09:56 to 2026.01.17 18:13'),
    ).toBeTruthy();
    expect(screen.getByText('(1217 Days)')).toBeTruthy();
    // Plain weight: the corporation link is what the row is about
    expect(container.querySelector('b')).toBeNull();
  });

  it('explains the corporation link on hover, worded like the tables', async () => {
    renderList([entry()]);

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Kenshin.' }));

    expect(await screen.findByText('Show Corporation Info')).toBeTruthy();
  });

  it('leads each row with the corporation logo', () => {
    renderList([
      entry({ recordId: 2 }),
      entry({ recordId: 1, corporationId: 1024623120, corporation: null }),
    ]);

    const [named, unnamed] = screen.getAllByRole('img');
    expect(named.getAttribute('alt')).toBe('Kenshin.');
    expect(named.getAttribute('src')).toContain('98148202');
    // The image server knows the corporation before our database does
    expect(unnamed.getAttribute('alt')).toBe('1024623120');
    expect(unnamed.getAttribute('src')).toContain('1024623120');
  });

  it('marks a closed corporation, and only that one', () => {
    renderList([
      entry({ recordId: 2 }),
      entry({
        recordId: 1,
        isDeleted: true,
        corporationId: 1024623120,
        corporation: { id: 1024623120, name: 'CORPFREE', ticker: 'CORP' },
      }),
    ]);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0].textContent).not.toContain('(Closed)');
    expect(rows[1].textContent).toContain('CORPFREE [CORP] (Closed)');
  });

  it('runs the current corporation to this day', () => {
    renderList([
      entry({ startDate: '2026-01-17T18:18:00.000Z', endDate: null }),
    ]);

    expect(screen.getByText('2026.01.17 18:18 to this day')).toBeTruthy();
    expect(screen.getByText('(280 Days)')).toBeTruthy();
  });

  it('shows the corporation id, unlinked and without a ticker, until its name is known', () => {
    renderList([entry({ corporationId: 1024623120, corporation: null })]);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('1024623120')).toBeTruthy();
    expect(screen.getByRole('listitem').textContent).not.toContain('[');
  });

  it('says so when there is no history yet', () => {
    renderList([]);

    expect(screen.getByText('No employment history yet.')).toBeTruthy();
  });
});
