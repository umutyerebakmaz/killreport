import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useTracker = vi.fn();
vi.mock('@/hooks/useTracker', () => ({ useTracker: () => useTracker() }));
vi.mock('@/generated/graphql', () => ({
  TrackedEntityType: {
    Character: 'CHARACTER',
    Corporation: 'CORPORATION',
    Alliance: 'ALLIANCE',
  },
}));

import { TrackedEntityType } from '@/generated/graphql';
import TrackButton from './TrackButton';

const track = vi.fn();
const untrack = vi.fn();

function setup(status: string, extra: object = {}) {
  useTracker.mockReturnValue({
    signedIn: true,
    status: () => status,
    track,
    untrack,
    pending: false,
    ...extra,
  });
  return render(
    <TrackButton type={TrackedEntityType.Character} id={90000001} />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('TrackButton', () => {
  it('renders nothing when signed out', () => {
    const { container } = setup('untracked', { signedIn: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for the own character', () => {
    const { container } = setup('self');
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a passive AUTO-TRACKED label, not a button', () => {
    setup('automatic');
    expect(screen.getByText('AUTO-TRACKED')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('tracks on click when untracked', () => {
    setup('untracked');
    fireEvent.click(screen.getByRole('button', { name: /\+ TRACK/ }));
    expect(track).toHaveBeenCalledWith('CHARACTER', 90000001);
  });

  it('shows TRACKING and untracks on click', () => {
    setup('tracked');
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('TRACKING');
    expect(button).toHaveTextContent('UNTRACK');
    fireEvent.click(button);
    expect(untrack).toHaveBeenCalledWith('CHARACTER', 90000001);
  });

  it('is disabled while pending', () => {
    setup('untracked', { pending: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders nothing while the tracker is loading', () => {
    const { container } = setup('untracked', { loading: true });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the error under the button', () => {
    setup('untracked', { error: 'Tracker is limited to 200 entries' });
    expect(
      screen.getByText('Tracker is limited to 200 entries'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
