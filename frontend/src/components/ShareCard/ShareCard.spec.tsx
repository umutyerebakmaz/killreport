import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { killLossBarHeights } from './KillLossBars';
import NameBlock from './NameBlock';
import ShareAttackerBadge from './ShareAttackerBadge';
import ShareCardFrame from './ShareCardFrame';

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
