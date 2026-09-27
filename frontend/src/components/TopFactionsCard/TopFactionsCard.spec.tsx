import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TopFactionsCard from './TopFactionsCard';

// <Loader> pulls in lottie-web, which needs a canvas jsdom does not have.
vi.mock('lottie-react', () => ({ default: () => null }));

describe('TopFactionsCard', () => {
  it('links each faction to its killmails tab', () => {
    render(
      <TopFactionsCard
        title="Top Factions"
        factions={[
          { id: 500003, name: 'Amarr Empire', killCount: 12 },
          { id: 500001, name: 'Caldari State', killCount: 4 },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Amarr Empire' })).toHaveAttribute(
      'href',
      '/factions/500003?tab=killmails',
    );
    expect(screen.getByRole('link', { name: 'Caldari State' })).toHaveAttribute(
      'href',
      '/factions/500001?tab=killmails',
    );
  });
});
