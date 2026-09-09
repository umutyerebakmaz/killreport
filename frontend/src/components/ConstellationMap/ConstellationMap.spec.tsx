import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConstellationMap from './ConstellationMap';

describe('ConstellationMap', () => {
  it("renders the constellation's map at the requested size", () => {
    render(
      <ConstellationMap
        constellationId={20000020}
        constellationName="Kimotoro"
        size={64}
      />,
    );
    const image = screen.getByAltText('Kimotoro map');
    expect(image).toHaveAttribute('src', '/images/constellations/20000020.svg');
    expect(image).toHaveAttribute('width', '64');
    expect(image).toHaveAttribute('height', '64');
  });

  it('removes itself when the file is missing, rather than showing a broken image', () => {
    render(
      <ConstellationMap
        constellationId={999}
        constellationName="Nowhere"
        size={64}
      />,
    );
    const image = screen.getByAltText('Nowhere map');
    fireEvent.error(image);
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();
  });

  it('shows a new constellation after a previous one failed to load', () => {
    const { rerender } = render(
      <ConstellationMap
        constellationId={999}
        constellationName="Nowhere"
        size={64}
      />,
    );
    fireEvent.error(screen.getByAltText('Nowhere map'));
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();

    rerender(
      <ConstellationMap
        constellationId={20000020}
        constellationName="Kimotoro"
        size={64}
      />,
    );
    expect(screen.getByAltText('Kimotoro map')).toHaveAttribute(
      'src',
      '/images/constellations/20000020.svg',
    );
  });
});
