import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useTracker = vi.fn();
vi.mock('@/hooks/useTracker', () => ({ useTracker: () => useTracker() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/generated/graphql', () => ({
  TrackedEntityType: {
    Character: 'CHARACTER',
    Corporation: 'CORPORATION',
    Alliance: 'ALLIANCE',
  },
}));

import TrackerMenu from './TrackerMenu';

const untrack = vi.fn();

const full = {
  characters: [
    { automatic: true, character: { id: 1, name: 'Own Pilot' } },
    { automatic: false, character: { id: 2, name: 'Friend Pilot' } },
  ],
  corporations: [
    { automatic: true, corporation: { id: 10, name: 'Own Corp' } },
    { automatic: false, corporation: { id: 11, name: 'Other Corp' } },
  ],
  alliances: [
    { automatic: false, alliance: { id: 20, name: 'Some Alliance' } },
  ],
};

function setup(data: object | undefined, signedIn = true) {
  useTracker.mockReturnValue({ signedIn, data, untrack });
}

async function open(variant: 'header' | 'drawer' = 'header') {
  const user = userEvent.setup();
  render(<TrackerMenu variant={variant} />);
  if (variant === 'header') {
    await user.click(screen.getByRole('button', { name: /tracker/i }));
  }
  return user;
}

beforeEach(() => vi.clearAllMocks());

describe('TrackerMenu', () => {
  it('renders nothing when signed out', () => {
    setup(undefined, false);
    const { container } = render(<TrackerMenu variant="header" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('orders the groups corporations, alliances, characters', async () => {
    setup(full);
    await open();
    const headers = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headers).toEqual(['CORPORATIONS', 'ALLIANCES', 'CHARACTERS']);
  });

  it('hides empty groups', async () => {
    setup({ ...full, alliances: [] });
    await open();
    expect(screen.queryByText('ALLIANCES')).toBeNull();
  });

  it('links rows to the killmails tab', async () => {
    setup(full);
    await open();
    expect(screen.getByRole('link', { name: 'Own Corp' })).toHaveAttribute(
      'href',
      '/corporations/10?tab=killmails',
    );
    expect(screen.getByRole('link', { name: 'Some Alliance' })).toHaveAttribute(
      'href',
      '/alliances/20?tab=killmails',
    );
    expect(screen.getByRole('link', { name: 'Friend Pilot' })).toHaveAttribute(
      'href',
      '/characters/2?tab=killmails',
    );
  });

  it('gives automatic rows no untrack button', async () => {
    setup(full);
    await open();
    expect(
      screen.queryByRole('button', { name: 'Untrack Own Corp' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Untrack Own Pilot' }),
    ).toBeNull();
  });

  it('untracks a manual row', async () => {
    setup(full);
    const user = await open();
    await user.click(
      screen.getByRole('button', { name: 'Untrack Other Corp' }),
    );
    expect(untrack).toHaveBeenCalledWith('CORPORATION', 11);
  });

  it('shows the empty note when nothing was added by hand', async () => {
    setup({
      characters: [full.characters[0]],
      corporations: [full.corporations[0]],
      alliances: [],
    });
    await open();
    expect(
      screen.getByText(
        'Add characters, corporations and alliances with the TRACK button on their pages.',
      ),
    ).toBeInTheDocument();
  });

  it('omits the empty note once something was added', async () => {
    setup(full);
    await open();
    expect(screen.queryByText(/with the TRACK button/)).toBeNull();
  });

  it('draws a titled flat list in the drawer', async () => {
    setup(full);
    await open('drawer');
    const title = screen.getByText('TRACKER');
    expect(title).toBeInTheDocument();
    expect(
      within(document.body).getByRole('link', { name: 'Friend Pilot' }),
    ).toBeInTheDocument();
  });
});
