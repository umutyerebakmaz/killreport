import { TrackedEntityType } from '@/generated/graphql';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Tracker/TrackButton', () => ({
  default: () => <button>track</button>,
}));
vi.mock('@/components/ui/EveImage', () => ({ default: () => <span /> }));

import TrackDialog from './TrackDialog';

const entries = [
  { type: TrackedEntityType.Character, id: 1, name: 'A', section: 'VICTIM' },
  { type: TrackedEntityType.Character, id: 2, name: 'B', section: 'ATTACKERS' },
  { type: TrackedEntityType.Corporation, id: 10, name: 'C' },
];

describe('TrackDialog', () => {
  it('renders nothing when closed', () => {
    const { baseElement } = render(
      <TrackDialog
        open={false}
        onClose={() => {}}
        entries={entries}
        title="T"
      />,
    );
    expect(baseElement.textContent).toBe('');
  });
  it('shows tab counts and the link', () => {
    render(<TrackDialog open onClose={() => {}} entries={entries} title="T" />);
    expect(screen.getByText('CHARACTERS (2)')).toBeTruthy();
    expect(screen.getByText('CORPORATIONS (1)')).toBeTruthy();
    expect(screen.getByText('ALLIANCES (0)')).toBeTruthy();
    expect(screen.getByText('A').closest('a')?.getAttribute('href')).toBe(
      '/characters/1?tab=killmails',
    );
  });
  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<TrackDialog open onClose={onClose} entries={entries} title="T" />);
    fireEvent.click(screen.getByText('Close').closest('button')!);
    expect(onClose).toHaveBeenCalled();
  });
});
