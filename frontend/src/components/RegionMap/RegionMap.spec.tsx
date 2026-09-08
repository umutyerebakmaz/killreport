import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RegionMap from './RegionMap';

describe('RegionMap', () => {
  it("renders the region's map at the requested size", () => {
    render(<RegionMap regionId={10000046} regionName="Fade" size={64} />);
    const image = screen.getByAltText('Fade map');
    expect(image).toHaveAttribute('src', '/images/regions/10000046.svg');
    expect(image).toHaveAttribute('width', '64');
    expect(image).toHaveAttribute('height', '64');
  });

  it('removes itself when the file is missing, rather than showing a broken image', () => {
    render(<RegionMap regionId={999} regionName="Nowhere" size={64} />);
    const image = screen.getByAltText('Nowhere map');
    fireEvent.error(image);
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();
  });

  it('shows a new region after a previous one failed to load', () => {
    const { rerender } = render(
      <RegionMap regionId={999} regionName="Nowhere" size={64} />,
    );
    fireEvent.error(screen.getByAltText('Nowhere map'));
    expect(screen.queryByAltText('Nowhere map')).not.toBeInTheDocument();

    rerender(<RegionMap regionId={10000046} regionName="Fade" size={64} />);
    expect(screen.getByAltText('Fade map')).toHaveAttribute(
      'src',
      '/images/regions/10000046.svg',
    );
  });
});
