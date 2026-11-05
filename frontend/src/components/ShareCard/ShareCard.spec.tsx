import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { killLossBarHeights } from './KillLossBars';
import NameBlock from './NameBlock';
import ShareAttackerBadge from './ShareAttackerBadge';
import ShareCardFrame from './ShareCardFrame';
import { systemSubtitle } from './SolarSystemShareCard';

describe('killLossBarHeights', () => {
  it('gives the larger side full height', () => {
    expect(killLossBarHeights(252, 58)).toEqual({ kills: 1, losses: 58 / 252 });
    expect(killLossBarHeights(9593, 11861)).toEqual({
      kills: 9593 / 11861,
      losses: 1,
    });
  });

  it('draws nothing when both are zero', () => {
    expect(killLossBarHeights(0, 0)).toBeNull();
  });
});

describe('ShareAttackerBadge', () => {
  it.each([
    [{ solo: true, npc: false, attackerCount: 1 }, 'SOLO'],
    [{ solo: true, npc: true, attackerCount: 1 }, 'NPC'],
    [{ solo: false, npc: false, attackerCount: 5 }, '5'],
    [{ solo: false, npc: true, attackerCount: 3 }, '3'],
  ])('shows the label for %j', (props, text) => {
    render(<ShareAttackerBadge {...props} />);
    expect(screen.getByText(text)).toBeTruthy();
  });
});

describe('NameBlock', () => {
  it('truncates a long membership name to one line', () => {
    render(
      <NameBlock
        title="Victim"
        memberships={[{ logo: 'x.png', name: 'A very long corporation name' }]}
      />,
    );
    const row = screen.getByText('A very long corporation name');
    expect(row.style.textOverflow).toBe('ellipsis');
    expect(row.style.whiteSpace).toBe('nowrap');
  });

  it('keeps a plain string title as a single text node', () => {
    render(<NameBlock title="Victim" />);
    const el = screen.getByText('Victim');
    expect(el.style.textOverflow).toBe('ellipsis');
    expect(el.children).toHaveLength(0);
  });

  it('renders a title given as styled pieces in a flex row', () => {
    render(
      <NameBlock
        title={[{ text: '0.4', color: '#facc15' }, { text: 'Amamake' }]}
      />,
    );
    const sec = screen.getByText('0.4');
    const name = screen.getByText('Amamake');
    expect(sec.style.color).toBe('rgb(250, 204, 21)');
    expect(sec.parentElement?.style.display).toBe('flex');
    expect(name.parentElement).toBe(sec.parentElement);
    expect(name.style.textOverflow).toBe('ellipsis');
    expect(name.style.whiteSpace).toBe('nowrap');
  });

  it('renders the subtitle at 30px / 500, also as styled pieces', () => {
    render(
      <NameBlock
        title="Amamake"
        subtitle={[
          { text: 'Hed', color: '#e5e7eb' },
          { text: ' \u00b7 ', color: '#b0b0b0' },
          { text: 'Heimatar', color: '#60a5fa' },
        ]}
      />,
    );
    const region = screen.getByText('Heimatar');
    expect(region.style.color).toBe('rgb(96, 165, 250)');
    const row = region.parentElement as HTMLElement;
    expect(row.style.fontSize).toBe('30px');
    expect(row.style.fontWeight).toBe('500');
    expect(row.style.display).toBe('flex');
  });

  it('has no membership rows without memberships', () => {
    const { container } = render(<NameBlock title="Victim" memberships={[]} />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('ShareCardFrame', () => {
  it('shows the wordmark and the footer content', () => {
    render(
      <ShareCardFrame
        bar="red"
        left={<div>L</div>}
        right={<div>R</div>}
        footerRight={<span>FOOT</span>}
      />,
    );
    expect(screen.getByText('KILLREPORT')).toBeTruthy();
    expect(screen.getByText('FOOT')).toBeTruthy();
  });
});

describe('systemSubtitle', () => {
  it('separates constellation and region with a middle dot', () => {
    expect(systemSubtitle('Hed', 'Heimatar')?.map((p) => p.text)).toEqual([
      'Hed',
      ' · ',
      'Heimatar',
    ]);
  });

  it('leaves no dangling separator when a name is empty', () => {
    expect(systemSubtitle('', 'Heimatar')).toEqual([
      { text: 'Heimatar', color: expect.any(String) },
    ]);
    expect(systemSubtitle('Hed', '')).toEqual([
      { text: 'Hed', color: expect.any(String) },
    ]);
    expect(systemSubtitle('', '')).toBeUndefined();
  });
});
