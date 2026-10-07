import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let changesSkipped: boolean[] = [];
let changesLoading = false;
vi.mock('@/generated/graphql', () => ({
  MapOwnerKind: {
    Alliance: 'ALLIANCE',
    Faction: 'FACTION',
    Corporation: 'CORPORATION',
  },
  useMapSovChangesQuery: (options: { skip?: boolean }) => {
    changesSkipped.push(!!options.skip);
    return {
      loading: changesLoading,
      data:
        options.skip || changesLoading
          ? undefined
          : {
              recentTerritoryChanges: [
                {
                  id: 'c1',
                  solarSystemId: 30004759,
                  solarSystemName: '1DQ1-A',
                  previousOwnerId: 1,
                  previousOwnerName: 'Old Holder',
                  newOwnerId: 2,
                  newOwnerName: 'New Holder',
                  changeType: 'gained',
                  detectedAt: new Date(Date.now() - 3_600_000).toISOString(),
                },
              ],
            },
    };
  },
}));

import SovPanel from './SovPanel';

const owners = [
  {
    ownerId: 99003581,
    kind: 'ALLIANCE',
    name: 'Fraternity.',
    ticker: 'FRT',
    systemCount: 300,
  },
  {
    ownerId: 500003,
    kind: 'FACTION',
    name: 'Amarr Empire',
    ticker: null,
    systemCount: 706,
  },
] as never;

const soon = new Date(
  Date.now() + 2 * 3_600_000 + 14 * 60_000 + 30_000,
).toISOString();
const campaigns = [
  {
    campaignId: 1,
    eventType: 'ihub_defense',
    solarSystemId: 30004759,
    solarSystemName: '1DQ1-A',
    regionName: 'Delve',
    defenderId: 99003581,
    defenderName: 'Fraternity.',
    defenderTicker: 'FRT',
    defenderScore: null,
    attackersScore: null,
    startTime: soon,
    updatedAt: new Date().toISOString(),
  },
] as never;

const handlers = () => ({
  onIsolate: vi.fn(),
  onFrameOwner: vi.fn(),
  onFocusSystem: vi.fn(),
  shareUrlFor: (id: number) =>
    `https://killreport.com/map?layer=sovereignty&focus=${id}`,
});

beforeEach(() => {
  changesSkipped = [];
  changesLoading = false;
});

