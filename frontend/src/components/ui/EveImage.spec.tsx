import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import EveImage from './EveImage';

describe('EveImage', () => {
  it('writes the drawn size as width and height', () => {
    render(<EveImage kind="character" id={95465499} name="Pilot" size={64} />);

    const img = screen.getByAltText('Pilot');
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
  });

  it('asks the image server for twice the drawn size', () => {
    render(<EveImage kind="character" id={95465499} name="Pilot" size={64} />);

    expect(screen.getByAltText('Pilot')).toHaveAttribute(
      'src',
      'https://images.evetech.net/characters/95465499/portrait?size=128',
    );
  });

  it('keeps the caller class', () => {
    render(
      <EveImage
        kind="alliance"
        id={99000001}
        name="Alliance"
        size={32}
        className="shadow-md"
      />,
    );

    expect(screen.getByAltText('Alliance')).toHaveClass('shadow-md');
  });

  it('falls back from a ship render to its icon', () => {
    render(<EveImage kind="ship" id={587} name="Rifter" size={64} />);

    const img = screen.getByAltText('Rifter');
    expect(img).toHaveAttribute(
      'src',
      'https://images.evetech.net/types/587/render?size=128',
    );

    fireEvent.error(img);

    expect(screen.getByAltText('Rifter')).toHaveAttribute(
      'src',
      'https://images.evetech.net/types/587/icon?size=128',
    );
  });

  it('does not carry a ship fallback into the next ship', () => {
    const { rerender } = render(
      <EveImage kind="ship" id={587} name="Rifter" size={64} />,
    );
    fireEvent.error(screen.getByAltText('Rifter'));

    rerender(<EveImage kind="ship" id={588} name="Rupture" size={64} />);

    expect(screen.getByAltText('Rupture')).toHaveAttribute(
      'src',
      'https://images.evetech.net/types/588/render?size=128',
    );
  });

  it('draws a fill image without width and height', () => {
    render(<EveImage kind="ship" id={587} name="Rifter" fill />);

    const img = screen.getByAltText('Rifter');
    expect(img).not.toHaveAttribute('width');
    expect(img).toHaveAttribute(
      'src',
      'https://images.evetech.net/types/587/render?size=512',
    );
  });
});
