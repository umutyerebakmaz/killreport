import { describe, expect, it } from 'vitest';

import { celestialName } from './celestialName';

describe('celestialName', () => {
  it('drops the parentheses around a stargate destination', () => {
    expect(celestialName('Stargate (O-VWPB)')).toBe('Stargate O-VWPB');
    expect(celestialName('Stargate (New Caldari)')).toBe(
      'Stargate New Caldari',
    );
  });

  it('leaves every other name as it is', () => {
    expect(celestialName('Y-ORBJ VI - Moon 1')).toBe('Y-ORBJ VI - Moon 1');
    expect(
      celestialName('Jita IV - Moon 4 - Caldari Navy Assembly Plant'),
    ).toBe('Jita IV - Moon 4 - Caldari Navy Assembly Plant');
  });

  it('passes a missing name through as empty', () => {
    expect(celestialName(null)).toBe('');
  });
});
