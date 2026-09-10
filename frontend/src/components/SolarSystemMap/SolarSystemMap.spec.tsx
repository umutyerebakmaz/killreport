import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SolarSystemMap from './SolarSystemMap';

describe('SolarSystemMap', () => {
  it("renders the system's map at the requested size", () => {
    render(<SolarSystemMap systemId={30000142} systemName="Jita" size={64} />);
    const image = screen.getByAltText('Jita map');
    expect(image).toHaveAttribute('src', '/images/solar-systems/30000142.svg');
    expect(image).toHaveAttribute('width', '64');
    expect(image).toHaveAttribute('height', '64');
  });

  it('removes itself when the file is missing, rather than showing a broken image', () => {
    render(<SolarSystemMap systemId={999} systemName="Nowhere" size={64} />);
    const image = screen.getByAltText('Nowhere map');
    fireEvent.error(image);
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();
  });

  it('shows a new system after a previous one failed to load', () => {
    const { rerender } = render(
      <SolarSystemMap systemId={999} systemName="Nowhere" size={64} />,
    );
    fireEvent.error(screen.getByAltText('Nowhere map'));
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();

    rerender(
      <SolarSystemMap systemId={30000142} systemName="Jita" size={64} />,
    );
    expect(screen.getByAltText('Jita map')).toHaveAttribute(
      'src',
      '/images/solar-systems/30000142.svg',
    );
  });
});
