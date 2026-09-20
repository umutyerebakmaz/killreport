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
    render(<SovLegend owners={owners} max={2} />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('collects everything past the cap into one row', () => {
    // A legend with 101 rows is a list, not a legend; the tail is one line
    // that says how much of the map it covers.
    render(<SovLegend owners={owners} max={2} />);

    expect(screen.queryByText('C')).not.toBeInTheDocument();
    expect(screen.getByText('1 other')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('says so rather than drawing an empty box while the data loads', () => {
    render(<SovLegend owners={[]} max={2} />);
    expect(screen.getByText('Loading sovereignty...')).toBeInTheDocument();
  });
});
