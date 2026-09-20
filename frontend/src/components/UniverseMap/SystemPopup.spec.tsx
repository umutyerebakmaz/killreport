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
  // The component branches on the enum, so the mock has to carry it.
  MapOwnerKind: {
    Alliance: 'ALLIANCE',
    Faction: 'FACTION',
    Corporation: 'CORPORATION',
  },
}));

import SystemPopup from './SystemPopup';

const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };

/** Jita's real neighbours, three of the seven, in the SQL's name order. */
const GATES = [
  {
    stargateId: 50013928,
    destinationSystemId: 30000138,
    destinationName: 'Ikuchi',
    destinationSecurityStatus: 0.94,
  },
  {
    stargateId: 50001248,
    destinationSystemId: 30000140,
    destinationName: 'Maurasi',
    destinationSecurityStatus: 0.9,
  },
  {
    stargateId: 50001249,
    destinationSystemId: 30000144,
    destinationName: 'Perimeter',
    destinationSecurityStatus: 0.95,
  },
];

/** Jita's real holder: highsec is faction space, so the popup shows a crest. */
const CONCORD = {
  ownerId: 500006,
  kind: 'FACTION',
  name: 'CONCORD Assembly',
  ticker: null,
};

/** Jita's real row, as the query returns it. */
function details(over: Record<string, unknown> = {}) {
  return {
    systemId: 30000142,
    name: 'Jita',
    securityStatus: 0.94,
    constellationName: 'Kimotoro',
    regionName: 'The Forge',
    owner: CONCORD,
    stargates: GATES,
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
      anchorRadius={1.5}
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
  it('shows the header and the four hourly numbers', () => {
    loaded();
    renderPopup();

    expect(screen.getByText('Jita')).toBeInTheDocument();
    expect(screen.getByTestId('popup-security')).toHaveTextContent('0.9');
    // The address is one line now, so the constellation and the region are
    // read out of the same element the system name sits in.
    expect(screen.getByText('· Kimotoro · The Forge')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('77')).toBeInTheDocument();
    expect(screen.getByText('1,745')).toBeInTheDocument();
  });

  it('shows the owner named, and its crest on a disc of its own colour', () => {
    loaded();
    renderPopup();

    expect(screen.getByText('CONCORD Assembly')).toBeInTheDocument();
    // #d8dde3 is CONCORD's entry in SOV_COLORS — the same value the canvas
    // tints the system's mark with, which is the point of showing it here.
    expect(screen.getByTestId('popup-owner-disc-500006')).toHaveStyle({
      backgroundColor: '#d8dde3',
    });
  });

  it('shows no crest and no owner line in unclaimed space', () => {
    loaded({ owner: null });
    renderPopup();

    expect(screen.queryByText('CONCORD Assembly')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('popup-owner-disc-500006'),
    ).not.toBeInTheDocument();
  });

  it('lists the destinations under a Stargates heading, not a count', () => {
    loaded();
    renderPopup();

    expect(screen.getByText('Stargates')).toBeInTheDocument();
    expect(screen.getByText('Ikuchi')).toBeInTheDocument();
    expect(screen.getByText('Maurasi')).toBeInTheDocument();
    expect(screen.getByText('Perimeter')).toBeInTheDocument();
  });

  it("puts each destination's security status beside its name", () => {
    loaded({
      stargates: [
        {
          stargateId: 1,
          destinationSystemId: 30000141,
          destinationName: 'Tama',
          destinationSecurityStatus: 0.3,
        },
      ],
    });
    renderPopup();

    const chip = screen.getByRole('link', { name: /Tama/ });
    expect(chip).toHaveTextContent('Tama0.3');
    // Lowsec's yellow, the same ramp the panel's own status uses — the value
    // is carried by the colour as much as by the digit.
    expect(chip.querySelector('.text-yellow-400')).not.toBeNull();
  });

  it('keeps a destination on the map rather than sending it to the page', () => {
    loaded();
    renderPopup();

    expect(screen.getByRole('link', { name: /Perimeter/ })).toHaveAttribute(
      'href',
      '/map?focus=30000144',
    );
  });

  it('drops the whole section for a system with no stargates', () => {
    // A wormhole: no gates at all, so a heading would head nothing.
    loaded({ stargates: [] });
    renderPopup();

    expect(screen.queryByText('Stargates')).not.toBeInTheDocument();
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
    // The stargates are topology and survive a missing snapshot.
    expect(screen.getByText('Perimeter')).toBeInTheDocument();
  });

  it('links to the system page', () => {
    loaded();
    renderPopup();

    expect(
      screen.getByRole('link', { name: /Open the system/ }),
    ).toHaveAttribute('href', '/solar-systems/30000142');
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
