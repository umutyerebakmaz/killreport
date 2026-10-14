import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MapSwitch from './MapSwitch';

const OPTIONS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
] as const;

describe('MapSwitch', () => {
  it('names the group and presses the selected segment only', () => {
    render(
      <MapSwitch
        label="Layout"
        options={OPTIONS}
        value="b"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('group', { name: 'Layout' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Alpha' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('reports the segment clicked', () => {
    const onChange = vi.fn();
    render(
      <MapSwitch
        label="Layout"
        options={OPTIONS}
        value="b"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});
