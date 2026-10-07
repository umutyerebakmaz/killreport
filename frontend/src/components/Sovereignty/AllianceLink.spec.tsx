import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AllianceLink } from './AllianceLink';

describe('AllianceLink', () => {
  it('shows the alliance logo beside its name, inside the one link', () => {
    render(<AllianceLink id={99003581} name="Fraternity." ticker="FRT" />);

    const link = screen.getByRole('link', { name: 'Fraternity.' });
    expect(link.getAttribute('href')).toBe('/alliances/99003581');
    const logo = link.querySelector('img')!;
    expect(logo.getAttribute('src')).toContain('/alliances/99003581/');
  });

  // A territory change can name an NPC faction, whose crest the image server
  // serves down the corporation path, as everywhere else on the site.
  it('fetches a faction crest down the corporation path', () => {
    render(<AllianceLink id={500003} name="Amarr Empire" />);

    expect(
      screen.getByRole('link').querySelector('img')!.getAttribute('src'),
    ).toContain('/corporations/500003/');
  });

  it('draws no logo for an unknown owner', () => {
    render(<AllianceLink id={null} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
