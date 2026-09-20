import { MapOwnerKind } from '@/generated/graphql';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SovLegend from './SovLegend';

const owners = [
  {
    ownerId: 1,
    kind: MapOwnerKind.Alliance,
    name: 'A',
    ticker: 'AAA',
    systemCount: 500,
  },
  {
    ownerId: 2,
    kind: MapOwnerKind.Alliance,
    name: 'B',
    ticker: 'BBB',
    systemCount: 300,
  },
  {
    ownerId: 3,
    kind: MapOwnerKind.Faction,
    name: 'C',
    ticker: null,
    systemCount: 100,
  },
];

describe('SovLegend', () => {
  it('lists the biggest holders with their system counts', () => {
    render(<SovLegend owners={owners} />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('lists every owner rather than a top slice with a tail', () => {
    // The panel is as tall as the map and scrolls, so there is nowhere for a
    // cap to help: an owner left out of a list that has room for it is just
    // missing.
    render(<SovLegend owners={owners} />);

    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.queryByText(/other/)).not.toBeInTheDocument();
  });

  it('scrolls what does not fit instead of growing past the map', () => {
    const { container } = render(<SovLegend owners={owners} />);
    const list = container.querySelector('[data-testid="sov-legend-list"]');
    expect(list?.className).toContain('overflow-y-auto');
  });

  it('says so rather than drawing an empty box while the data loads', () => {
    render(<SovLegend owners={[]} />);
    expect(screen.getByText('Loading sovereignty...')).toBeInTheDocument();
  });
});
