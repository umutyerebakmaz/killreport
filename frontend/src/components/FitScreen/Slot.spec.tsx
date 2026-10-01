import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Slot from './Slot';

const pulseLaser = { id: 3057, name: 'Heavy Pulse Laser II' };
const scorch = { id: 12820, name: 'Scorch M' };

const slot = (module: unknown) => ({ slotIndex: 0, module });

const fitted = (charge?: typeof scorch) => ({
  itemType: pulseLaser,
  singleton: 1,
  charge: charge ? { itemType: charge, singleton: 1 } : null,
});

const hover = (img: HTMLElement) =>
  fireEvent.mouseEnter(img.closest('.tooltip-trigger')!);

describe('Slot', () => {
  it('shows only the charge when a weapon has one loaded', () => {
    render(<Slot slots={[slot(fitted(scorch))]} />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('alt', 'Scorch M');
  });

  it('lists the weapon, then the charge, each with its icon, in the tooltip', () => {
    render(<Slot slots={[slot(fitted(scorch))]} />);
    hover(screen.getByAltText('Scorch M'));

    const rows = within(
      document.querySelector('.tooltip') as HTMLElement,
    ).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Heavy Pulse Laser II');
    expect(within(rows[0] as HTMLElement).getByRole('img')).toHaveAttribute(
      'alt',
      'Heavy Pulse Laser II',
    );
    expect(rows[1]).toHaveTextContent('Scorch M');
    expect(within(rows[1] as HTMLElement).getByRole('img')).toHaveAttribute(
      'alt',
      'Scorch M',
    );
  });

  it('shows the module, with one tooltip row, when nothing is loaded', () => {
    render(<Slot slots={[slot(fitted())]} />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('alt', 'Heavy Pulse Laser II');

    hover(images[0]);
    const rows = within(
      document.querySelector('.tooltip') as HTMLElement,
    ).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Heavy Pulse Laser II');
  });

  it('shows a single empty-slot icon for an empty slot', () => {
    render(<Slot slots={[slot(null)]} slotType="mid" />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('alt', 'Mid Slot');
  });
});
