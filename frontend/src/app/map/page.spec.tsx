import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A link can arrive with the scene already chosen — /map?scope=POCHVEN, pasted
 * or shared. App Router keeps the same component mounted when only the query
 * string changes, so the scope has to be derived on every render rather than
 * seeded on mount; #201 was exactly this bug on the killmails page. (Phase 1
 * ships no scope switcher, so the nav links to a bare /map.)
 */

let searchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn() }),
}));

const scopes: string[] = [];
vi.mock('@/components/UniverseMap/UniverseMap', () => ({
  default: ({ scope }: { scope: string }) => {
    scopes.push(scope);
    return <div data-testid="universe-map">{scope}</div>;
  },
}));

vi.mock('@/components/Loader', () => ({ default: () => null }));

// parseScope reaches through @/utils/map/camera into the generated module for the
// MapScope enum, and that module pulls in Apollo. Stubbing the enum keeps this
// spec to the page's own decision, which is the one thing it is about.
vi.mock('@/generated/graphql', () => ({
  MapScope: { NewEden: 'NEW_EDEN', Pochven: 'POCHVEN', Wormhole: 'WORMHOLE' },
}));

import MapPage from './page';

beforeEach(() => {
  searchParams = new URLSearchParams('');
  scopes.length = 0;
});

describe('MapPage', () => {
  it('defaults to the New Eden scene', async () => {
    render(<MapPage />);
    expect(await screen.findByTestId('universe-map')).toHaveTextContent(
      'NEW_EDEN',
    );
  });

  it('reads the scene out of the query string', async () => {
    searchParams = new URLSearchParams('scope=POCHVEN');
    render(<MapPage />);
    expect(await screen.findByTestId('universe-map')).toHaveTextContent(
      'POCHVEN',
    );
  });

  it('follows a query string change without being remounted', async () => {
    const { rerender } = render(<MapPage />);
    await screen.findByTestId('universe-map');

    searchParams = new URLSearchParams('scope=WORMHOLE');
    rerender(<MapPage />);

    expect(scopes.at(-1)).toBe('WORMHOLE');
  });

  it('falls back to New Eden for a scope with no scene', async () => {
    searchParams = new URLSearchParams('scope=ABYSSAL');
    render(<MapPage />);
    expect(await screen.findByTestId('universe-map')).toHaveTextContent(
      'NEW_EDEN',
    );
  });

  // jsdom applies no stylesheet, so what can be checked here is the contract
  // rather than the result: globals.css keys `main:has(> [data-full-bleed])` off
  // this attribute to drop the padding and the 120rem max-width, and the map is
  // letterboxed on a screen wider than 1920px without it. The rendering itself
  // is verified by looking.
  it('asks main for the whole viewport', async () => {
    render(<MapPage />);
    const canvas = await screen.findByTestId('universe-map');
    const wrapper = canvas.parentElement as HTMLElement;

    expect(wrapper).toHaveAttribute('data-full-bleed');
    expect(wrapper).toHaveClass('h-full');
  });
});
