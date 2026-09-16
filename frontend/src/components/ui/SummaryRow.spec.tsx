import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SummaryRow from './SummaryRow';

describe('SummaryRow', () => {
  it('renders the label and the value', () => {
    render(<SummaryRow label="System">Jita</SummaryRow>);

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Jita')).toBeInTheDocument();
  });

  it('keeps the label muted and the value prominent', () => {
    render(<SummaryRow label="System">Jita</SummaryRow>);

    expect(screen.getByText('System')).toHaveClass('text-gray-400');
    expect(screen.getByText('Jita')).toHaveClass('text-gray-100');
  });

  it('lets the value carry its own colour', () => {
    render(
      <SummaryRow label="Destroyed">
        <span className="text-destroyed">1.2M</span>
      </SummaryRow>,
    );

    expect(screen.getByText('1.2M')).toHaveClass('text-destroyed');
  });
});
