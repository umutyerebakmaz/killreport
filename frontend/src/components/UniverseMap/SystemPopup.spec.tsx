import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type DetailsResult = {
  data?: { mapSystemDetails: Record<string, unknown> | null };
  loading: boolean;
  error?: { message: string };
};

// The repo's pattern for a component that reads a generated hook: mock the
// generated module rather than wrapping the tree in an Apollo provider. See
// UniverseMap.spec.tsx, which mocks the same module for the same reason.
const useMapSystemDetailsQuery = vi.fn<() => DetailsResult>();
vi.mock('@/generated/graphql', () => ({
  useMapSystemDetailsQuery: () => useMapSystemDetailsQuery(),
}));

import SystemPopup from './SystemPopup';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };

/** Jita's real row, as the query returns it. */
function details(over: Record<string, unknown> = {}) {
  return {
    systemId: 30000142,
    name: 'Jita',
    securityStatus: 0.94,
    constellationName: 'Kimotoro',
    regionName: 'The Forge',
    gateCount: 7,
    shipKills: 4,
    podKills: 8,
    npcKills: 77,
    shipJumps: 1745,
    snapshotAt: '2026-09-14T09:00:00.000Z',
    ...over,
  };
}

function loaded(over: Record<string, unknown> = {}) {
  useMapSystemDetailsQuery.mockReturnValue({
    data: { mapSystemDetails: details(over) },
    loading: false,
  });
}

function renderPopup(onClose = vi.fn()) {
  const utils = render(
    <SystemPopup
      systemId={30000142}
      screenX={100}
      screenY={100}
      onClose={onClose}
      {...VIEWPORT}
    />,
  );
  return { ...utils, onClose };
}

beforeEach(() => {
  useMapSystemDetailsQuery.mockReset();
});

describe('SystemPopup', () => {
  it('shows the header, the four hourly numbers and the gate count', () => {
    loaded();
    renderPopup();

    expect(screen.getByText('Jita')).toBeInTheDocument();
    expect(screen.getByText('0.9')).toBeInTheDocument();
    expect(screen.getByText('Kimotoro · The Forge')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('77')).toBeInTheDocument();
    expect(screen.getByText('1,745')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('says what the time line covers by sitting under the four boxes', () => {
    loaded();
    renderPopup();
    expect(screen.getByText(/last 1 hour · ESI/)).toBeInTheDocument();
  });

  it('shows an em dash for a jump count ESI did not report', () => {
    // Null is not zero: #208 kept the distinction in the column precisely so
    // this box can say "not reported" rather than "no traffic".
    loaded({ shipJumps: null });
    renderPopup();

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows a reported zero as zero', () => {
    loaded({ shipJumps: 0 });
    renderPopup();

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('shows four em dashes and no time line when the system has no snapshot', () => {
    loaded({
      shipKills: null,
      podKills: null,
      npcKills: null,
      shipJumps: null,
      snapshotAt: null,
    });
    renderPopup();

    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText(/last 1 hour/)).not.toBeInTheDocument();
    // The gate count is topology and survives a missing snapshot.
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('links to the system page', () => {
    loaded();
    renderPopup();

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/solar-systems/30000142',
    );
  });

  it('closes on Escape', () => {
    loaded();
    const { onClose } = renderPopup();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows skeleton boxes while the query is in flight', () => {
    useMapSystemDetailsQuery.mockReturnValue({ loading: true });
    const { container } = renderPopup();

    expect(container.querySelectorAll('.animate-pulse').length).toBe(8);
    expect(screen.queryByText('Jita')).not.toBeInTheDocument();
  });

  it('says so when the query failed', () => {
    useMapSystemDetailsQuery.mockReturnValue({
      loading: false,
      error: { message: 'boom' },
    });
    renderPopup();

    expect(screen.getByText(/Could not load/)).toBeInTheDocument();
  });
});
