import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Card from './Card';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>body</Card>);

    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('puts the header inside the card surface', () => {
    const { container } = render(<Card header={<h2>TOP SHIPS</h2>}>body</Card>);

    const heading = screen.getByRole('heading', { name: 'TOP SHIPS' });
    expect(heading.closest('.card')).not.toBeNull();
    expect(container.querySelector('.card-header')).not.toBeNull();
  });

  it('leaves out the header element when no header is given', () => {
    const { container } = render(<Card>body</Card>);

    expect(container.querySelector('.card-header')).toBeNull();
  });
});
