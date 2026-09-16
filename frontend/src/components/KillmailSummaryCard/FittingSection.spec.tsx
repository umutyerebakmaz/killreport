import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FittingSection from './FittingSection';

const item = (id: number, name: string) => ({
  itemType: { id, name, jitaPrice: { sell: 1_000_000 } },
  singleton: 0,
  quantityDestroyed: 1,
  quantityDropped: 0,
});

describe('FittingSection', () => {
  it('lays the items out in a grid in grid view', () => {
    const { container } = render(
      <FittingSection
        title="High Slots"
        items={[item(1, 'Gatling'), item(2, 'Salvager')]}
        keyPrefix="high"
        view="grid"
        scope="all"
      />,
    );

    const list = container.querySelector('.grid');
    expect(list).not.toBeNull();
    expect(list).toHaveClass('2xl:grid-cols-3');
    expect(screen.getByText('Gatling')).toBeInTheDocument();
    expect(screen.getByText('Salvager')).toBeInTheDocument();
  });

  it('keeps the stacked rows in table view', () => {
    const { container } = render(
      <FittingSection
        title="High Slots"
        items={[item(1, 'Gatling')]}
        keyPrefix="high"
        view="table"
        scope="all"
      />,
    );

    expect(container.querySelector('.grid')).toBeNull();
    expect(container.querySelector('.divide-y')).not.toBeNull();
  });

  it('renders nothing when it has no items', () => {
    const { container } = render(
      <FittingSection
        title="Rigs"
        items={[]}
        keyPrefix="rig"
        view="grid"
        scope="all"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
