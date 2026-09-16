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
  it('renders its items as inventory tiles in grid view', () => {
    const { container } = render(
      <FittingSection
        title="High Slots"
        items={[item(1, 'Gatling'), item(2, 'Salvager')]}
        keyPrefix="high"
        view="grid"
        scope="all"
      />,
    );

    expect(container.querySelector('.card')).not.toBeNull();
    expect(container.querySelector('.flex-wrap')).not.toBeNull();

    // A tile carries the name in its alt and title, not as text: 64px is
    // narrower than any module name.
    expect(screen.getByAltText('Gatling')).toBeInTheDocument();
    expect(screen.queryByText('Gatling')).toBeNull();
  });

  it('keeps the named rows in table view', () => {
    const { container } = render(
      <FittingSection
        title="High Slots"
        items={[item(1, 'Gatling')]}
        keyPrefix="high"
        view="table"
        scope="all"
      />,
    );

    expect(container.querySelector('.flex-wrap')).toBeNull();
    expect(container.querySelector('.divide-y')).not.toBeNull();
    expect(screen.getByText('Gatling')).toBeInTheDocument();
    expect(container.querySelector('.w-40')).not.toBeNull();
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