describe('SovPanel', () => {
  // The page exists for fleet commanders; the timers are what they came for.
  it('opens on the timers', () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Timers' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('1DQ1-A')).toBeInTheDocument();
    expect(screen.getByText(/2h 14m/)).toBeInTheDocument();
  });

  it('focuses the map on a timer’s system', async () => {
    const h = handlers();
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...h}
      />,
    );
    // Anchored: the copy button's "Copy link to 1DQ1-A" names it too.
    await userEvent.click(screen.getByRole('button', { name: /^1DQ1-A/ }));
    expect(h.onFocusSystem).toHaveBeenCalledWith(30004759);
  });

  it('copies a timer’s link', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Copy link to 1DQ1-A' }),
    );

    expect(writeText).toHaveBeenCalledWith(
      'https://killreport.com/map?layer=sovereignty&focus=30004759',
    );
  });

  it('says so when there are no timers', () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={[] as never}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(screen.getByText('No active campaigns')).toBeInTheDocument();
  });

  it('says how old the timers are when the worker has stopped', () => {
    const stale = [
      {
        ...(campaigns as unknown as object[])[0],
        updatedAt: '2026-09-12T14:33:49.046Z',
      },
    ] as never;
    render(
      <SovPanel
        owners={owners}
        campaigns={stale}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(
      screen.getByText('Data as of 2026-09-12 14:33 EVE'),
    ).toBeInTheDocument();
  });

  it('lists owners by the systems they hold, faction included', async () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));

    const rows = screen.getAllByRole('button', { pressed: false });
    expect(rows[0]).toHaveTextContent('Amarr Empire');
    expect(rows[0]).toHaveTextContent('706');
  });

  it('isolates an owner, and lets go of it on a second press', async () => {
    const h = handlers();
    const { rerender } = render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...h}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));
    await userEvent.click(
      screen.getByRole('button', { name: /Fraternity\./, pressed: false }),
    );
    expect(h.onIsolate).toHaveBeenLastCalledWith(99003581);

    rerender(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={99003581}
        {...h}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Fraternity\./, pressed: true }),
    );
    expect(h.onIsolate).toHaveBeenLastCalledWith(null);
  });

  it('frames an owner’s systems from its own button', async () => {
    const h = handlers();
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...h}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Show Fraternity. on the map' }),
    );
    expect(h.onFrameOwner).toHaveBeenCalledWith(99003581);
  });

  // Fetched the first time the tab opens, not before.
  it('fetches the changes only once their tab is opened', async () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(changesSkipped.at(-1)).toBe(true);

    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));

    expect(changesSkipped.at(-1)).toBe(false);
    const row = screen.getByRole('button', { name: /1DQ1-A/ });
    expect(within(row).getByText(/Old Holder/)).toBeInTheDocument();
    expect(within(row).getByText(/New Holder/)).toBeInTheDocument();
  });

  // The empty-state line is a claim; while the query is in flight it is not
  // true yet.
  it('says the changes are loading rather than that there are none', async () => {
    changesLoading = true;
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));

    expect(screen.getByText('Loading changes...')).toBeInTheDocument();
    expect(screen.queryByText('No recent changes')).not.toBeInTheDocument();
  });

  it('counts the timers in the header, in the plural past one', () => {
    const two = [
      ...(campaigns as unknown as object[]),
      { ...(campaigns as unknown as object[])[0], campaignId: 2 },
    ] as never;
    render(
      <SovPanel
        owners={owners}
        campaigns={two}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    expect(screen.getByText('2 timers')).toBeInTheDocument();
  });

  it('shows the owner crest from the corporation path for a faction', async () => {
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));
    expect(screen.getByAltText('Amarr Empire')).toHaveAttribute(
      'src',
      expect.stringContaining('/corporations/500003/'),
    );
  });

  // Moved here with the owner list from SovLegend (spec §5.3).
  describe('owners tab, as the legend was', () => {
    async function openOwners(list: never = owners) {
      const view = render(
        <SovPanel
          owners={list}
          campaigns={campaigns}
          isolatedOwner={null}
          {...handlers()}
        />,
      );
      await userEvent.click(screen.getByRole('tab', { name: 'Owners' }));
      return view;
    }

    it('shows each owner as its logo on a disc of its own colour', async () => {
      // The same reading as the canvas: the colour is behind the crest, not a
      // swatch beside it, so the list and the map say the same thing.
      const { container } = await openOwners();

      const disc = container.querySelector(
        '[data-testid="sov-owner-disc-99003581"]',
      );
      expect(disc).not.toBeNull();
      expect((disc as HTMLElement).style.backgroundColor).not.toBe('');
      expect(screen.getByAltText('Fraternity.')).toBeInTheDocument();
    });

    it('lists every owner rather than a top slice with a tail', async () => {
      // The panel is as tall as the map and scrolls, so there is nowhere for a
      // cap to help: an owner left out of a list that has room for it is just
      // missing.
      await openOwners();

      expect(screen.getByText('Fraternity.')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
      expect(screen.queryByText(/other/)).not.toBeInTheDocument();
    });

    it('scrolls what does not fit instead of growing past the map', async () => {
      await openOwners();
      expect(screen.getByRole('tabpanel').className).toContain(
        'overflow-y-auto',
      );
    });

    it('says so rather than drawing an empty list while the data loads', async () => {
      await openOwners([] as never);
      expect(screen.getByText('Loading sovereignty...')).toBeInTheDocument();
    });
  });

  it('collapses to its header and opens again', async () => {
    // A list this tall is also a wall in front of the galaxy, which is the
    // thing being read. The count stays visible so the collapsed header is
    // worth reopening.
    render(
      <SovPanel
        owners={owners}
        campaigns={campaigns}
        isolatedOwner={null}
        {...handlers()}
      />,
    );

    const toggle = screen.getByRole('button', { name: /sovereignty/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('1DQ1-A')).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('1DQ1-A')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('1 timer')).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.getByText('1DQ1-A')).toBeInTheDocument();
  });

  describe('on a phone', () => {
    afterEach(() => {
      Reflect.deleteProperty(window, 'matchMedia');
    });

    it('starts folded, so the panel does not cover the map', () => {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
      })) as unknown as typeof window.matchMedia;

      render(
        <SovPanel
          owners={owners}
          campaigns={campaigns}
          isolatedOwner={null}
          {...handlers()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /sovereignty/i }),
      ).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('1DQ1-A')).not.toBeInTheDocument();
    });
  });
});
