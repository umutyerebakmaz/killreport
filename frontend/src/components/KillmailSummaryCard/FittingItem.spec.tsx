import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import FittingItem from './FittingItem';

const item = {
  itemType: {
    id: 3244,
    name: 'Warp Disruptor II',
    volume: 5,
    jitaPrice: { sell: 21_000_000 },
  },
  singleton: 0,
  quantityDestroyed: 4,
  quantityDropped: 0,
};

const renderTile = () =>
  render(<FittingItem item={item} keyPrefix="mid" index={0} view="grid" />);

describe('FittingItem', () => {
  it('stamps the count on the tile', () => {
    renderTile();

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByAltText('Warp Disruptor II')).toBeInTheDocument();
  });

  it('leaves the count off a single item', () => {
    render(
      <FittingItem
        item={{ ...item, quantityDestroyed: 1 }}
        keyPrefix="mid"
        index={0}
        view="grid"
      />,
    );

    expect(screen.queryByText('1')).toBeNull();
  });

  it('gives the count, the ISK and the volume on hover', async () => {
    renderTile();

    await userEvent.hover(screen.getByAltText('Warp Disruptor II'));

    expect(screen.getByText('4x Warp Disruptor II')).toBeInTheDocument();
    expect(
      screen.getByText('Est. 84.000.000 ISK (21.000.000 ISK per unit)'),
    ).toBeInTheDocument();
    expect(screen.getByText('20 m3 (5 m3 per unit)')).toBeInTheDocument();
  });

  it('leaves the volume line out when the type has none', async () => {
    render(
      <FittingItem
        item={{ ...item, itemType: { ...item.itemType, volume: null } }}
        keyPrefix="mid"
        index={0}
        view="grid"
      />,
    );

    await userEvent.hover(screen.getByAltText('Warp Disruptor II'));

    expect(screen.getByText('4x Warp Disruptor II')).toBeInTheDocument();
    expect(screen.queryByText(/m3/)).toBeNull();
  });
});
