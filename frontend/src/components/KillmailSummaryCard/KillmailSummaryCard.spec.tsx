import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import KillmailSummaryCard from './KillmailSummaryCard';

const slot = (
  id: number,
  name: string,
  destroyed: number,
  dropped: number,
) => ({
  module: {
    itemType: { id, name, jitaPrice: { sell: 1_000_000 } },
    singleton: 0,
    quantityDestroyed: destroyed,
    quantityDropped: dropped,
  },
});

const props = {
  victim: {
    shipType: {
      id: 587,
      name: 'Rifter',
      group: { name: 'Frigate' },
      dogmaAttributes: [],
    },
  },
  fitting: {
    highSlots: {
      slots: [slot(1, 'Gatling', 1, 0), slot(2, 'Salvager', 0, 1)],
    },
  },
  isStructure: false,
  destroyedValue: 5_000_000,
  droppedValue: 2_000_000,
  totalValue: 7_000_000,
} as any;

describe('KillmailSummaryCard', () => {
  it('starts on the All tab with every item shown', () => {
    render(<KillmailSummaryCard {...props} />);

    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Gatling')).toBeInTheDocument();
    expect(screen.getByText('Salvager')).toBeInTheDocument();
  });

  it('shows only destroyed items on the Destroyed tab, ship included', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Destroyed' }));

    expect(screen.getByText('Gatling')).toBeInTheDocument();
    expect(screen.queryByText('Salvager')).toBeNull();
    expect(screen.getByText('Rifter')).toBeInTheDocument();
  });

  it('hides the ship on the Dropped tab', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Dropped' }));

    expect(screen.getByText('Salvager')).toBeInTheDocument();
    expect(screen.queryByText('Gatling')).toBeNull();
    expect(screen.queryByText('Rifter')).toBeNull();
  });

  it('leaves the ISK totals alone whatever the tab says', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Dropped' }));

    // The figures, not the labels: "Destroyed" is also the name of a tab, and
    // what this test is about is that the killmail's totals do not follow the
    // view.
    expect(screen.getByText('5.00M')).toBeInTheDocument();
    expect(screen.getByText('2.00M')).toBeInTheDocument();
    expect(screen.getByText('7.00M')).toBeInTheDocument();
  });
});
