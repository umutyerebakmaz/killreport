import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

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
};

describe('KillmailSummaryCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on the All tab with every item shown', () => {
    render(<KillmailSummaryCard {...props} />);

    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByAltText('Gatling')).toBeInTheDocument();
    expect(screen.getByAltText('Salvager')).toBeInTheDocument();
  });

  it('shows only destroyed items on the Destroyed tab, ship included', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Destroyed' }));

    expect(screen.getByAltText('Gatling')).toBeInTheDocument();
    expect(screen.queryByAltText('Salvager')).toBeNull();
    expect(screen.getByText('Rifter')).toBeInTheDocument();
  });

  it('hides the ship on the Dropped tab', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Dropped' }));

    expect(screen.getByAltText('Salvager')).toBeInTheDocument();
    expect(screen.queryByAltText('Gatling')).toBeNull();
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

  it('starts in grid view', () => {
    render(<KillmailSummaryCard {...props} />);

    // Tiles: the name is in the image, not in the text.
    expect(screen.getByAltText('Gatling')).toBeInTheDocument();
    expect(screen.queryByText('Gatling')).toBeNull();
  });

  it('puts the groups side by side in grid view and stacks them in table view', async () => {
    render(<KillmailSummaryCard {...props} />);

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveClass('grid');
    expect(panel).toHaveClass('xl:grid-cols-3');

    await userEvent.click(screen.getByRole('radio', { name: 'Table' }));

    expect(screen.getByRole('tabpanel')).not.toHaveClass('grid');
  });

  it('remembers the table view', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Table' }));

    expect(screen.getByText('Gatling')).toBeInTheDocument();
    expect(localStorage.getItem('killmail_fitting_view')).toBe('table');
  });

  it('opens in the remembered view', () => {
    localStorage.setItem('killmail_fitting_view', 'table');

    render(<KillmailSummaryCard {...props} />);

    expect(screen.getByText('Gatling')).toBeInTheDocument();
  });

  it('keeps the filter and the view independent', async () => {
    render(<KillmailSummaryCard {...props} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Table' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Destroyed' }));

    expect(screen.getByRole('radio', { name: 'Table' })).toBeChecked();
    expect(screen.queryByText('Salvager')).toBeNull();
  });
});
