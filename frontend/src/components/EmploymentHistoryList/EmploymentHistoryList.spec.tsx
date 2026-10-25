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
  corporation: { id: 98148202, name: 'Kenshin.' },
  ...overrides,
});

const renderList = (entries: Entry[]) =>
  render(<EmploymentHistoryList entries={entries} now={NOW} />);

describe('EmploymentHistoryList', () => {
  it('writes a row the way the game does', () => {
    const { container } = renderList([entry()]);

    const link = screen.getByRole('link', { name: 'Kenshin.' });
    expect(link.getAttribute('href')).toBe('/corporations/98148202');
    const bold = [...container.querySelectorAll('b')].map((b) => b.textContent);
    expect(bold).toEqual(['2022.09.18 09:56', '2026.01.17 18:13']);
    expect(container.textContent).toContain('(1217 Days)');
  });

  it('explains the corporation link on hover, worded like the tables', async () => {
    renderList([entry()]);

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Kenshin.' }));

    expect(await screen.findByText('Show Corporation Info')).toBeTruthy();
  });

  it('marks a closed corporation, and only that one', () => {
    renderList([
      entry({ recordId: 2 }),
      entry({
        recordId: 1,
        isDeleted: true,
        corporationId: 1024623120,
        corporation: { id: 1024623120, name: 'CORPFREE' },
      }),
    ]);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0].textContent).not.toContain('(Closed)');
    expect(rows[1].textContent).toContain('CORPFREE (Closed)');
  });

  it('runs the current corporation to this day', () => {
    const { container } = renderList([
      entry({ startDate: '2026-01-17T18:18:00.000Z', endDate: null }),
    ]);

    expect(container.textContent).toContain('2026.01.17 18:18 to this day');
    expect(container.textContent).toContain('(280 Days)');
  });

  it('shows the corporation id, unlinked, until its name is known', () => {
    renderList([entry({ corporationId: 1024623120, corporation: null })]);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('listitem').textContent).toContain('1024623120');
  });

  it('says so when there is no history yet', () => {
    renderList([]);

    expect(screen.getByText('No employment history yet.')).toBeTruthy();
  });
});
