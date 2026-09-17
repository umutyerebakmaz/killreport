import { describe, expect, it } from 'vitest';

import {
  getSecurityStatusBorderColor,
  getSecurityStatusColor,
} from './securityStatus';

describe('getSecurityStatusColor', () => {
  it('returns gray for missing values', () => {
    expect(getSecurityStatusColor(null)).toBe('text-gray-400');
    expect(getSecurityStatusColor(undefined)).toBe('text-gray-400');
  });

  it('maps each band to its colour', () => {
    expect(getSecurityStatusColor(5)).toBe('text-blue-400');
    expect(getSecurityStatusColor(0)).toBe('text-green-400');
    expect(getSecurityStatusColor(-1.9)).toBe('text-yellow-400');
    expect(getSecurityStatusColor(-4.9)).toBe('text-orange-400');
    expect(getSecurityStatusColor(-10)).toBe('text-red-400');
  });
});

describe('getSecurityStatusBorderColor', () => {
  it('returns gray for missing values', () => {
    expect(getSecurityStatusBorderColor(null)).toBe('border-l-gray-400');
    expect(getSecurityStatusBorderColor(undefined)).toBe('border-l-gray-400');
  });

  it('colours only the left edge, never the whole box', () => {
    // A row's divider comes from `divide-white/5`, whose rule sits inside
    // :where() and so carries no specificity at all. A plain `border-red-400`
    // sets border-color on all four sides and repaints that divider in the
    // security colour, which is what this returning `border-l-*` prevents.
    for (const v of [null, 5, 0, -3, -9]) {
      expect(getSecurityStatusBorderColor(v)).toMatch(/^border-l-/);
    }
  });

  it('maps each band to its colour', () => {
    expect(getSecurityStatusBorderColor(5)).toBe('border-l-blue-400');
    expect(getSecurityStatusBorderColor(0)).toBe('border-l-green-400');
    expect(getSecurityStatusBorderColor(-1.9)).toBe('border-l-yellow-400');
    expect(getSecurityStatusBorderColor(-4.9)).toBe('border-l-orange-400');
    expect(getSecurityStatusBorderColor(-10)).toBe('border-l-red-400');
  });

  it('crosses every threshold on the same value the text colour does', () => {
    // One table, two readings: the ranked rows draw the stripe, the character
    // page and the entity cards draw the figure. A band boundary that moved in
    // one and not the other would put a green number on a page whose list had
    // already drawn that character yellow.
    for (const v of [6, 5, 4.9, 0.1, 0, -0.1, -2, -2.1, -5, -5.1, -20]) {
      expect(getSecurityStatusBorderColor(v)).toBe(
        getSecurityStatusColor(v).replace('text-', 'border-l-'),
      );
    }
  });
});
